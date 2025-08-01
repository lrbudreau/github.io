// Initialize map
var map = L.map('map').setView([40.4237, -86.9212], 15); // Purdue coords

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

let parkingLots = []; // Will hold GeoJSON data

fetch('data/parking_lots.geojson')
    .then(response => response.json())
    .then(data => {
        parkingLots = L.geoJSON(data, {
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`<b>${feature.properties.name}</b><br>Type: ${feature.properties.type}`);
            }
        }).addTo(map);
    });

function filterParking() {
    const passType = document.getElementById('passType').value;
    const freeOnly = document.getElementById('freeOnly').checked;
    const visitTime = document.getElementById('visitTime').value;

    parkingLots.eachLayer(layer => {
        const props = layer.feature.properties;
        let visible = true;

        if (freeOnly && props.type !== "Free") visible = false;
        if (passType && props.allowed_passes.indexOf(passType) === -1) visible = false;

        // Optional: use visitTime to predict availability

        if (visible) {
            layer.setStyle({ fillColor: 'green', fillOpacity: 0.6 });
        } else {
            layer.setStyle({ fillColor: 'gray', fillOpacity: 0.2 });
        }
    });
}
