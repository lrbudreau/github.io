const fs = require('fs');
const XLSX = require('xlsx');

// Load the Excel file
const workbook = XLSX.readFile('./data/parking.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

const features = [];

rows.forEach(row => {
  const coordinates = JSON.parse(row.coordinates); // expects valid JSON string
  const type = row.type.startsWith('[') ? JSON.parse(row.type) : [row.type];

  features.push({
    type: "Feature",
    properties: {
      name: row.name,
      type: type,
      free: row.free.toString().toLowerCase() === 'true',
      address: row.address
    },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates]
    }
  });
});

const geojson = {
  type: "FeatureCollection",
  features: features
};

fs.writeFileSync('./data/parking_lots.geojson', JSON.stringify(geojson, null, 2));
console.log('GeoJSON file created!');
