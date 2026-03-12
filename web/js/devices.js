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
        console.error('Error fetching devices list:', e);
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
        console.error('Error fetching live devices:', e);
        return {};
    }
}

function createDeviceCard(deviceInfo, liveDevice) {
    const card = document.createElement('div');
    card.className = 'device-card';
    
    const gForce = liveDevice?.g_force || 0;
    let statusText = 'Offline';
    let statusSign = 'Normal';
    let statusSignClass = 'status-sign-normal';
    let iconColor = '#007bff';
    
    if (liveDevice) {
        statusText = 'Online';
        iconColor = '#28a745';
        
        if (gForce > 1.35) {
            statusSign = 'Earthquake';
            statusSignClass = 'status-sign-warning';
            iconColor = '#dc3545';
        }
    }

    // Create click handler for the card
    card.onclick = function() {
        console.log('Card clicked for device:', deviceInfo.device_id);
        if (window.openDeviceModal) {
            window.openDeviceModal(deviceInfo, liveDevice);
        } else {
            console.error('openDeviceModal not found');
            alert('Modal function not loaded. Please refresh.');
        }
    };

    // Safely stringify for the more_vert button
    const deviceInfoStr = JSON.stringify(deviceInfo).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const liveDeviceStr = liveDevice ? JSON.stringify(liveDevice).replace(/'/g, "\\'").replace(/"/g, '&quot;') : 'null';

    card.innerHTML = `
        <div class="device-icon" style="background-color: ${iconColor}">
            <span class="material-icons">router</span>
        </div>
        <div class="device-info">
            <div class="device-left">
                <div class="device-detail">
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
                    <span class="value">${gForce.toFixed(1)}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Location:</span>
                    <span class="value">${deviceInfo.location || 'Unknown'}</span>
                </div>
            </div>
            <span class="material-icons action-btn" onclick="event.stopPropagation(); window.openDeviceModal(${deviceInfoStr}, ${liveDeviceStr})">more_vert</span>
        </div>
    `;
    
    return card;
}

// Make initDevices globally available
window.initDevices = async function() {
    console.log('Initializing devices...');
    
    // Get elements after DOM is loaded
    deviceGrid = document.getElementById('deviceGrid');
    lastUpdated = document.getElementById('lastUpdated');
    
    if (!deviceGrid) {
        console.error('deviceGrid element not found');
        return;
    }
    
    const devicesList = await fetchDevicesList();
    const liveDevices = await fetchLiveDevices();
    
    console.log('Devices loaded:', devicesList.length);
    
    deviceGrid.innerHTML = '';
    
    if (devicesList.length === 0) {
        deviceGrid.innerHTML = '<div class="no-devices"><span class="material-icons">router</span><p>No devices found</p></div>';
    } else {
        devicesList.forEach(device => {
            const liveDevice = liveDevices[device.device_id];
            deviceGrid.appendChild(createDeviceCard(device, liveDevice));
        });
    }
    
    if (lastUpdated) {
        lastUpdated.textContent = new Date().toLocaleString();
    }
}

// Set up interval for updates (every 5 seconds)
if (!window.devicesInterval) {
    window.devicesInterval = setInterval(() => {
        if (window.initDevices) {
            window.initDevices();
        }
    }, 5000);
}