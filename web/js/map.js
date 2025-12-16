function initMap() {
    const map = L.map('mapid').setView([14.5995, 120.9842], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let markers = {};

    async function fetchDevices() {
        try {
            const response = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/v1/devices_list');
            const data = await response.json();

            // Update Last Updated time like dashboard.js
            const now = new Date();
            const lastUpdatedEl = document.getElementById("lastUpdated");
            if (lastUpdatedEl) {
                lastUpdatedEl.textContent = now.toLocaleString(); // MM/DD/YYYY, hh:mm:ss AM/PM
            }

            data.devices.forEach(device => {
                const icon = L.icon({
                    iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                });

                const latLng = [device.latitude, device.longitude];

                if (markers[device.device_id]) {
                    // Update existing marker
                    markers[device.device_id].setLatLng(latLng);
                } else {
                    // Add new marker
                    markers[device.device_id] = L.marker(latLng, { icon })
                        .addTo(map)
                        .bindPopup(`
                            <b>${device.device_id}</b><br>
                            Lat: ${device.latitude}<br>
                            Lng: ${device.longitude}<br>
                            Registered: ${new Date(device.registered_at).toLocaleString()}
                        `);
                }
            });
        } catch (err) {
            console.error("Error fetching devices:", err);
        }
    }

    // Initial load
    fetchDevices();

    // Refresh devices every 10 seconds
    setInterval(fetchDevices, 10000);
}
