// Dashboard data simulation
let totalDevices = 0;  // Will be updated from API
let onlineDevices = 0; // Will be updated from API
let apiLatency = 0;    // Will be updated from ping
let currentWarnings = 0; // Will be updated from API

// API Configuration
const API_STORAGE_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews';
const API_BASE_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews';
//const API_BASE_URL = 'https://eews-api.vercel.app/pipeline/eews';

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

// API Data for different time ranges
const apiData = {
    day: {
        labels: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
        datasets: []
    },
    week: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: []
    },
    month: {
        labels: ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'],
        datasets: []
    }
};

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
            const count = Object.keys(data.devices).length;
            return count;
        }
    } catch (error) {
        return 0;
    }
}

async function fetchDeviceWarnings() {
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
                if (device.g_force && device.g_force > 1.2) {
                    warningCount++;
                }
            });
            return warningCount;
        }
    } catch (error) {
        return 0;
    }
}

async function pingAPI() {
    const startTime = performance.now();
    try {
        const response = await fetch(`${API_BASE_URL}/devices`, { 
            method: 'HEAD',
            mode: 'cors',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        return latency;
    } catch (error) {
        return 0;
    }
}

// Initialize dashboard function - called when dashboard content is loaded
function initDashboard() {
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
            apiLatencyEl.textContent = apiLatency + ' ms';
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
    let currentDataRange = 'live'; // Default to live view instead of day

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

    const chartConfig = {
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
        
        dateRangeSelect.addEventListener('change', () => {
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
                chartConfig.data = apiData[currentDataRange];
                metricsChart = new Chart(ctx, chartConfig);
            }
        });
    }

    // Fetch and update all live data
    async function fetchLiveData() {
        try {
            // Fetch all data concurrently for better performance
            const [total, online, warnings, latency] = await Promise.all([
                fetchTotalDevices(),
                fetchOnlineDevices(),
                fetchDeviceWarnings(),
                pingAPI()
            ]);
            
            return {
                totalDevices: total,
                onlineDevices: online,
                warnings: warnings,
                latency: latency
            };
        } catch (error) {
            return null;
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

    // Live dashboard refresh - updates everything every 5 seconds
    async function refreshLiveDashboard() {
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
            }
        } catch (error) {
            // Silent error handling
        }
    }

    // Initialize dashboard
    updateStats();
    
    // Initialize live data
    initializeLiveData();
    
    // Initial data fetch and chart setup
    fetchLiveData().then(newData => {
        if (newData) {
            totalDevices = newData.totalDevices;
            onlineDevices = newData.onlineDevices;
            currentWarnings = newData.warnings;
            apiLatency = newData.latency;
            
            updateStats();
            
            // If already on live view, update the chart
            if (currentDataRange === 'live') {
                updateLiveDataChart(newData);
            }
        }
    });

    // Refresh live dashboard every 1 second
    setInterval(refreshLiveDashboard, 1000);
}

// Only export the initDashboard function for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDashboard };
}
