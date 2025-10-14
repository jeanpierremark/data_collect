const axios = require('axios');
const { influxDB, org } = require('../influxclient');
const villes = require('../villes');
const { Point } = require('@influxdata/influxdb-client');

const bucket = 'climate_data_openweather';

// Coordonnées des principales villes du Sénégal
const coordonnees_villes = {
  'Dakar': { lat: 14.6937, lon: -17.4441 },
  'Thiès': { lat: 14.7886, lon: -16.9262 },
  'Kaolack': { lat: 14.1320, lon: -16.0728 },
  'Saint-Louis': { lat: 16.0199, lon: -16.4896 },
  'Ziguinchor': { lat: 12.5681, lon: -16.2719 },
  'Diourbel': { lat: 14.6542, lon: -16.2357 },
  'Tambacounda': { lat: 13.7671, lon: -13.6681 },
  'Mbour': { lat: 14.4199, lon: -16.9597 },
  'Kolda': { lat: 12.8939, lon: -14.9407 },
  'Touba': { lat: 14.8500, lon: -15.8833 },
  'Rufisque': { lat: 14.7167, lon: -17.2667 },
  'Richard-Toll': { lat: 16.4667, lon: -15.7000 },
  'Podor': { lat: 16.6515, lon: -14.9591 },
  'Matam': { lat: 15.6556, lon: -13.2553 },
  'Louga': { lat: 15.6181, lon: -16.2265 },
  'Kédougou': { lat: 12.5561, lon: -12.1756 },
  'Fatick': { lat: 14.3347, lon: -16.4123 },
  'Kaffrine': { lat: 14.1058, lon: -15.5500 },
  'Sédhiou': { lat: 12.7081, lon: -15.5567 }
};

async function recup_ville(city, apiKey) {
  try {
    let currentResponse = null;
    let forecastResponse = null;
    
    // Priorité aux coordonnées si disponibles
    if (coordonnees_villes[city]) {
      const { lat, lon } = coordonnees_villes[city];
      try {
        currentResponse = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { 
            lat: lat,
            lon: lon,
            appid: apiKey, 
            units: 'metric',
            lang: 'fr'
          }
        });

        forecastResponse = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
          params: { 
            lat: lat,
            lon: lon,
            appid: apiKey, 
            units: 'metric',
            lang: 'fr'
          }
        });
        
        console.log(`✓ ${city} trouvée avec coordonnées (${lat}, ${lon})`);
        
      } catch (coordErr) {
        console.log(`Échec avec coordonnées pour ${city}, essai avec nom...`);
      }
    }
    
    // Si pas de coordonnées ou échec, essayer avec les noms
    if (!currentResponse || !forecastResponse) {
      const cityVariations = [
        `${city}, SN`,
        `${city}, Senegal`,
        city,
        `${city}, Sénégal`
      ];
      
      for (const cityQuery of cityVariations) {
        try {
          currentResponse = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
            params: { 
              q: cityQuery, 
              appid: apiKey, 
              units: 'metric',
              lang: 'fr'
            }
          });

          forecastResponse = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
            params: { 
              q: cityQuery, 
              appid: apiKey, 
              units: 'metric',
              lang: 'fr'
            }
          });
          
          break;
          
        } catch (err) {
          if (err.response?.status === 404) {
            continue;
          } else {
            throw err;
          }
        }
      }
    }
    
    // Si aucune méthode n'a fonctionné
    if (!currentResponse || !forecastResponse) {
      throw new Error(`Ville "${city}" introuvable avec toutes les méthodes testées`);
    }

    const current = currentResponse.data;
    const forecast = forecastResponse.data;
    
    // Calcul des températures min/max pour la journée actuelle uniquement
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    // Filtrer les prévisions pour la journée actuelle seulement
    const todayForecasts = forecast.list.filter(item => {
      const forecastTime = new Date(item.dt * 1000);
      return forecastTime >= startOfDay && forecastTime <= endOfDay;
    });
    
 
  
    // Calcul de la chance de pluie pour la journée actuelle
    let chanceOfRain = 0;
    if (todayForecasts.length > 0) {
      const rainForecasts = todayForecasts.filter(f => 
        f.weather[0].main === 'Rain' || 
        f.weather[0].main === 'Drizzle' ||
        f.weather[0].main === 'Thunderstorm'
      );
      chanceOfRain = Math.round((rainForecasts.length / todayForecasts.length) * 100);
    }

    // Calcul des précipitations (dernière heure ou 3h selon disponibilité)
    let precipitation = 0;
    if (current.rain) {
      precipitation = current.rain['1h'] || current.rain['3h'] || 0;
    }

    const writeApi = influxDB.getWriteApi(org, bucket);

    const dateNow = new Date();
    const jour = dateNow.getDate(); 
    const heure =dateNow.getHours()

    
    const point = new Point('meteo')
      .tag('ville', city)
      .intField('temperature', current.main.temp)
      .intField('humidite', Math.round(current.main.humidity))
      .intField('pression', Math.round(current.main.pressure))
      .floatField('precipitation', precipitation)
      .intField('vitesse_vent', Math.round(current.wind.speed * 3.6)) 
      .intField('nebulosite', Math.round(current.clouds.all))
      .intField('chance_pluie', chanceOfRain)
      .stringField('condition', current.weather[0].description)
      .stringField('icon', `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`)
      .timestamp(new Date());

    writeApi.writePoint(point);
    await writeApi.flush(); 
    await writeApi.close();
  
    console.log(`OpenWeatherMap ${city}: Temp=${current.main.temp}°C |  Hum=${current.main.humidity}% | Pres=${current.main.pressure} hPa | Prec=${precipitation} mm | Vent=${Math.round(current.wind.speed * 3.6)} km/h | UV=N/A | Nua=${current.clouds.all}% | rain_chance=${chanceOfRain}% | cond: ${current.weather[0].description}\n`);
 
  } catch (error) {
    console.error(`OpenWeatherMap erreur pour ${city}:`, error.message);
  }
}

async function recup_ville_all_weather() {
  const apiKey = process.env.OPENWEATHER_KEY;
  for (const ville of villes) {
    await recup_ville(ville, apiKey);
    await new Promise(r => setTimeout(r, 1100)); // Respecte la limite de 60 appels/minute
  }
   
  setTimeout(recup_ville_all_weather, 1200000); // 20 minutes

  const maintenant = new Date();
  const dans20Minutes = new Date(maintenant.getTime() + 20 * 60 * 1000);
  const heures = dans20Minutes.getHours().toString().padStart(2, '0');
  const minutes = dans20Minutes.getMinutes().toString().padStart(2, '0');
  const heureFormatee = `${heures}:${minutes}`;
  
  console.log('Pause de 20 minutes... Prochaine récupération ' + heureFormatee);
}

module.exports = { recup_ville_all_weather };