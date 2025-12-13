// Dashboard data simulation
let totalDevices = 0;  // Will be updated from API
let onlineDevices = 0; // Will be updated from API
let apiLatency = 0;    // Will be updated from ping
let currentWarnings = 0; // Will be updated from API

// API Configuration
const API_BASE_URL = 'https://lolenseu.pythonanywhere.com/pipeline/eews/v1';
//const API_BASE_URL = 'https://eews-api.vercel.app/pipeline/eews/v1';

// Sample data for different time ranges
const sampleData = {
    day: {
        labels: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
        datasets: [
            {
                label: 'Online Devices',
                data: [135, 134, 133, 132, 134, 136, 138, 140, 142, 141, 140, 139, 140, 141, 142, 141, 140, 139, 138, 137, 138, 139, 141, 142],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'API Latency (ms)',
                data: [50, 49, 48, 47, 48, 46, 45, 44, 45, 46, 47, 48, 42, 43, 45, 44, 43, 44, 46, 47, 48, 46, 45, 45],
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Warning Level',
                data: [2, 2, 2, 1, 1, 1, 2, 2, 2, 3, 3, 2, 1, 2, 2, 1, 1, 2, 2, 3, 3, 2, 2, 2],
                borderColor: '#f093fb',
                backgroundColor: 'rgba(240, 147, 251, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    },
    week: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Online Devices',
                data: [138, 141, 139, 142, 140, 137, 142],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'API Latency (ms)',
                data: [47, 44, 46, 43, 45, 48, 45],
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Warning Level',
                data: [3, 2, 1, 2, 1, 2, 3],
                borderColor: '#f093fb',
                backgroundColor: 'rgba(240, 147, 251, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    },
    month: {
        labels: ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'],
        datasets: [
            {
                label: 'Online Devices',
                data: [140, 138, 139, 141, 142, 140, 142],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'API Latency (ms)',
                data: [45, 46, 44, 45, 43, 44, 45],
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Warning Level',
                data: [2, 1, 2, 1, 1, 2, 1],
                borderColor: '#f093fb',
                backgroundColor: 'rgba(240, 147, 251, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    }
};

// Fetch functions for live data
async function fetchTotalDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/devices_list`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
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
            throw new Error(`HTTP error! status: ${response.status}`);
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
            throw new Error(`HTTP error! status: ${response.status}`);
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
    let currentDataRange = 'day'; // Default to day view

    const chartConfig = {
        type: chartType,
        data: sampleData[currentDataRange],
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

    const metricsChart = new Chart(ctx, chartConfig);

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
        dateRangeSelect.addEventListener('change', () => {
            // Update data range
            currentDataRange = dateRangeSelect.value;
            metricsChart.data = sampleData[currentDataRange];
            metricsChart.update();
        });
    }

    // Update live data from API
    async function updateLiveData() {
        try {
            // Fetch all data concurrently for better performance
            const [total, online, warnings, latency] = await Promise.all([
                fetchTotalDevices(),
                fetchOnlineDevices(),
                fetchDeviceWarnings(),
                pingAPI()
            ]);
            
            totalDevices = total;
            onlineDevices = online;
            currentWarnings = warnings;
            apiLatency = latency;
            
            updateStats();
        } catch (error) {
            console.error('Error updating live data:', error);
        }
    }

    // Full dashboard refresh - updates everything every 1 second
    async function refreshDashboard() {
        try {
            // Fetch all live data
            const [total, online, warnings, latency] = await Promise.all([
                fetchTotalDevices(),
                fetchOnlineDevices(),
                fetchDeviceWarnings(),
                pingAPI()
            ]);
            
            // Update all values
            totalDevices = total;
            onlineDevices = online;
            currentWarnings = warnings;
            apiLatency = latency;
            
            // Update all card values
            updateStats();
            
            // Update chart with new data if needed
            // (For now, keep using sample data for charts)
            metricsChart.update();
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
        }
    }

    // Initialize dashboard
    updateStats();
    
    // Initial live data fetch
    updateLiveData();

    // Refresh entire dashboard every 1 second
    setInterval(refreshDashboard, 1000);
}

// Auto-initialize dashboard if we're already on the dashboard page
if (window.location.href.includes('dashboard')) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initDashboard, 500);
        });
    } else {
        setTimeout(initDashboard, 500);
    }
}
