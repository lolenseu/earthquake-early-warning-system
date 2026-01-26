// API Status Monitor
const API_ENDPOINTS = [
    {
        name: 'Devices List',
        url: 'https://lolenseu.pythonanywhere.com/pipeline/eews/devices_list',
        method: 'GET',
        timeout: 5000
    },
    {
        name: 'Live Devices',
        url: 'https://lolenseu.pythonanywhere.com/pipeline/eews/devices',
        method: 'GET',
        timeout: 5000
    },
    {
        name: 'USGS Earthquake Feed',
        url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&endtime=2024-01-02&minmagnitude=5',
        method: 'GET',
        timeout: 10000
    },
    {
        name: 'OpenStreetMap',
        url: 'https://tile.openstreetmap.org/0/0/0.png',
        method: 'GET',
        timeout: 10000
    }
];

// Ping API endpoint
async function pingAPI(endpoint) {
    const startTime = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);
        
        const response = await fetch(endpoint.url, {
            method: endpoint.method,
            mode: 'cors',
            signal: controller.signal,
            headers: {
                'Accept': '*/*',
                'Cache-Control': 'no-cache'
            }
        });
        
        clearTimeout(timeoutId);
        
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        
        return {
            status: response.ok ? 'online' : 'offline',
            latency: latency,
            statusCode: response.status
        };
    } catch (error) {
        console.error(`Error pinging ${endpoint.name}:`, error);
        return {
            status: 'error',
            latency: 0,
            error: error.message
        };
    }
}

// Create API card HTML
function createAPICard(endpoint, index) {
    const card = document.createElement('div');
    card.className = 'api-card';
    card.id = `api-card-${index}`;
    
    const statusClass = 'offline';
    const statusText = 'Checking...';
    
    card.innerHTML = `
        <div class="api-icon">API</div>
        <div class="api-status-dot ${statusClass}" id="api-dot-${index}"></div>
        <div class="api-info">
            <div class="api-name">
                <span class="api-status-text ${statusClass}" id="api-status-${index}">${statusText}</span>
                ${endpoint.name}
            </div>
            <div class="api-url">${endpoint.url}</div>
            <div class="api-details">
                <div class="api-detail-item">
                    <strong>Method:</strong> ${endpoint.method}
                </div>
                <div class="api-response-time" id="api-response-${index}">Latency: -- ms</div>
            </div>
        </div>
    `;
    
    return card;
}

// Update API card status
function updateAPICard(index, result) {
    const dot = document.getElementById(`api-dot-${index}`);
    const statusText = document.getElementById(`api-status-${index}`);
    const responseText = document.getElementById(`api-response-${index}`);
    
    if (!dot || !statusText || !responseText) return;
    
    // Remove all status classes
    dot.classList.remove('online', 'offline', 'error');
    statusText.classList.remove('online', 'offline', 'error');
    
    // Add new status class
    const statusClass = result.status;
    dot.classList.add(statusClass);
    statusText.classList.add(statusClass);
    
    // Update status text
    if (result.status === 'online') {
        statusText.textContent = 'Online';
        responseText.textContent = `Latency: ${result.latency} ms`;
    } else if (result.status === 'offline') {
        statusText.textContent = 'Offline';
        responseText.textContent = `Status: ${result.statusCode || 'N/A'}`;
    } else {
        statusText.textContent = 'Error';
        responseText.textContent = `Error: ${result.error || 'Unknown'}`;
    }
}

// Check all APIs
async function checkAllAPIs() {
    console.log('Checking all APIs...');
    
    for (let i = 0; i < API_ENDPOINTS.length; i++) {
        const endpoint = API_ENDPOINTS[i];
        const result = await pingAPI(endpoint);
        
        console.log(`${endpoint.name}: ${result.status} (${result.latency}ms)`);
        updateAPICard(i, result);
    }
    
    // Update last updated timestamp
    const lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) {
        lastUpdated.textContent = new Date().toLocaleString();
    }
}

// Initialize API monitor
function initAPIMonitor() {
    console.log('Initializing API Monitor...');
    
    const apiGrid = document.getElementById('apiGrid');
    if (!apiGrid) {
        console.error('apiGrid element not found');
        return;
    }
    
    // Create API cards
    API_ENDPOINTS.forEach((endpoint, index) => {
        const card = createAPICard(endpoint, index);
        apiGrid.appendChild(card);
    });
    
    // Initial check
    checkAllAPIs();
    
    // Check every 10 seconds - use createInterval if available, otherwise fallback
    if (typeof createInterval !== 'undefined') {
        createInterval(checkAllAPIs, 10000);
    } else {
        setInterval(checkAllAPIs, 10000);
    }
    
    console.log('API Monitor initialized');
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the page to load completely
    setTimeout(initAPIMonitor, 100);
});