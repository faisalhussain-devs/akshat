// Mapbox access token - In a real app, this would be stored securely
mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

let map;
let dangerZonesData = null;
let heatmapVisible = true;

// Initialize the map
function initMap() {
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-74.006, 40.7128], // New York City
        zoom: 13
    });

    map.on('load', () => {
        loadDangerZones();
        addMapControls();
    });
}

// Load danger zones data
async function loadDangerZones() {
    try {
        const response = await fetch('./data/danger_zones.json');
        dangerZonesData = await response.json();
        
        addDangerZonesToMap();
        updateStatistics();
    } catch (error) {
        console.error('Error loading danger zones:', error);
        // Fallback to demo data if file doesn't load
        createDemoData();
    }
}

// Create demo data if JSON file fails to load
function createDemoData() {
    dangerZonesData = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "type": "pothole",
                    "severity": "high",
                    "description": "Demo: Large pothole causing vehicle damage",
                    "reports": 23
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [-74.006, 40.7128]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "type": "accident_hotspot",
                    "severity": "critical",
                    "description": "Demo: Intersection with multiple recent accidents",
                    "reports": 67
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [-74.0045, 40.7135]
                }
            }
        ]
    };
    
    addDangerZonesToMap();
    updateStatistics();
}

// Add danger zones to the map
function addDangerZonesToMap() {
    // Add source
    map.addSource('danger-zones', {
        type: 'geojson',
        data: dangerZonesData
    });

    // Add heatmap layer
    map.addLayer({
        id: 'danger-zones-heatmap',
        type: 'heatmap',
        source: 'danger-zones',
        maxzoom: 15,
        paint: {
            'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'reports'],
                0, 0,
                10, 0.5,
                50, 1
            ],
            'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 1,
                15, 3
            ],
            'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(33,102,172,0)',
                0.2, 'rgb(103,169,207)',
                0.4, 'rgb(209,229,240)',
                0.6, 'rgb(253,219,199)',
                0.8, 'rgb(239,138,98)',
                1, 'rgb(178,24,43)'
            ],
            'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 20,
                15, 40
            ],
            'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, 1,
                15, 0.8
            ]
        }
    });

    // Add circle layer for individual points
    map.addLayer({
        id: 'danger-zones-circles',
        type: 'circle',
        source: 'danger-zones',
        minzoom: 12,
        paint: {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 8,
                16, 20
            ],
            'circle-color': [
                'case',
                ['==', ['get', 'severity'], 'critical'], '#ef4444',
                ['==', ['get', 'severity'], 'high'], '#f97316',
                ['==', ['get', 'severity'], 'medium'], '#eab308',
                '#3b82f6'
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });

    // Add labels for danger zones
    map.addLayer({
        id: 'danger-zones-labels',
        type: 'symbol',
        source: 'danger-zones',
        minzoom: 14,
        layout: {
            'text-field': ['get', 'type'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-size': 12
        },
        paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
        }
    });

    // Add click event for popups
    map.on('click', 'danger-zones-circles', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties;
        
        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        const popup = new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
                <div class="p-3">
                    <h3 class="font-bold text-lg capitalize mb-2">${properties.type.replace('_', ' ')}</h3>
                    <p class="text-gray-700 mb-2">${properties.description}</p>
                    <div class="flex justify-between items-center text-sm">
                        <span class="px-2 py-1 rounded text-white ${getSeverityColor(properties.severity)}">
                            ${properties.severity.toUpperCase()}
                        </span>
                        <span class="text-gray-600">${properties.reports} reports</span>
                    </div>
                </div>
            `)
            .addTo(map);
    });

    // Change cursor on hover
    map.on('mouseenter', 'danger-zones-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'danger-zones-circles', () => {
        map.getCanvas().style.cursor = '';
    });
}

// Get severity color class
function getSeverityColor(severity) {
    switch (severity) {
        case 'critical': return 'bg-red-500';
        case 'high': return 'bg-orange-500';
        case 'medium': return 'bg-yellow-500';
        default: return 'bg-blue-500';
    }
}

// Add map controls
function addMapControls() {
    // Add navigation control
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');

    // Add geolocate control
    map.addControl(
        new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
        }),
        'top-left'
    );

    // Toggle heatmap button
    document.getElementById('toggleHeatmap').addEventListener('click', () => {
        heatmapVisible = !heatmapVisible;
        map.setLayoutProperty(
            'danger-zones-heatmap',
            'visibility',
            heatmapVisible ? 'visible' : 'none'
        );
    });

    // Refresh data button
    document.getElementById('refreshData').addEventListener('click', () => {
        loadDangerZones();
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
    });
}

// Update statistics panel
function updateStatistics() {
    if (!dangerZonesData) return;

    const features = dangerZonesData.features;
    const total = features.length;
    
    const severityCounts = features.reduce((acc, feature) => {
        const severity = feature.properties.severity;
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
    }, {});

    document.getElementById('totalHazards').textContent = total;
    document.getElementById('criticalZones').textContent = severityCounts.critical || 0;
    document.getElementById('highRisk').textContent = severityCounts.high || 0;
    document.getElementById('mediumRisk').textContent = severityCounts.medium || 0;
}

// Initialize map when page loads
if (document.getElementById('map')) {
    initMap();
}