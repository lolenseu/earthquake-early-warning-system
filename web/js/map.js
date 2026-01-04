// Initialize the IoT Map
function initIoTMap() {
    console.log('initIoTMap called');
    
    // Check if Leaflet is available
    console.log('Leaflet global variable:', typeof L);
    if (typeof L === 'undefined') {
        console.error('Leaflet is not loaded');
        return;
    }
    
    // Check if the container exists
    const container = document.getElementById('iotmapid');
    if (!container) {
        console.error('IoT Map container not found');
        return;
    }
    
    console.log('IoT Map container found, initializing...');
    
    let deviceLocations = {}; // Coordinates from devices_list API
    let markers = {};
    let map;

    // Fetch device locations (registered devices)
    async function fetchDeviceLocations() {
        try {
            console.log('Fetching device locations...');
            const response = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/devices_list');
            const data = await response.json();

            // Save device coordinates and locations
            data.devices.forEach(device => {
                deviceLocations[device.device_id] = [device.latitude, device.longitude, device.location || 'Unknown'];
            });

            console.log('Device locations received:', deviceLocations);

            // Calculate center of all devices
            let latSum = 0, lngSum = 0, count = 0;
            Object.values(deviceLocations).forEach(([lat, lng]) => {
                latSum += lat;
                lngSum += lng;
                count++;
            });
            
            if (count === 0) {
                console.warn('No devices found');
                return;
            }
            
            const centerLat = latSum / count;
            const centerLng = lngSum / count;

            console.log('Center coordinates:', { centerLat, centerLng });

            // Initialize map centered on devices
            try {
                map = L.map('iotmapid').setView([centerLat, centerLng], 12);
                console.log('Map object created:', map);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(map);

            console.log('Map initialized');
            } catch (mapError) {
                console.error('Error creating map:', mapError);
                return;
            }

            // Initialize markers for all registered devices (default: blue/offline)
            Object.entries(deviceLocations).forEach(([deviceId, [lat, lng, location]]) => {
                const icon = L.icon({
                    iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                });

                markers[deviceId] = L.marker([lat, lng], { icon })
                    .addTo(map)
                    .bindPopup(`
                        <b>${deviceId}</b><br>
                        Latitude: ${lat}<br>
                        longitude: ${lng}<br>
                        Location: ${location}<br>
                        Status: Offline<br>
                        Registered
                    `);
            });

            console.log('Markers initialized');

            // Start updating device statuses
            updateDeviceStatus();
            setInterval(updateDeviceStatus, 1000); // refresh every 1 sec

        } catch (err) {
            console.error("Error fetching device locations:", err);
        }
    }

    // Fetch device statuses (online/offline/earthquake)
    async function updateDeviceStatus() {
        if (!map) {
            console.error('Map not initialized');
            return;
        }
        
        try {
            const response = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/devices');
            const data = await response.json();
            const onlineDevices = data.devices || {};

            // Update last updated timestamp
            const lastUpdated = document.getElementById("lastUpdated");
            if (lastUpdated) {
                lastUpdated.innerText = new Date().toLocaleString();
            }

            // Iterate all registered devices
            Object.entries(deviceLocations).forEach(([deviceId, [lat, lng, location]]) => {
                const deviceInfo = onlineDevices[deviceId];
                let iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png';
                let statusText = 'Offline';
                let gForceText = '';

                if (deviceInfo) {
                    const gForce = deviceInfo.g_force;
                    gForceText = `Magnitude: ${gForce.toFixed(1)}`;

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
                        Latitude: ${lat}<br>
                        longitude: ${lng}<br>
                        Location: ${location}<br>
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

// DO NOT add DOMContentLoaded listener here - let script.js handle initialization
