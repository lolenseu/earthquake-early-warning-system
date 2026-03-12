// Dashboard data simulation
let totalDevices = 0;  // Will be updated from API
let onlineDevices = 0; // Will be updated from API
let apiLatency = 0;    // Will be updated from ping
let currentWarnings = 0; // Will be updated from API
let dashboardRefreshing = false; // Guard to prevent overlapping refreshes

// API Configuration
const API_STORAGE_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews';
const API_BASE_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews';

// Historical data storage endpoints
const HISTORICAL_API_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews/historical';

// Live data arrays for real-time chart
let liveData = {
    labels: [],
    onlineDevices: [],
    warnings: [],
    maxDevices: []
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

// API Data for different time ranges (will be populated from server)
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

// Fetch historical data from server
async function fetchHistoricalData(range) {
    try {
        const response = await fetch(`${HISTORICAL_API_URL}/${range}`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.log(`Failed to fetch ${range} data`);
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

// Fetch functions for live data
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
            const count = data.total_devices || data.devices.length;
            return count;
        }
    } catch (error) {
        return 0;
    }
}

async function fetchOnlineDevices() {
    // Returns an object { count, devices, latency }
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

async function fetchDeviceWarnings(devices = null) {
    // If devices object is provided, compute warnings directly
    if (devices && typeof devices === 'object') {
        let warningCount = 0;
        Object.values(devices).forEach(device => {
            if (device && device.g_force && device.g_force > 1.2) {
                warningCount++;
            }
        });
        return warningCount;
    }

    // Otherwise, fetch devices and compute
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

async function pingAPI() {
    const startTime = performance.now();

    // Abort if ping takes longer than 3000ms to avoid stalled fetches
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
        const latency = Math.max(0, Math.round(endTime - startTime));
        return latency;
    } catch (error) {
        clearTimeout(timeoutId);
        // Return 0 to indicate unavailable latency
        return 0;
    }
} 

// Initialize dashboard function - called when dashboard content is loaded
async function initDashboard() {
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
            
            // Update last updated time
            const now = new Date();
            lastUpdatedEl.textContent = now.toLocaleString();
        } else {
            setTimeout(updateStats, 100);
            return;
        }
    }

    // Chart configuration
    const metricsChartEl = document.getElementById('metricsChart');
    if (!metricsChartEl) {
        setTimeout(initDashboard, 100);
        return;
    }
    
    const ctx = metricsChartEl.getContext('2d');
    let chartType = 'line';
    let currentDataRange = 'live'; // Default to live view

    // Load historical data from server
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
                    borderDash: [5, 5] // Dashed line for max devices
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: totalDevices + 5
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    };

    // Start with live chart by default
    let metricsChart = new Chart(ctx, liveChartConfig);
    
    // Initialize live data if empty
    if (liveData.labels.length === 0) {
        initializeLiveData();
    }
    
    // Update chart with initial live data
    updateLiveDataChart({
        totalDevices: totalDevices,
        onlineDevices: onlineDevices,
        warnings: currentWarnings,
        latency: apiLatency
    });

    // Chart type switching
    const chartButtons = document.querySelectorAll('.chart-controls button');
    if (chartButtons.length > 0) {
        chartButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                chartButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Update chart type
                chartType = button.dataset.type;
                metricsChart.config.type = chartType;
                metricsChart.update();
            });
        });
    }

    // Date range filter switching
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    if (dateRangeSelect) {
        // Set live as default selection
        dateRangeSelect.value = 'live';
        
        dateRangeSelect.addEventListener('change', async () => {
            // Update data range
            currentDataRange = dateRangeSelect.value;
            
            if (currentDataRange === 'live') {
                // Switch to live chart
                metricsChart.destroy();
                metricsChart = new Chart(ctx, liveChartConfig);
                
                // Initialize live data if empty
                if (liveData.labels.length === 0) {
                    initializeLiveData();
                }
            } else {
                // Switch to historical chart
                metricsChart.destroy();
                
                // Create chart with historical data
                const historicalConfig = {
                    type: chartType,
                    data: apiData[currentDataRange],
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top'
                            },
                            title: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                };
                
                metricsChart = new Chart(ctx, historicalConfig);
            }
        });
    }

    // Fetch and update all live data
    async function fetchLiveData() {
        try {
            // Run total devices and online devices in parallel
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

                // Compute warnings from devices result
                warnings = await fetchDeviceWarnings(devices);
            } else {
                // Online fetch failed; fallback
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
            // Fallback to zeros on unexpected error
            return {
                totalDevices: 0,
                onlineDevices: 0,
                warnings: 0,
                latency: 0
            };
        }
    }

    // Update chart with new live data
    function updateLiveDataChart(newData) {
        const now = new Date();
        const timeLabel = now.toLocaleTimeString();
        
        // Add new data point
        liveData.labels.push(timeLabel);
        liveData.onlineDevices.push(newData.onlineDevices);
        liveData.warnings.push(newData.warnings);
        liveData.maxDevices.push(newData.totalDevices);
        
        // Keep only last 20 data points
        if (liveData.labels.length > 20) {
            liveData.labels.shift();
            liveData.onlineDevices.shift();
            liveData.warnings.shift();
            liveData.maxDevices.shift();
        }
        
        // Update chart
        metricsChart.data.labels = liveData.labels;
        metricsChart.data.datasets[0].data = liveData.onlineDevices;
        metricsChart.data.datasets[1].data = liveData.warnings;
        metricsChart.data.datasets[2].data = liveData.maxDevices;
        
        // Update y-axis max based on current total devices
        metricsChart.options.scales.y.suggestedMax = newData.totalDevices + 5;
        
        metricsChart.update();
    }

    // Live dashboard refresh - updates everything every 1 second
    async function refreshLiveDashboard() {
        // Prevent overlapping runs if the previous fetch hasn't completed
        if (window.dashboardRefreshing) return;
        window.dashboardRefreshing = true;

        try {
            const newData = await fetchLiveData();

            if (newData) {
                // Update global variables
                totalDevices = newData.totalDevices;
                onlineDevices = newData.onlineDevices;
                currentWarnings = newData.warnings;
                apiLatency = newData.latency;

                // Update stats cards
                updateStats();

                // Update live chart if on live view
                if (currentDataRange === 'live') {
                    updateLiveDataChart(newData);
                }
                
                // Save to historical database every minute (every 60 refreshes)
                // Using a counter to track time
                if (!window.historicalCounter) window.historicalCounter = 0;
                window.historicalCounter++;
                
                if (window.historicalCounter >= 60) { // ~1 minute at 1 second intervals
                    await saveHistoricalDataPoint();
                    window.historicalCounter = 0;
                    
                    // Reload historical data for other views
                    if (currentDataRange !== 'live') {
                        await loadAllHistoricalData();
                    }
                }
            }
        } catch (error) {
            // Silent error handling
        } finally {
            // Allow the next refresh to run
            window.dashboardRefreshing = false;
        }
    }

    // Initialize dashboard
    updateStats();
    
    // Initialize live data
    initializeLiveData();
    
    // Initial data fetch and chart setup
    const initialData = await fetchLiveData();
    if (initialData) {
        totalDevices = initialData.totalDevices;
        onlineDevices = initialData.onlineDevices;
        currentWarnings = initialData.warnings;
        apiLatency = initialData.latency;
        
        updateStats();
        
        // If already on live view, update the chart
        if (currentDataRange === 'live') {
            updateLiveDataChart(initialData);
        }
    }

    // Refresh live dashboard every 1 second
    if (window.dashboardInterval) {
        clearInterval(window.dashboardInterval);
        const idx = runningIntervals.indexOf(window.dashboardInterval);
        if (idx !== -1) runningIntervals.splice(idx, 1);
    }

    window.dashboardInterval = setInterval(refreshLiveDashboard, 1000);
    runningIntervals.push(window.dashboardInterval);

    // Run one immediate refresh
    refreshLiveDashboard();
}

// Only export the initDashboard function for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDashboard };
}