// Dashboard data simulation
let totalDevices = 0;
let onlineDevices = 0;
let apiLatency = 0;
let currentWarnings = 0;
let dashboardRefreshing = false;

// API Configuration
const API_STORAGE_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews';
const API_BASE_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews';
const HISTORICAL_API_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews/historical';

// Live data arrays for real-time chart
let liveData = {
    labels: [],
    onlineDevices: [],
    warnings: [],
    maxDevices: []
};

// API Data for different time ranges
let apiData = {
    day: {
        labels: [],
        datasets: []
    },
    week: {
        labels: [],
        datasets: []
    },
    month: {
        labels: [],
        datasets: []
    }
};

// Initialize live data with current values
function initializeLiveData() {
    liveData.labels = [];
    liveData.onlineDevices = [];
    liveData.warnings = [];
    liveData.maxDevices = [];
    
    // Add initial data point
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    liveData.labels.push(timeLabel);
    liveData.onlineDevices.push(onlineDevices);
    liveData.warnings.push(currentWarnings);
    liveData.maxDevices.push(totalDevices);
}

// Fetch historical data from server with authentication
async function fetchHistoricalData(range) {
    try {
        const token = localStorage.getItem('eews_auth_token');
        
        if (!token) {
            console.log('No auth token found');
            return null;
        }

        const response = await fetch(`${HISTORICAL_API_URL}/${range}`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            console.log(`Failed to fetch ${range} data: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching ${range} data:`, error);
        return null;
    }
}

// Save current data point to historical database
async function saveHistoricalDataPoint() {
    const now = new Date();
    const dataPoint = {
        timestamp: now.toISOString(),
        total_devices: totalDevices,
        online_devices: onlineDevices,
        warnings: currentWarnings,
        latency: apiLatency
    };
    
    try {
        const token = localStorage.getItem('eews_auth_token');
        if (!token) return;

        await fetch(`${HISTORICAL_API_URL}/save`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataPoint)
        });
    } catch (error) {
        console.error('Error saving historical data:', error);
    }
}

// Load historical data for all ranges
async function loadAllHistoricalData() {
    const ranges = ['day', 'week', 'month'];
    
    for (const range of ranges) {
        const data = await fetchHistoricalData(range);
        if (data && data.success) {
            apiData[range] = {
                labels: data.labels || [],
                datasets: data.datasets || []
            };
            console.log(`Loaded ${range} data:`, data);
        }
    }
}

// Fetch total devices
async function fetchTotalDevices() {
    try {
        const response = await fetch(`${API_STORAGE_URL}/devices_list`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            return 0;
        }
        
        const data = await response.json();
        if (data.status === 'success' && data.devices) {
            return data.total_devices || data.devices.length;
        }
        return 0;
    } catch (error) {
        return 0;
    }
}

// Fetch online devices
async function fetchOnlineDevices() {
    const start = performance.now();
    try {
        const response = await fetch(`${API_BASE_URL}/devices`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        const end = performance.now();
        const latency = Math.max(0, Math.round(end - start));

        if (!response.ok) {
            return { count: 0, devices: {}, latency: latency };
        }

        const data = await response.json();
        if (data.status === 'success' && data.devices) {
            const devices = data.devices;
            const count = Object.keys(devices).length;
            return { count: count, devices: devices, latency: latency };
        }

        return { count: 0, devices: {}, latency: latency };
    } catch (error) {
        const end = performance.now();
        const latency = Math.max(0, Math.round(end - start));
        return { count: 0, devices: {}, latency: latency };
    }
}

// Fetch device warnings
async function fetchDeviceWarnings(devices = null) {
    if (devices && typeof devices === 'object') {
        let warningCount = 0;
        Object.values(devices).forEach(device => {
            if (device && device.g_force && device.g_force > 1.2) {
                warningCount++;
            }
        });
        return warningCount;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/devices`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            return 0;
        }

        const data = await response.json();
        if (data.status === 'success' && data.devices) {
            let warningCount = 0;
            Object.values(data.devices).forEach(device => {
                if (device && device.g_force && device.g_force > 1.2) {
                    warningCount++;
                }
            });
            return warningCount;
        }

        return 0;
    } catch (error) {
        return 0;
    }
}

// Ping API for latency
async function pingAPI() {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(`${API_BASE_URL}/devices`, { 
            method: 'GET',
            mode: 'cors',
            signal: controller.signal,
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        clearTimeout(timeoutId);
        const endTime = performance.now();
        return Math.max(0, Math.round(endTime - startTime));
    } catch (error) {
        clearTimeout(timeoutId);
        return 0;
    }
}

// Fetch all live data
async function fetchLiveData() {
    try {
        const [totalSettled, onlineSettled] = await Promise.allSettled([
            fetchTotalDevices(),
            fetchOnlineDevices()
        ]);

        const total = totalSettled.status === 'fulfilled' ? totalSettled.value : 0;

        let online = 0;
        let warnings = 0;
        let latency = 0;

        if (onlineSettled.status === 'fulfilled' && onlineSettled.value) {
            const val = onlineSettled.value;
            online = val.count || 0;
            const devices = val.devices || {};
            latency = val.latency || 0;
            warnings = await fetchDeviceWarnings(devices);
        } else {
            warnings = await fetchDeviceWarnings();
            latency = await pingAPI();
        }

        return {
            totalDevices: total,
            onlineDevices: online,
            warnings: warnings,
            latency: latency
        };
    } catch (error) {
        return {
            totalDevices: 0,
            onlineDevices: 0,
            warnings: 0,
            latency: 0
        };
    }
}

// Update stats cards
function updateStats() {
    const totalDevicesEl = document.getElementById('totalDevices');
    const onlineDevicesEl = document.getElementById('onlineDevices');
    const apiLatencyEl = document.getElementById('apiLatency');
    const currentWarningsEl = document.getElementById('currentWarnings');
    const lastUpdatedEl = document.getElementById('lastUpdated');
    
    if (totalDevicesEl && onlineDevicesEl && apiLatencyEl && currentWarningsEl && lastUpdatedEl) {
        totalDevicesEl.textContent = totalDevices;
        onlineDevicesEl.textContent = onlineDevices;
        apiLatencyEl.textContent = (apiLatency && apiLatency > 0) ? (apiLatency + ' ms') : '--';
        currentWarningsEl.textContent = currentWarnings;
        
        const now = new Date();
        lastUpdatedEl.textContent = now.toLocaleString();
    }
}

// Update chart with new live data
function updateLiveDataChart(metricsChart, newData) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    
    liveData.labels.push(timeLabel);
    liveData.onlineDevices.push(newData.onlineDevices);
    liveData.warnings.push(newData.warnings);
    liveData.maxDevices.push(newData.totalDevices);
    
    if (liveData.labels.length > 20) {
        liveData.labels.shift();
        liveData.onlineDevices.shift();
        liveData.warnings.shift();
        liveData.maxDevices.shift();
    }
    
    if (metricsChart) {
        metricsChart.data.labels = liveData.labels;
        metricsChart.data.datasets[0].data = liveData.onlineDevices;
        metricsChart.data.datasets[1].data = liveData.warnings;
        metricsChart.data.datasets[2].data = liveData.maxDevices;
        metricsChart.options.scales.y.suggestedMax = newData.totalDevices + 5;
        metricsChart.update();
    }
}

// Refresh live dashboard
async function refreshLiveDashboard(metricsChart, currentDataRange) {
    if (window.dashboardRefreshing) return;
    window.dashboardRefreshing = true;

    try {
        const newData = await fetchLiveData();

        if (newData) {
            totalDevices = newData.totalDevices;
            onlineDevices = newData.onlineDevices;
            currentWarnings = newData.warnings;
            apiLatency = newData.latency;

            updateStats();

            if (currentDataRange === 'live') {
                updateLiveDataChart(metricsChart, newData);
            }
            
            if (!window.historicalCounter) window.historicalCounter = 0;
            window.historicalCounter++;
            
            if (window.historicalCounter >= 60) {
                await saveHistoricalDataPoint();
                window.historicalCounter = 0;
                
                if (currentDataRange !== 'live') {
                    await loadAllHistoricalData();
                }
            }
        }
    } catch (error) {
        console.error('Refresh error:', error);
    } finally {
        window.dashboardRefreshing = false;
    }
}

// Main initialization function
async function initDashboard() {
    console.log('Initializing dashboard...');
    
    const metricsChartEl = document.getElementById('metricsChart');
    if (!metricsChartEl) {
        setTimeout(initDashboard, 100);
        return;
    }
    
    const ctx = metricsChartEl.getContext('2d');
    let chartType = 'line';
    let currentDataRange = 'live';
    let metricsChart = null;

    // Check for auth token
    const token = localStorage.getItem('eews_auth_token');
    if (!token) {
        console.log('No auth token found, redirecting to login...');
        window.location.href = './login.html';
        return;
    }

    // Load historical data
    await loadAllHistoricalData();

    // Live chart configuration
    const liveChartConfig = {
        type: chartType,
        data: {
            labels: liveData.labels,
            datasets: [
                {
                    label: 'Online Devices',
                    data: liveData.onlineDevices,
                    borderColor: '#00db5b',
                    backgroundColor: 'rgba(0, 219, 91, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                },
                {
                    label: 'Earthquake Warnings',
                    data: liveData.warnings,
                    borderColor: '#ff416c',
                    backgroundColor: 'rgba(255, 65, 108, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                },
                {
                    label: 'Total Devices (Max)',
                    data: liveData.maxDevices,
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 750 },
            plugins: {
                legend: { position: 'top' },
                title: { display: false }
            },
            scales: {
                y: { beginAtZero: true, suggestedMax: totalDevices + 5 },
                x: { grid: { display: false } }
            }
        }
    };

    // Create initial chart
    metricsChart = new Chart(ctx, liveChartConfig);
    
    if (liveData.labels.length === 0) {
        initializeLiveData();
    }

    // Chart type switching
    const chartButtons = document.querySelectorAll('.chart-controls button');
    if (chartButtons.length > 0) {
        chartButtons.forEach(button => {
            button.addEventListener('click', () => {
                chartButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                chartType = button.dataset.type;
                
                if (metricsChart) {
                    if (currentDataRange === 'live') {
                        metricsChart.config.type = chartType;
                        metricsChart.update();
                    } else {
                        metricsChart.destroy();
                        const historicalConfig = {
                            type: chartType,
                            data: apiData[currentDataRange],
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'top' },
                                    title: { display: false }
                                },
                                scales: {
                                    y: { beginAtZero: true }
                                }
                            }
                        };
                        metricsChart = new Chart(ctx, historicalConfig);
                    }
                }
            });
        });
    }

    // Date range switching
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    if (dateRangeSelect) {
        dateRangeSelect.value = 'live';
        
        dateRangeSelect.addEventListener('change', async () => {
            currentDataRange = dateRangeSelect.value;
            
            if (currentDataRange === 'live') {
                if (metricsChart) metricsChart.destroy();
                metricsChart = new Chart(ctx, liveChartConfig);
                
                if (liveData.labels.length === 0) {
                    initializeLiveData();
                }
            } else {
                if (!apiData[currentDataRange] || !apiData[currentDataRange].labels) {
                    await loadAllHistoricalData();
                }
                
                if (metricsChart) metricsChart.destroy();
                
                const historicalConfig = {
                    type: chartType,
                    data: apiData[currentDataRange],
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: false }
                        },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                };
                
                metricsChart = new Chart(ctx, historicalConfig);
            }
        });
    }

    // Initial data fetch
    const initialData = await fetchLiveData();
    if (initialData) {
        totalDevices = initialData.totalDevices;
        onlineDevices = initialData.onlineDevices;
        currentWarnings = initialData.warnings;
        apiLatency = initialData.latency;
        
        updateStats();
        
        if (currentDataRange === 'live') {
            updateLiveDataChart(metricsChart, initialData);
        }
    }

    // Clear any existing interval
    if (window.dashboardInterval) {
        clearInterval(window.dashboardInterval);
    }

    // Set new interval
    window.dashboardInterval = setInterval(() => {
        refreshLiveDashboard(metricsChart, currentDataRange);
    }, 1000);

    // Run one immediate refresh
    refreshLiveDashboard(metricsChart, currentDataRange);
}

// Make initDashboard globally available
window.initDashboard = initDashboard;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDashboard };
}