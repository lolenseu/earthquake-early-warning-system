// Dashboard data simulation
let totalDevices = 156;
let onlineDevices = 142;
let apiLatency = 45;
let currentWarnings = 3;

// Sample data from API format - Replace URL with actual API endpoint
// API URL: https://your-api-endpoint.com/api/devices/data
// Sample data format:
// { "device_id": "R1-001", "auth_seed": "12345678", "ax": 0.02, "ay": -0.01, "az": 1.03, "total_g": 1.31, "timestamp": 1700000000 }

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

// Sample API data points for demonstration
const sampleApiData = [
    { "device_id": "R1-001", "auth_seed": "12345678", "ax": 0.02, "ay": -0.01, "az": 1.03, "total_g": 1.31, "timestamp": 1700000000 },
    { "device_id": "R1-002", "auth_seed": "87654321", "ax": 0.01, "ay": 0.05, "az": 1.01, "total_g": 1.28, "timestamp": 1700000060 },
    { "device_id": "R1-003", "auth_seed": "11223344", "ax": -0.03, "ay": 0.02, "az": 0.99, "total_g": 1.25, "timestamp": 1700000120 },
    { "device_id": "R1-004", "auth_seed": "44332211", "ax": 0.04, "ay": -0.02, "az": 1.04, "total_g": 1.33, "timestamp": 1700000180 },
    { "device_id": "R1-005", "auth_seed": "55667788", "ax": 0.01, "ay": 0.01, "az": 1.02, "total_g": 1.29, "timestamp": 1700000240 }
];

// Initialize dashboard function - called when dashboard content is loaded
function initDashboard() {
    console.log('Initializing dashboard...');
    
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
            console.log('Dashboard elements not found yet, retrying...');
            setTimeout(updateStats, 100);
            return;
        }
    }

    // Chart configuration
    const metricsChartEl = document.getElementById('metricsChart');
    if (!metricsChartEl) {
        console.log('Chart element not found, retrying...');
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

    // Simulate real-time data updates
    function simulateDataUpdates() {
        // Randomize values slightly
        onlineDevices = Math.max(100, Math.min(160, onlineDevices + Math.floor(Math.random() * 3) - 1));
        apiLatency = Math.max(20, Math.min(100, apiLatency + Math.floor(Math.random() * 10) - 5));
        currentWarnings = Math.max(0, Math.min(10, currentWarnings + Math.floor(Math.random() * 3) - 1));
        
        updateStats();
        
        // Update chart data (only for day view to keep it simple)
        if (currentDataRange === 'day') {
            const now = new Date();
            const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                             now.getMinutes().toString().padStart(2, '0');
            
            chartData.datasets[0].data.push(onlineDevices);
            chartData.datasets[1].data.push(apiLatency);
            chartData.datasets[2].data.push(currentWarnings);
            
            // Remove oldest data point to keep chart clean
            if (chartData.labels.length > 10) {
                chartData.labels.shift();
                chartData.datasets.forEach(dataset => dataset.data.shift());
            }
            
            chartData.labels.push(timeLabel);
            metricsChart.update();
        }
    }

    // Initialize dashboard
    updateStats();

    // Update data every 3 seconds
    setInterval(simulateDataUpdates, 3000);
}

// Auto-initialize dashboard if we're already on the dashboard page
if (window.location.href.includes('dashboard')) {
    setTimeout(initDashboard, 500);
}
