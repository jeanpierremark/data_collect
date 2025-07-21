require('dotenv').config();
const axios = require('axios');
const villes = require('../villes'); // tableau de noms de villes
const { influxDB, org } = require('../influxclient');
const { Point } = require('@influxdata/influxdb-client');

const bucket = "climate_data_visual";
const apiKey = process.env.VISUALCROSSING_API_KEY;
const BASE_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/weatherdata/forecast";

async function recup_ville_visualcrossing(city) {
  try {
    
    const url = `${BASE_URL}?locations=${encodeURIComponent(city +', Senegal')}&aggregateHours=24&unitGroup=metric&contentType=json&key=${apiKey}`;

    const response = await axios.get(url);
    const locationData = response.data.locations;

    if (!locationData) throw new Error("Pas de données retournées");

   
    const cityKey = Object.keys(locationData)[0];
    const values = locationData[cityKey].values;

    if (!values || values.length === 0) throw new Error("Pas de données météo");

    // Données journalières (1er élément)
    const dayData = values[0];

    const point = new Point('meteo')
      .tag('ville', city)
      .intField('temperature', Math.round(dayData.temp))
      .intField('temperature_min', Math.round(dayData.mint))
      .intField('temperature_max', Math.round(dayData.maxt))
      .intField('humidite', Math.round(dayData.humidity))
      .floatField('precipitation', dayData.precip)
      .intField('vitesse_vent', Math.round(dayData.wspd))
      .intField('uv_index', Math.round(dayData.uvindex))
      .intField("nebulosite", Math.round(dayData.cloudcover))
      .floatField("rayonnement_solaire", dayData.solarradiation)
      .intField('chance_pluie', Math.round(dayData.pop))
      .stringField('condition',dayData.conditions) 
      .timestamp(new Date());

   
    const writeApi = influxDB.getWriteApi(org, bucket);
    writeApi.writePoint(point);
    await writeApi.flush(); 
    await writeApi.close();

    console.log(`VisualCrossing ${city} — Temp: ${Math.round(dayData.temp)}°C | Min: ${Math.round(dayData.mint)}°C | Max: ${Math.round(dayData.maxt)}°C | Hum: ${Math.round(dayData.humidity)}% | Prec: ${dayData.precip} mm | Vent: ${Math.round(dayData.wspd)} km/h | UV: ${Math.round(dayData.uvindex)} | Nua: ${Math.round(dayData.cloudcover)}% | Rad: ${dayData.solarradiation} W/m² | Rain: ${Math.round(dayData.pop)}% | Cond: ${dayData.conditions} \n`);
  } catch (error) {
    console.error(`VisualCrossing erreur pour ${city} :`, error.message);
  }
}

async function recup_ville_all_visualcrossing() {
  for (const ville of villes) {
    await recup_ville_visualcrossing(ville);
    await new Promise(r => setTimeout(r, 1100)); 
  }
  setTimeout(recup_ville_all_visualcrossing, 3600000);
   const maintenant = new Date();
  const dans20Minutes = new Date(maintenant.getTime() + 60 * 60 * 1000);
  const heures = dans20Minutes.getHours().toString().padStart(2, '0');
  const minutes = dans20Minutes.getMinutes().toString().padStart(2, '0');
  const heureFormatee = `${heures}:${minutes}`;
  
  console.log('Pause de 60 minutes... Prochaine récupération '+heureFormatee) 

}

module.exports = { recup_ville_all_visualcrossing };
