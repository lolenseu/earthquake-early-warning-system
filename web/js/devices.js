// devices.js
let deviceGrid;
let lastUpdated;

// Fetch registered devices list
async function fetchDevicesList() {
    try {
        const res = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/devices_list');
        const data = await res.json();
        return data.devices || [];
    } catch (e) {
        return [];
    }
}

// Fetch live device data
async function fetchLiveDevices() {
    try {
        const res = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/devices');
        const data = await res.json();
        return data.devices || {};
    } catch (e) {
        return {};
    }
}

function createDeviceCard(deviceInfo, liveDevice) {
    const card = document.createElement('div');
    card.className = 'device-card';
    
    const gForce = liveDevice?.g_force || 0;
    let statusClass = 'status-offline';
    let statusText = 'Offline';
    let gForceText = '0.0';
    let statusSign = 'Normal';
    let statusSignClass = 'status-sign-normal';
    
    if (liveDevice) {
        statusClass = 'status-online';
        statusText = 'Online';
    } else {
        statusClass = 'status-offline';
        statusText = 'Offline';
    }

    if (liveDevice) {
        gForceText = `${gForce.toFixed(1)}`;
        if (gForce > 1.35) {
            statusSign = 'Earthquake';
            statusSignClass = 'status-sign-warning';
        } else {
            statusSign = 'Normal';
            statusSignClass = 'status-sign-normal';
        }
    }

    card.innerHTML = `
        <div class="device-icon">
            <span class="material-icons">router</span>
        </div>
        <div class="device-info">
            <div class="device-left">
                <div class="device-detail">
                    <span class="status-dot ${statusClass}"></span>
                    <span class="value">${statusText}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Status:</span>
                    <span class="status-sign ${statusSignClass}">${statusSign}</span>
                </div>
                <div class="device-detail">
                    <span class="label">ID:</span>
                    <span class="value">${deviceInfo.device_id}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Magnitude:</span>
                    <span class="value">${gForceText}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Coordinates:</span>
                    <span class="value">${deviceInfo.latitude.toFixed(4)}, ${deviceInfo.longitude.toFixed(4)}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Location:</span>
                    <span class="value">${deviceInfo.location || 'Unknown'}</span>
                </div>
            </div>
            <span class="material-icons action-btn">more_vert</span>
        </div>
    `;
    
    return card;
}

async function initDevices() {
    // Get elements after DOM is loaded
    deviceGrid = document.getElementById('deviceGrid');
    lastUpdated = document.getElementById('lastUpdated');
    
    if (!deviceGrid) {
        console.error('deviceGrid element not found');
        return;
    }
    
    console.log('Initializing devices...');
    
    const devicesList = await fetchDevicesList();
    const liveDevices = await fetchLiveDevices();
    
    console.log('Devices list:', devicesList);
    console.log('Live devices:', liveDevices);
    
    deviceGrid.innerHTML = '';
    
    devicesList.forEach(device => {
        const liveDevice = liveDevices[device.device_id];
        deviceGrid.appendChild(createDeviceCard(device, liveDevice));
    });
    
    if (lastUpdated) {
        lastUpdated.textContent = new Date().toLocaleString();
    }
}

// Initialize devices when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the page to load completely
    setTimeout(initDevices, 100);
});

// Refresh data every second
setInterval(initDevices, 1000);