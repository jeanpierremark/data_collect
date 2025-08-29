const axios = require('axios');
const { influxDB, org } = require('../influxclient');
const villes = require('../villes');
const { Point } = require('@influxdata/influxdb-client');

const bucket = 'climate_data_weather';

const coordonnees_villes = {
  'Dakar': { lat: 14.6937, lon: -17.4441 },
  'Thiès': { lat: 14.7886, lon: -16.9262 },
  'Kaolack': { lat: 14.1320, lon: -16.0728 },
  'Saint-Louis': { lat: 16.0199, lon: -16.4896 },
  'Ziguinchor': { lat: 12.5681, lon: -16.2719 },
  'Diourbel': { lat: 14.6542, lon: -16.2357 },
  'Tambacounda': { lat: 13.7671, lon: -13.6681 },
  'Mbour': { lat: 14.4199, lon: -16.9597 },
  'Mboro': { lat: 15.1394, lon: -16.8827 },
  'Kolda': { lat: 12.8939, lon: -14.9407 },
  'Touba': { lat: 14.8500, lon: -15.8833 },
  'Rufisque': { lat: 14.7167, lon: -17.2667 },
  'Richard-Toll': { lat: 16.4667, lon: -15.7000 },
  'Podor': { lat: 16.6515, lon: -14.9591 },
  'Matam': { lat: 15.6556, lon: -13.2553 },
  'Louga': { lat: 15.6181, lon: -16.2265 },
  'Kédougou': { lat: 12.560461, lon: -12.174708 },
  'Fatick': { lat: 14.3347, lon: -16.4123 },
  'Kaffrine': { lat: 14.1058, lon: -15.5500 },
  'Sédhiou': { lat: 12.7081, lon: -15.5567 },
  'Fadiouth': { lat: 14.4208, lon: -16.2356 },
  'Kanel': { lat: 15.9000, lon: -13.0000 },
  'Mekhe': { lat: 16.2333, lon: -15.6833 },
  'Ndioum': { lat: 16.2500, lon: -15.3667 },
  'Velingara': { lat: 13.4667, lon: -14.7667 },
  'Ourossogui': { lat: 15.8833, lon: -13.9333 },
  'Guinguinéo': { lat: 14.3667, lon: -15.5667 },
  'Khombole': { lat: 14.7833, lon: -16.3333 },
  'Bignona': { lat: 12.8167, lon: -16.2333 },
  'Bambey': { lat: 14.7667, lon: -16.4333 },
  'Thiadiaye': { lat: 14.5500, lon: -16.6000 },
  'Sokone': { lat: 14.0667, lon: -16.3833 },
  'Goudomp': { lat: 12.4167, lon: -16.3833 },
  'Gossas': { lat: 14.4667, lon: -16.3333 },
  'Kébémer': { lat: 15.1500, lon: -16.2667 },
  'Dahra': { lat: 15.7000, lon: -15.9000 },
  'Tivaouane': { lat: 14.8500, lon: -16.0500 },
  'Bakel': { lat: 14.8667, lon: -12.5333 },
  'Pout': { lat: 14.8667, lon: -17.1333 },
  'Linguere': { lat: 15.3000, lon: -15.2167 },
  'Koungheul': { lat: 13.7833, lon: -14.1833 },
  'Gandiaye': { lat: 14.3000, lon: -16.2833 },
  'Pikine': { lat: 14.7167, lon: -17.3833 }
};

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

const villesProbleme = [
  "Tambacounda",
  "Kaffrine",
  "Sédhiou",
  "Louga",
  "Matam"
];
async function recup_ville(city, apiKey) {
  try {
    let lat, lon;

    if (villesProbleme.includes(city)) {
     ({ lat, lon } = coordonnees_villes[city]);
    }
   else {
      ({ lat, lon } = await getCoordinates(city));

    }

    const response = await axios.get('http://api.weatherapi.com/v1/forecast.json', {
      params: { key: apiKey, q: `${lat},${lon}`, days: 1, aqi: 'no', alerts: 'no' }
    });

    const current = response.data.current;
    const forecastDay = response.data.forecast.forecastday[0].day;

    let tmp = Math.round(current.temp_c);
    if (tmp > Math.round(forecastDay.maxtemp_c)) {
      tmp = Math.round(forecastDay.maxtemp_c);
    }

    const writeApi = influxDB.getWriteApi(org, bucket);
    const point = new Point('meteo')
      .tag('ville', city)
      .intField('temperature', tmp)
      .intField('temperature_min', Math.round(forecastDay.mintemp_c))
      .intField('temperature_max', Math.round(forecastDay.maxtemp_c))
      .intField('humidite', Math.round(current.humidity))
      .intField('pression', Math.round(current.pressure_mb))
      .floatField('precipitation', current.precip_mm)
      .intField('vitesse_vent', Math.round(current.wind_kph))
      .intField('uv_index', Math.round(current.uv))
      .intField('nebulosite', Math.round(current.cloud))
      .intField('chance_pluie', Math.round(forecastDay.daily_chance_of_rain))
      .stringField('condition', forecastDay.condition.text)
      .stringField('icon', forecastDay.condition.icon)
      .timestamp(new Date());

    writeApi.writePoint(point);
    await writeApi.flush();
    await writeApi.close();

    console.log(`WeatherAPI ${city}: Temp=${tmp}°C | Min=${Math.round(forecastDay.mintemp_c)}°C | Max=${Math.round(forecastDay.maxtemp_c)}°C | Hum=${current.humidity}% | Pres=${current.pressure_mb} hPa | Prec=${current.precip_mm} mm | Vent=${current.wind_kph} km/h | UV=${current.uv} | Nua=${current.cloud}% | rain_chance=${forecastDay.daily_chance_of_rain}% | cond: ${forecastDay.condition.text}\n`);
  } catch (error) {
    if (error.response) {
      console.error(`WeatherAPI erreur pour ${city}:`, error.response.data);
    } else {
      console.error(`WeatherAPI erreur pour ${city}:`, error.message);
    }
  }
}

async function recup_ville_all() {
  const apiKey = process.env.WEATHERAPI_KEY;
  for (const ville of villes) {
    await recup_ville(ville, apiKey);
    await new Promise(r => setTimeout(r, 1100));
  }

  setTimeout(recup_ville_all, 1200000); // 20 minutes
  const maintenant = new Date();
  const dans20Minutes = new Date(maintenant.getTime() + 20 * 60 * 1000);
  const heures = dans20Minutes.getHours().toString().padStart(2, '0');
  const minutes = dans20Minutes.getMinutes().toString().padStart(2, '0');
  const heureFormatee = `${heures}:${minutes}`;

  console.log('Pause de 20 minutes... Prochaine récupération ' + heureFormatee);
}

module.exports = { recup_ville_all };
