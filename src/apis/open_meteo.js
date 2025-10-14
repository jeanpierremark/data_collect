const axios = require('axios');
const { influxDB, org } = require('../influxclient');
const villes = require('../villes');
const { Point } = require('@influxdata/influxdb-client');

const bucket = "climate_data_openmeteo";

async function getCoordinates(city) {
  const url = `https://nominatim.openstreetmap.org/search`;

  try {
    const response = await axios.get(url, {
      params: {
        q: `${city}, Senegal`,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'climate-data-platform/1.0 (jeanpierremarktine1612@gmail.com)',
        'Referer': 'http://localhost'
      }
    });

    if (response.data.length === 0) {
      throw new Error(`Aucune coordonnée trouvée pour ${city}`);
    }

    const { lat, lon } = response.data[0];
    return { lat, lon };

  } catch (error) {
    console.error(`Erreur de géocodage pour ${city} :`, error.message);
    throw error;
  }
}

async function recup_ville_open(city) {
  try {
    const { lat, lon } = await getCoordinates(city);
    const url = "https://api.open-meteo.com/v1/forecast";

    const response = await axios.get(url, {
      params: {
        latitude: lat,
        longitude: lon,
        current: "temperature_2m,uv_index,windspeed_10m,apparent_temperature",
        hourly: "relative_humidity_2m,surface_pressure,precipitation,cloudcover,shortwave_radiation",
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration",
        timezone: "auto"
      }
    });

    const data = response.data;
    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;

    if (!current || !hourly?.time?.length || !daily?.time?.length) {
      console.log(`Pas de données météo pour ${city}`);
      return;
    }

    const lastIndex = hourly.time.length - 1;
    const todayIndex = 0; // daily[0] = aujourd'hui

    const humidity = hourly.relative_humidity_2m[lastIndex];
    const pressure = hourly.surface_pressure[lastIndex];
    const precipitation = hourly.precipitation[lastIndex];
    const cloudcover = hourly.cloudcover[lastIndex];
    const radiation = hourly.shortwave_radiation[lastIndex];
    const uv = current.uv_index;

    const dateNow = new Date()
    const jour = dateNow.getDate()
    const heure =dateNow.getHours()

    const point = new Point("meteo")
      .tag("ville", city)
      .intField("temperature", Math.round(current.temperature_2m))
      .intField("temperature_max", Math.round(daily.temperature_2m_max[todayIndex]))
      .intField("temperature_min", daily.temperature_2m_min[todayIndex])
      .intField("humidite", Math.round(humidity))
      .intField("pression", Math.round(pressure))
      .floatField("precipitation", precipitation)
      .intField("vitesse_vent", Math.round(current.windspeed_10m))
      .intField("nebulosite", Math.round(cloudcover))
      .intField("uv_index",Math.round(uv))
      .floatField("rayonnement_solaire", radiation)
      .floatField("ensoleillement", daily.sunshine_duration[todayIndex])
      .timestamp(new Date());

    const writeApi = influxDB.getWriteApi(org, bucket);
    writeApi.writePoint(point);
    await writeApi.flush(); 
    await writeApi.close();
   
    console.log(`Open_meteo ${city}: Temp=${Math.round(current.temperature_2m)}°C | Max=${Math.round(daily.temperature_2m_max[todayIndex])}°C | Min=${Math.round(daily.temperature_2m_min[todayIndex])}°C | Hum=${humidity}% | Pres=${pressure} hPa | Prec=${precipitation} mm | sun=${daily.sunshine_duration[todayIndex]} s | Vent=${current.windspeed_10m} km/h |  UV=${uv} | Nua=${cloudcover}% | Rad=${radiation} W/m² \n`);
  } catch (error) {
    console.error(`Open_meteo Erreur ${city} :`, error.message);
  }
}

async function recup_ville_open_all() {
  for (const ville of villes) {
    await recup_ville_open(ville);
    await new Promise(r => setTimeout(r, 1100));
  }
  
  setTimeout(recup_ville_open_all, 1200000);
   const maintenant = new Date();
  const dans20Minutes = new Date(maintenant.getTime() + 20 * 60 * 1000);
  const heures = dans20Minutes.getHours().toString().padStart(2, '0');
  const minutes = dans20Minutes.getMinutes().toString().padStart(2, '0');
  const heureFormatee = `${heures}:${minutes}`;
  
  console.log('Pause de 20 minutes... Prochaine récupération '+heureFormatee) 
  


}

module.exports = { recup_ville_open_all };
