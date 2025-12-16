// Initialize the map
function initMap() {
    let deviceLocations = {}; // Coordinates from devices_list API
    let markers = {};
    let map;

    // Fetch device locations (registered devices)
    async function fetchDeviceLocations() {
        try {
            const response = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/v1/devices_list');
            const data = await response.json();

            // Save device coordinates
            data.devices.forEach(device => {
                deviceLocations[device.device_id] = [device.latitude, device.longitude];
            });

            // Calculate center of all devices
            let latSum = 0, lngSum = 0, count = 0;
            Object.values(deviceLocations).forEach(([lat, lng]) => {
                latSum += lat;
                lngSum += lng;
                count++;
            });
            const centerLat = latSum / count;
            const centerLng = lngSum / count;

            // Initialize map centered on devices
            map = L.map('mapid').setView([centerLat, centerLng], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Initialize markers for all registered devices (default: blue/offline)
            Object.entries(deviceLocations).forEach(([deviceId, [lat, lng]]) => {
                const icon = L.icon({
                    iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                });

                markers[deviceId] = L.marker([lat, lng], { icon })
                    .addTo(map)
                    .bindPopup(`
                        <b>${deviceId}</b><br>
                        Lat: ${lat}<br>
                        Lng: ${lng}<br>
                        Status: Offline<br>
                        Registered
                    `);
            });

            // Start updating device statuses
            updateDeviceStatus();
            setInterval(updateDeviceStatus, 1000); // refresh every 1 sec

        } catch (err) {
            console.error("Error fetching device locations:", err);
        }
    }

    // Fetch device statuses (online/offline/earthquake)
    async function updateDeviceStatus() {
        try {
            const response = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/v1/devices');
            const data = await response.json();
            const onlineDevices = data.devices || {};

            // Update last updated timestamp
            document.getElementById("lastUpdated").innerText = new Date().toLocaleString();

            // Iterate all registered devices
            Object.entries(deviceLocations).forEach(([deviceId, [lat, lng]]) => {
                const deviceInfo = onlineDevices[deviceId];
                let iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png';
                let statusText = 'Offline';
                let gForceText = '';

                if (deviceInfo) {
                    const gForce = deviceInfo.g_force;
                    gForceText = `G-Force: ${gForce}`;

                    if (gForce > 1.35) {
                        iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png';
                        statusText = 'Earthquake Alert';
                    } else {
                        iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png';
                        statusText = 'Online';
                    }
                }

                const icon = L.icon({
                    iconUrl,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                });

                if (markers[deviceId]) {
                    markers[deviceId].setIcon(icon);
                    markers[deviceId].setPopupContent(`
                        <b>${deviceId}</b><br>
                        Lat: ${lat}<br>
                        Lng: ${lng}<br>
                        Status: ${statusText}<br>
                        ${gForceText}<br>
                        ${deviceInfo ? `Timestamp: ${new Date(deviceInfo.server_timestamp).toLocaleString()}` : ''}
                    `);
                }
            });

        } catch (err) {
            console.error("Error fetching device statuses:", err);
        }
    }

    fetchDeviceLocations();
}

// Only export the initMap function for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initMap };
}
