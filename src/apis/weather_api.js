const axios = require('axios');
const { influxDB, org } = require('../influxclient');
const villes = require('../villes');
const { Point } = require('@influxdata/influxdb-client');

const bucket = 'climate_data_weather';

async function recup_ville(city, apiKey) {
  try {
    const response = await axios.get('http://api.weatherapi.com/v1/forecast.json', {
      params: { key: apiKey, q: `${city}, Senegal`, days: 1, aqi: 'no', alerts: 'no' }
    });

    const current = response.data.current;
    const forecastDay = response.data.forecast.forecastday[0].day;
    
    tmp = Math.round(current.temp_c)
    if (Math.round(current.temp_c) > Math.round(forecastDay.maxtemp_c) ){
      tmp = Math.round(forecastDay.maxtemp_c)
    }

    const writeApi = influxDB.getWriteApi(org, bucket);
    
    const point = new Point('meteo')
      .tag('ville', city)
      .intField('temperature',tmp)
      .intField('temperature_min', Math.round(forecastDay.mintemp_c))
      .intField('temperature_max', Math.round(forecastDay.maxtemp_c))
      .intField('humidite', Math.round(current.humidity))
      .intField('pression', Math.round(current.pressure_mb))
      .floatField('precipitation', current.precip_mm)
      .intField('vitesse_vent', Math.round(current.wind_kph))
      .intField('uv_index', Math.round(current.uv))
      .intField('nebulosite', Math.round(current.cloud))
      .intField('chance_pluie', Math.round(forecastDay.daily_chance_of_rain))
      .stringField('condition',forecastDay.condition.text) 
      .stringField('icon',forecastDay.condition.icon)
      .timestamp(new Date());

    writeApi.writePoint(point);
    await writeApi.flush(); 
    await writeApi.close();

    console.log(`WeatherAPI ${city}: Temp=${tmp}°C | Min=${Math.round(forecastDay.mintemp_c)}°C | Max=${Math.round(forecastDay.maxtemp_c)}°C | Hum=${current.humidity}% | Pres=${current.pressure_mb} hPa | Prec=${current.precip_mm} mm | Vent=${current.wind_kph} km/h | UV=${current.uv} | Nua=${current.cloud}% |  rain_chance=${forecastDay.daily_chance_of_rain}% | cond: ${forecastDay.condition.text} \n`);
 
  } catch (error) {
    console.error(`WeatherAPI erreur pour ${city}:`, error.message);
  }
}

async function recup_ville_all() {
  const apiKey = process.env.WEATHERAPI_KEY;
  for (const ville of villes) {
    await recup_ville(ville, apiKey);
    await new Promise(r => setTimeout(r, 1100));
  }
  setTimeout(recup_ville_all, 1200000);

  const maintenant = new Date();
  const dans20Minutes = new Date(maintenant.getTime() + 20 * 60 * 1000);
  const heures = dans20Minutes.getHours().toString().padStart(2, '0');
  const minutes = dans20Minutes.getMinutes().toString().padStart(2, '0');
  const heureFormatee = `${heures}:${minutes}`;
  
  console.log('Pause de 20 minutes... Prochaine récupération '+heureFormatee) 
}

module.exports = { recup_ville_all };
