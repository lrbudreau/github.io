$(document).ready(function () {
  $('#building').select2({
    placeholder: "-- Select Building --",
    allowClear: true,
  });

  // Initialize the map at Purdue coordinates
  const map = L.map('map').setView([40.4237, -86.9212], 15);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Add legend control
  const legendControl = L.control({ position: 'bottomleft' });
  legendControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    div.id = 'legend';
    return div;
  };
  legendControl.addTo(map);
  const legendDiv = document.getElementById('legend');

  // Add demo traffic layer
  L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution: 'Traffic demo tiles',
    opacity: 0.3
  }).addTo(map);

  const passTypeSelect = document.getElementById('passType');
  const noLotsMessage = document.getElementById('noLotsMessage');
  const buildingSelect = document.getElementById('building');

  const typeSet = new Set();
  let allParkingLayers = [];
  const colorPalette = {};

  const generateColor = (function () {
    const colors = [
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
      "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
      "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5",
      "#c49c94", "#f7b6d2", "#c7c7c7", "#dbdb8d", "#9edae5"
    ];
    let index = 0;
    return function (type) {
      if (!colorPalette[type]) {
        colorPalette[type] = colors[index % colors.length];
        index++;
      }
      return colorPalette[type];
    };
  })();

  function getLotStyle(lotPerm) {
    const types = lotPerm ? lotPerm.split(/[,\s]+/).map(t => t.trim()).filter(Boolean) : [];
    const mainType = types.length > 0 ? types[0] : 'Other';
    const color = generateColor(mainType) || '#888888';
    return {
      color: '#000000',
      weight: 1,
      fillColor: color,
      fillOpacity: 0.4
    };
  }

  function updateLegend() {
    legendDiv.innerHTML = '<strong>Legend:</strong><br>';
    const sortedTypes = Array.from(typeSet).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

    sortedTypes.forEach(type => {
      const color = generateColor(type);
      const item = document.createElement('div');
      item.className = 'legend-entry';

      const span = document.createElement('span');
      span.className = 'legend-item';
      span.style.backgroundColor = color;

      const label = document.createElement('span');
      label.textContent = ` ${type}`;

      item.appendChild(span);
      item.appendChild(label);
      legendDiv.appendChild(item);
    });
  }

  noLotsMessage.style.display = 'none';

  L.esri
    .featureLayer({
      url: 'https://services1.arcgis.com/mLNdQKiKsj5Z5YMN/arcgis/rest/services/Parking2020/FeatureServer/0'
    })
    .query()
    .where('1=1')
    .run((error, featureCollection) => {
      if (error) {
        console.error('Error loading parking data:', error);
        return;
      }

      allParkingLayers = [];
      typeSet.clear();

      if (featureCollection.features.length > 0) {
        const geojsonLayer = L.geoJSON(featureCollection.features, {
          style: feature => getLotStyle(feature.properties.LOT_PERM),
          onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const types = props.LOT_PERM
              ? props.LOT_PERM.split(/[,\s]+/).map(t => t.trim()).filter(Boolean)
              : ['Other'];

            types.forEach(t => typeSet.add(t));

            const center = layer.getBounds().getCenter();
            const googleMapsURL = `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`;

            layer.bindPopup(`
              <b>${props.LOT_NAME || 'Parking Lot'}</b><br>
              Type: ${types.join(', ')}<br>
              Description: ${props.LotDesc || 'Not Available'}<br>
              <a href="${googleMapsURL}" target="_blank" rel="noopener">Get Directions</a>
            `);

            layer.on('click', () => layer.openPopup());
            layer.on('mouseover', () => layer.bringToFront());

            allParkingLayers.push(layer);
          }
        }).addTo(map);
      }

      const sortedTypes = Array.from(typeSet).sort();
      passTypeSelect.innerHTML = '';
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = '-- All --';
      passTypeSelect.appendChild(allOption);

      sortedTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        passTypeSelect.appendChild(option);
      });

      updateLegend();
      filterParking();
    });

  fetch('data/construction.geojson')
    .then(res => res.json())
    .then(data => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filteredFeatures = data.features.filter(feature => {
        const endDateStr = feature.properties.endDate;
        if (!endDateStr) return true;
        const endDate = new Date(endDateStr);
        return endDate >= today;
      });

      L.geoJSON({
        type: "FeatureCollection",
        features: filteredFeatures
      }, {
        style: {
          color: 'red',
          weight: 3,
          dashArray: '5,5',
          fillOpacity: 0.2
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          layer.bindPopup(`<b>Construction:</b> ${p.name}<br>Expected until: ${p.endDate}`);
        }
      }).addTo(map);
    });

  let buildingLayer = null;
  let selectedBuildingAbbr = null;
  let buildingFeatures = [];

  buildingLayer = L.esri.featureLayer({
    url: 'https://services1.arcgis.com/mLNdQKiKsj5Z5YMN/arcgis/rest/services/Export_Output106/FeatureServer/0',
    style: feature => {
      const abbr = feature.properties.BLDG_ABBR;
      const isSelected = abbr === selectedBuildingAbbr;
      return {
        color: isSelected ? '#0000ff' : '#666',
        weight: isSelected ? 2 : 0.5,
        opacity: isSelected ? 1 : 0.6
      };
    },
    onEachFeature: (feature, layer) => {
      buildingFeatures.push({ feature, layer });
    }
  }).addTo(map);

  buildingLayer.on('load', () => {
    buildingSelect.innerHTML = '';
    const sorted = buildingFeatures
      .map(b => b.feature)
      .filter(f => f.properties.BLDG_ABBR && f.properties.BUILDING_N)
      .sort((a, b) => a.properties.BLDG_ABBR.localeCompare(b.properties.BLDG_ABBR));

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select Building --';
    buildingSelect.appendChild(defaultOpt);

    const maxLength = 35;

    sorted.forEach(feature => {
      const abbr = feature.properties.BLDG_ABBR;
      const name = feature.properties.BUILDING_N;
      const option = document.createElement('option');
      option.value = abbr;
      const displayName = `(${abbr}) ${name}`;
      option.title = displayName;
      option.textContent = displayName.length > maxLength
        ? displayName.slice(0, maxLength) + '…'
        : displayName;
      buildingSelect.appendChild(option);
    });
      document.getElementById('building')?.addEventListener('change', buildingChanged);
  });

  function getDistance(latlng1, latlng2) {
    return map.distance(latlng1, latlng2);
  }

  function filterParking() {
    const selectedType = passTypeSelect.value;
    const selectedAbbr = buildingSelect.value;

    let visibleCount = 0;
    let buildingCenter = null;

    if (selectedAbbr && buildingLayer) {
      buildingLayer.eachFeature(layer => {
        const props = layer.feature?.properties;
        if (props?.BLDG_ABBR === selectedAbbr) {
          buildingCenter = layer.getBounds().getCenter();
        }
      });
    }

    let visibleLayers = [];

    allParkingLayers.forEach(layer => {
      const props = layer.feature?.properties;
      const types = props?.LOT_PERM
        ? props.LOT_PERM.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
        : ['Other'];

      let visible = true;

      if (selectedType && !types.includes(selectedType)) {
        visible = false;
      }

      if (visible) {
        visibleLayers.push(layer);
      } else {
        map.removeLayer(layer);
      }
    });

    if (buildingCenter) {
      visibleLayers.sort((a, b) => {
        const aCenter = a.getBounds().getCenter();
        const bCenter = b.getBounds().getCenter();
        return getDistance(buildingCenter, aCenter) - getDistance(buildingCenter, bCenter);
      });
    }

    visibleLayers.forEach(layer => {
      map.addLayer(layer);
      visibleCount++;
    });

    noLotsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
  }

  const handicapIcon = L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/svgs/solid/wheelchair.svg',
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -20]
  });

  let handicapLayer = null;
  handicapLayer = omnivore.kml('https://purdueuniversity.maps.arcgis.com/sharing/rest/content/items/13158cca51cf4190aaa002bde42f816d/data')
    .on('ready', function () {
      this.eachLayer(function (layer) {
        if (layer instanceof L.Marker) {
          layer.setIcon(handicapIcon);
          layer.bindPopup('Handicap Accessible Parking');
        }
      });
    })
    .addTo(map);


function buildingChanged() {
  const selectedAbbr = buildingSelect.value;
  selectedBuildingAbbr = selectedAbbr || null;

  if (!selectedAbbr) {
    map.setView([40.4237, -86.9212], 15);
  } else {
    const item = buildingFeatures.find(b => b.feature.properties.BLDG_ABBR === selectedAbbr);
    if (item && item.layer) {
      const bounds = item.layer.getBounds();
      const padding = window.innerWidth > 768 ? [200, 200] : [100, 100];
      map.fitBounds(bounds, { padding });
    }
    console.log('clicked');
  }

  // Force style update to highlight selected
  buildingLayer.setStyle(buildingLayer.options.style);
  filterParking();
}

  function toggleHandicapParking() {
    const show = document.getElementById('handicapToggle').checked;
    if (handicapLayer) {
      if (show) {
        map.addLayer(handicapLayer);
      } else {
        map.removeLayer(handicapLayer);
      }
    }
  }
  
  // Bind event listeners after defining functions
  passTypeSelect.addEventListener('change', filterParking);
  document.getElementById('handicapToggle')?.addEventListener('change', toggleHandicapParking);
});

