const { recup_ville_all_visualcrossing: VisualCrossing } = require('./src/apis/visual_crossing');
const { recup_ville_open_all: OpenMeteo } = require('./src/apis/open_meteo');
const { recup_ville_all: WeatherAPI } = require('./src/apis/weather_api');

async function runAllAPIs() {

  console.log("Récupération des données météo depuis WeatherAPI\n");
  await WeatherAPI();
  console.log("Récupération des données météo depuis OpenMeteo\n");
  await OpenMeteo();
  console.log("Récupération des données météo depuis VisualCrossing\n");
  await VisualCrossing();

}

runAllAPIs();
