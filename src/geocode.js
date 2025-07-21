const NodeGeocoder = require('node-geocoder');

const geocoder = NodeGeocoder({
  provider: 'openstreetmap'
});

async function getCoordinates(city) {
  const results = await geocoder.geocode(`${city}, Senegal`);
  if (results.length === 0) throw new Error(`Ville non trouvée : ${city}`);
  return { lat: results[0].latitude, lon: results[0].longitude };
}

module.exports = { getCoordinates };
