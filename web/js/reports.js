// Build date strings
function getDateRange(range) {
    const now = new Date();
    let start = new Date();

    if (range === 'day') start.setDate(now.getDate() - 1);
    if (range === 'week') start.setDate(now.getDate() - 7);
    if (range === 'month') start.setMonth(now.getMonth() - 1);

    return {
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
    };
}

let map = null;
let quakeMarkers = [];

// Setup Leaflet map
function initReportMap() {
    console.log('initReportMap called');
    
    // Check if Leaflet is available
    console.log('Leaflet global variable:', typeof L);
    if (typeof L === 'undefined') {
        console.error('Leaflet is not loaded');
        return;
    }
    
    console.log('Leaflet is available, checking container...');
    if (!document.getElementById('reportmapid')) {
        console.error('Map container not found');
        return;
    }
    
    console.log('Map container found, initializing...');
    
    try {
        map = L.map('reportmapid').setView([12.8797, 121.7740], 6);
        console.log('Map object created:', map);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        console.log('Report Map initialized successfully');
        
        // Attach button listeners after map is initialized
        attachButtonListeners();
        loadQuakes('day');
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Fetch and display quakes
async function loadQuakes(range) {
    if (!map) {
        console.error('Map not initialized');
        return;
    }
    
    console.log('Loading quakes for range:', range);
    
    // Get the date range
    const dates = getDateRange(range);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${dates.start}&endtime=${dates.end}&minmagnitude=0`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        // Clear old markers
        quakeMarkers.forEach(m => map.removeLayer(m));
        quakeMarkers = [];
        const quakeList = document.getElementById('quakeList');
        if (quakeList) {
            quakeList.innerHTML = '';
        }

        console.log('Quake data received:', data.features.length, 'features');

        data.features.forEach(eq => {
            const coords = eq.geometry.coordinates;
            const props = eq.properties;
            const [lng, lat, depth] = coords;
            const mag = props.mag;
            const place = props.place;
            const time = new Date(props.time).toLocaleString();
            const quakeId = `quake-${eq.id}`;

            // Format magnitude and depth to 1 decimal place
            const formattedMag = mag ? mag.toFixed(1) : '0.0';
            const formattedDepth = depth ? depth.toFixed(1) : '0.0';

            // Add marker
            const marker = L.circleMarker([lat, lng], {
                radius: 5 + (mag || 0),
                fillColor: mag >= 5 ? 'red' : mag >= 3 ? 'orange' : 'blue',
                color: '#000',
                weight: 1,
                fillOpacity: 0.7
            }).addTo(map);

            marker.bindPopup(`<b>${place}</b><br>Mag: ${formattedMag}<br>Depth: ${formattedDepth} km<br>${time}`);
            quakeMarkers.push(marker);

            // Add to list with click functionality
            if (quakeList) {
                const listEl = document.createElement('div');
                listEl.className = 'quake-list-item';
                listEl.id = quakeId;
                listEl.innerHTML = `
                    <div class="quake-item-content">
                        <div class="quake-mag">${formattedMag}</div>
                        <div class="quake-info">
                            <div class="quake-place">${place}</div>
                            <div class="quake-details">Depth: ${formattedDepth} km • ${time}</div>
                        </div>
                        <div class="quake-actions">
                            <button class="locate-btn" onclick="locateQuake('${eq.id}', ${lat}, ${lng}, ${mag})" title="Locate on map">
                                📍
                            </button>
                        </div>
                    </div>
                `;
                
                // Add click event to the entire item
                listEl.addEventListener('click', () => {
                    locateQuake(eq.id, lat, lng, mag);
                });
                
                quakeList.appendChild(listEl);
            }
        });

        const lastUpdated = document.getElementById('lastUpdated');
        if (lastUpdated) {
            lastUpdated.innerText = new Date().toLocaleString();
        }

        console.log('Quakes loaded successfully');

    } catch (err) {
        console.error('Error loading quakes:', err);
    }
}

// Locate earthquake on map
function locateQuake(quakeId, lat, lng, mag) {
    if (!map) {
        console.error('Map not initialized');
        return;
    }
    
    console.log('Locating earthquake:', quakeId, 'at', lat, lng);
    
    // Zoom to earthquake location with appropriate zoom level based on magnitude
    const zoomLevel = mag >= 6 ? 8 : mag >= 4 ? 9 : mag >= 2 ? 10 : 11;
    
    map.setView([lat, lng], zoomLevel);
    
    // Find and highlight the marker
    const marker = quakeMarkers.find(m => {
        const markerLatLng = m.getLatLng();
        return markerLatLng.lat === lat && markerLatLng.lng === lng;
    });
    
    if (marker) {
        // Temporarily highlight the marker
        marker.setStyle({
            radius: 15,
            fillColor: '#ff0000',
            color: '#ff0000',
            weight: 3
        });
        
        // Reset style after 2 seconds
        setTimeout(() => {
            const mag = marker._mRadius ? marker._mRadius : 5;
            marker.setStyle({
                radius: 5 + mag,
                fillColor: mag >= 5 ? 'red' : mag >= 3 ? 'orange' : 'blue',
                color: '#000',
                weight: 1,
                fillOpacity: 0.7
            });
        }, 2000);
        
        // Open popup
        marker.openPopup();
    }
    
    // Highlight the list item
    const listItem = document.getElementById(`quake-${quakeId}`);
    if (listItem) {
        // Remove existing highlights
        document.querySelectorAll('.quake-list-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add highlight to current item
        listItem.classList.add('active');
        
        // Scroll to the item
        listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Attach button filters
function attachButtonListeners() {
    console.log('Attaching button listeners...');
    const buttons = document.querySelectorAll('.report-filters button');
    if (buttons.length === 0) {
        console.error('Filter buttons not found');
        return;
    }
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadQuakes(btn.dataset.range);
        });
    });
    
    console.log('Button listeners attached');
}

// DO NOT add DOMContentLoaded listener here - let script.js handle initialization
