// device-modal.js - Separate file for device modal functionality

// Device stats storage
let deviceStats = {};

// Load device stats from localStorage
function loadDeviceStats() {
    const saved = localStorage.getItem('device_stats');
    if (saved) {
        try {
            deviceStats = JSON.parse(saved);
        } catch (e) {
            deviceStats = {};
        }
    }
}

// Save device stats to localStorage
function saveDeviceStats() {
    localStorage.setItem('device_stats', JSON.stringify(deviceStats));
}

// Initialize stats for a device if not exists
function initDeviceStats(deviceId) {
    if (!deviceStats[deviceId]) {
        deviceStats[deviceId] = {
            dataPoints: 0,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            battery: 100,
            restarts: 0,
            sleeps: 0,
            status: 'offline'
        };
        saveDeviceStats();
    }
    return deviceStats[deviceId];
}

// Update device last seen
function updateDeviceLastSeen(deviceId) {
    if (deviceStats[deviceId]) {
        deviceStats[deviceId].lastSeen = new Date().toISOString();
        saveDeviceStats();
    }
}

// Calculate uptime
function calculateUptime(deviceId) {
    const stats = deviceStats[deviceId];
    if (!stats) return '0h';
    
    const firstSeen = new Date(stats.firstSeen);
    const now = new Date();
    const hours = Math.floor((now - firstSeen) / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
}

// Show confirmation dialog
function showDeviceConfirmation(message, type = 'warning') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            z-index: 11000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        let icon = 'warning';
        let color = '#fbbf24';
        let title = 'Confirm Action';
        let confirmText = 'Yes, Proceed';
        
        if (type === 'danger') {
            icon = 'error';
            color = '#e53e3e';
            title = 'Warning!';
            confirmText = 'Yes, Restart';
        } else if (type === 'info') {
            icon = 'info';
            color = '#667eea';
            title = 'Information';
            confirmText = 'Yes, Sleep';
        }

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 20px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        `;

        dialog.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <span class="material-icons" style="font-size: 48px; color: ${color};">${icon}</span>
                <h3 style="color: #2d3748; margin: 15px 0 10px; font-size: 20px; font-weight: 600;">${title}</h3>
                <p style="color: #718096; font-size: 16px; margin: 0; line-height: 1.5;">${message}</p>
            </div>
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                <button id="modalCancelBtn" style="
                    padding: 12px 24px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #718096;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    flex: 1;
                ">Cancel</button>
                <button id="modalConfirmBtn" style="
                    padding: 12px 24px;
                    border: none;
                    background: ${color};
                    color: white;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    flex: 1;
                ">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        document.getElementById('modalCancelBtn').onclick = () => {
            document.body.removeChild(overlay);
            resolve(false);
        };

        document.getElementById('modalConfirmBtn').onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        };
    });
}

// Show action status
function showActionStatus(message, type, duration = 3000) {
    const statusDiv = document.getElementById('modalActionStatus');
    if (!statusDiv) {
        console.log('modalActionStatus not found');
        return;
    }
    
    statusDiv.className = `action-status ${type}`;
    statusDiv.innerHTML = `<span class="material-icons">${type === 'success' ? 'check_circle' : type === 'info' ? 'info' : 'error'}</span>${message}`;
    
    if (duration > 0) {
        setTimeout(() => {
            statusDiv.className = 'action-status';
            statusDiv.innerHTML = '';
        }, duration);
    }
}

// CLOSE FUNCTION - SIMPLE AND DIRECT
window.closeModal = function() {
    console.log('Closing modal');
    const modal = document.getElementById('deviceDetailModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
    return false;
}

// Open device detail modal
window.openDeviceModal = function(deviceInfo, liveDevice) {
    console.log('Opening modal for device:', deviceInfo);
    
    const modal = document.getElementById('deviceDetailModal');
    if (!modal) {
        console.error('Modal element not found!');
        alert('Modal not found. Please refresh the page.');
        return;
    }
    
    window.currentDevice = { info: deviceInfo, live: liveDevice };
    
    // Initialize stats for this device
    const stats = initDeviceStats(deviceInfo.device_id);
    
    // Update stats if device is online
    if (liveDevice) {
        stats.dataPoints++;
        stats.status = 'online';
        updateDeviceLastSeen(deviceInfo.device_id);
        saveDeviceStats();
    } else {
        stats.status = 'offline';
    }
    
    // Update modal content
    document.getElementById('modalDeviceId').textContent = deviceInfo.device_id;
    document.getElementById('modalFullDeviceId').textContent = deviceInfo.device_id;
    document.getElementById('modalDeviceLocation').textContent = deviceInfo.location || 'Unknown';
    document.getElementById('modalDeviceCoordinates').textContent = 
        `${deviceInfo.latitude?.toFixed(4) || '0'}, ${deviceInfo.longitude?.toFixed(4) || '0'}`;
    document.getElementById('modalDeviceRegistered').textContent = 
        deviceInfo.registered_at ? new Date(deviceInfo.registered_at).toLocaleString() : 'Unknown';
    
    // Update status badge
    const statusBadge = document.getElementById('modalDeviceStatus');
    const statusText = document.getElementById('modalDeviceStatusText');
    const deviceIcon = document.getElementById('modalDeviceIcon');
    const deviceName = document.getElementById('modalDeviceName');
    
    if (deviceName) {
        deviceName.textContent = 'Device Details';
    }
    
    if (liveDevice) {
        if (statusBadge) {
            statusBadge.textContent = 'Online';
            statusBadge.className = 'device-status-badge online';
        }
        if (statusText) statusText.textContent = 'Online';
        if (deviceIcon) deviceIcon.style.color = 'white';
        
        const lastSeenEl = document.getElementById('modalDeviceLastSeen');
        if (lastSeenEl) lastSeenEl.textContent = 'Just now';
        
        const sensorX = document.getElementById('modalSensorX');
        const sensorY = document.getElementById('modalSensorY');
        const sensorZ = document.getElementById('modalSensorZ');
        const sensorG = document.getElementById('modalSensorGForce');
        
        if (sensorX) sensorX.textContent = liveDevice.x_axis?.toFixed(2) || '0.00';
        if (sensorY) sensorY.textContent = liveDevice.y_axis?.toFixed(2) || '0.00';
        if (sensorZ) sensorZ.textContent = liveDevice.z_axis?.toFixed(2) || '0.00';
        if (sensorG) sensorG.textContent = liveDevice.g_force?.toFixed(2) || '0.00';
        
        if (liveDevice.g_force > 1.35) {
            if (statusBadge) {
                statusBadge.textContent = '⚠️ Earthquake';
                statusBadge.className = 'device-status-badge warning';
            }
            if (deviceIcon) deviceIcon.style.color = 'white';
        }
    } else {
        if (statusBadge) {
            statusBadge.textContent = 'Offline';
            statusBadge.className = 'device-status-badge offline';
        }
        if (statusText) statusText.textContent = 'Offline';
        if (deviceIcon) deviceIcon.style.color = 'white';
        
        const lastSeenEl = document.getElementById('modalDeviceLastSeen');
        if (lastSeenEl) {
            lastSeenEl.textContent = stats.lastSeen ? new Date(stats.lastSeen).toLocaleString() : 'Never';
        }
        
        const sensorX = document.getElementById('modalSensorX');
        const sensorY = document.getElementById('modalSensorY');
        const sensorZ = document.getElementById('modalSensorZ');
        const sensorG = document.getElementById('modalSensorGForce');
        
        if (sensorX) sensorX.textContent = '0.00';
        if (sensorY) sensorY.textContent = '0.00';
        if (sensorZ) sensorZ.textContent = '0.00';
        if (sensorG) sensorG.textContent = '0.00';
    }
    
    const actionStatus = document.getElementById('modalActionStatus');
    if (actionStatus) {
        actionStatus.innerHTML = '';
        actionStatus.className = 'action-status';
    }
    
    // Show modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Restart device - UPDATED to communicate with main.py
window.restartDevice = async function() {
    if (!window.currentDevice) {
        showActionStatus('No device selected', 'error');
        return;
    }
    
    const confirmed = await showDeviceConfirmation(
        'Are you sure you want to restart this device?\n\nIt will be offline for a few seconds.',
        'warning'
    );
    
    if (!confirmed) {
        showActionStatus('Restart cancelled', 'info');
        return;
    }
    
    const restartBtn = document.getElementById('restartDeviceBtn');
    if (!restartBtn) return;
    
    const originalText = restartBtn.innerHTML;
    
    restartBtn.disabled = true;
    restartBtn.innerHTML = '<span class="material-icons rotating">refresh</span> Restarting...';
    
    showActionStatus('Restarting device...', 'info', 0);
    
    try {
        // Send restart command to server
        const token = localStorage.getItem('eews_auth_token');
        const response = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/device/restart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                device_id: window.currentDevice.info.device_id
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update stats
            const stats = deviceStats[window.currentDevice.info.device_id];
            if (stats) {
                stats.restarts = (stats.restarts || 0) + 1;
                stats.battery = Math.max(0, stats.battery - 2);
                saveDeviceStats();
            }
            
            showActionStatus('Device restarted successfully!', 'success');
            
            // Vibrate pattern for restart
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        } else {
            showActionStatus('Failed to restart device', 'error');
        }
    } catch (error) {
        console.error('Error restarting device:', error);
        showActionStatus('Network error', 'error');
    } finally {
        restartBtn.disabled = false;
        restartBtn.innerHTML = originalText;
    }
}

// Sleep device - UPDATED to communicate with main.py
window.sleepDevice = async function() {
    if (!window.currentDevice) {
        showActionStatus('No device selected', 'error');
        return;
    }
    
    const confirmed = await showDeviceConfirmation(
        'Put device in sleep mode?\n\nIt will wake up automatically in 30 seconds.',
        'info'
    );
    
    if (!confirmed) {
        showActionStatus('Sleep mode cancelled', 'info');
        return;
    }
    
    const sleepBtn = document.getElementById('sleepDeviceBtn');
    if (!sleepBtn) return;
    
    const originalText = sleepBtn.innerHTML;
    
    sleepBtn.disabled = true;
    sleepBtn.innerHTML = '<span class="material-icons rotating">bedtime</span> Sleeping...';
    
    showActionStatus('Entering sleep mode...', 'info', 0);
    
    try {
        // Send sleep command to server
        const token = localStorage.getItem('eews_auth_token');
        const response = await fetch('https://lolenseu.pythonanywhere.com/pipeline/eews/device/sleep', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                device_id: window.currentDevice.info.device_id,
                duration: 30 // sleep for 30 seconds
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update stats
            const stats = deviceStats[window.currentDevice.info.device_id];
            if (stats) {
                stats.sleeps = (stats.sleeps || 0) + 1;
                stats.battery = Math.max(0, stats.battery - 1);
                saveDeviceStats();
            }
            
            showActionStatus('Device sleeping. Will wake in 30s.', 'success');
            
            // Single vibrate for sleep
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
        } else {
            showActionStatus('Failed to put device to sleep', 'error');
        }
    } catch (error) {
        console.error('Error sleeping device:', error);
        showActionStatus('Network error', 'error');
    } finally {
        sleepBtn.disabled = false;
        sleepBtn.innerHTML = originalText;
    }
}

// Load stats on page load
loadDeviceStats();

// Add click outside to close
document.addEventListener('click', function(event) {
    const modal = document.getElementById('deviceDetailModal');
    if (modal && event.target === modal) {
        window.closeModal();
    }
});

// Add rotating animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes rotating {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .rotating {
        animation: rotating 1s linear infinite;
    }
`;
document.head.appendChild(style);

console.log('Device modal JS loaded');