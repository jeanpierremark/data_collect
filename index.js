const { recup_ville_all_visualcrossing: VisualCrossing } = require('./src/apis/visual_crossing');
const { recup_ville_open_all: OpenMeteo } = require('./src/apis/open_meteo');
const { recup_ville_all: WeatherAPI } = require('./src/apis/weather_api');
const { recup_ville_all_weather: OpenWeather} =require('./src/apis/open_weather');

async function runAllAPIs() {

  console.log("Récupération des données météo depuis WeatherAPI\n");
  await WeatherAPI();
  console.log("Récupération des données météo depuis Open Meteo\n");
  await OpenMeteo();
  console.log("Récupération des données météo depuis Open Weather\n");
  await OpenWeather();
  /*console.log("Récupération des données météo depuis VisualCrossing\n");
  await VisualCrossing();*/


}

runAllAPIs();
