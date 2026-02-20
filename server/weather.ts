import type { GarminActivity } from "@shared/schema";

interface GeocodingResult {
  city: string;
  country: string;
  displayName: string;
}

interface WeatherForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  temperatureAvg: number;
  apparentTemperatureMax: number;
  apparentTemperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  weatherCode: number;
  weatherDescription: string;
}

export interface LocationWeather {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  forecast: WeatherForecast[];
}

const geocodeCache = new Map<string, GeocodingResult>();

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

const weatherCodeDescriptions: Record<number, string> = {
  0: "ясно",
  1: "преимущественно ясно",
  2: "переменная облачность",
  3: "пасмурно",
  45: "туман",
  48: "изморозь",
  51: "мелкая морось",
  53: "морось",
  55: "сильная морось",
  56: "ледяная морось",
  57: "сильная ледяная морось",
  61: "небольшой дождь",
  63: "дождь",
  65: "сильный дождь",
  66: "ледяной дождь",
  67: "сильный ледяной дождь",
  71: "небольшой снег",
  73: "снег",
  75: "сильный снег",
  77: "снежная крупа",
  80: "небольшой ливень",
  81: "ливень",
  82: "сильный ливень",
  85: "небольшой снегопад",
  86: "сильный снегопад",
  95: "гроза",
  96: "гроза с градом",
  99: "гроза с сильным градом",
};

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult | null> {
  const key = coordKey(lat, lon);
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)!;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ru&zoom=10`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GarminCoachAI/1.0" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || addr.state || "";
    const country = addr.country || "";

    if (!city) return null;

    const result: GeocodingResult = {
      city,
      country,
      displayName: country ? `${city}, ${country}` : city,
    };
    geocodeCache.set(key, result);
    return result;
  } catch (err: any) {
    console.error("[Weather] Reverse geocode error:", err.message);
    return null;
  }
}

export async function getWeatherForecast(lat: number, lon: number, days: number = 7): Promise<WeatherForecast[]> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=${days}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const daily = data.daily;
    if (!daily || !daily.time) return [];

    return daily.time.map((date: string, i: number) => ({
      date,
      temperatureMax: daily.temperature_2m_max[i],
      temperatureMin: daily.temperature_2m_min[i],
      temperatureAvg: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      apparentTemperatureMax: daily.apparent_temperature_max[i],
      apparentTemperatureMin: daily.apparent_temperature_min[i],
      precipitationSum: daily.precipitation_sum[i],
      precipitationProbabilityMax: daily.precipitation_probability_max[i],
      windSpeedMax: daily.wind_speed_10m_max[i],
      weatherCode: daily.weather_code[i],
      weatherDescription: weatherCodeDescriptions[daily.weather_code[i]] || "неизвестно",
    }));
  } catch (err: any) {
    console.error("[Weather] Forecast error:", err.message);
    return [];
  }
}

export async function enrichActivitiesWithCity(activities: GarminActivity[]): Promise<GarminActivity[]> {
  const enriched = await Promise.all(
    activities.map(async (a) => {
      if (a.locationName) return a;
      if (!a.startLatitude || !a.startLongitude) return a;

      const geo = await reverseGeocode(a.startLatitude, a.startLongitude);
      if (geo) {
        return { ...a, locationName: geo.city };
      }
      return a;
    })
  );
  return enriched;
}

export function detectLikelyCity(activities: GarminActivity[]): { city: string; lat: number; lon: number } | null {
  const cityCount = new Map<string, { count: number; lat: number; lon: number }>();

  for (const a of activities) {
    if (a.locationName && a.startLatitude && a.startLongitude) {
      const existing = cityCount.get(a.locationName);
      if (existing) {
        existing.count++;
      } else {
        cityCount.set(a.locationName, { count: 1, lat: a.startLatitude, lon: a.startLongitude });
      }
    }
  }

  if (cityCount.size === 0) return null;

  let maxCity = "";
  let maxData = { count: 0, lat: 0, lon: 0 };
  cityCount.forEach((data, city) => {
    if (data.count > maxData.count) {
      maxCity = city;
      maxData = data;
    }
  });

  return { city: maxCity, lat: maxData.lat, lon: maxData.lon };
}

export function buildWeatherContext(city: string, forecast: WeatherForecast[]): string {
  if (forecast.length === 0) return "";

  let ctx = `\n\n===== ПРОГНОЗ ПОГОДЫ (${city}) =====`;
  const daysToShow = Math.min(forecast.length, 3);
  for (let i = 0; i < daysToShow; i++) {
    const f = forecast[i];
    const dayLabel = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : f.date;
    ctx += `\n${dayLabel} (${f.date}): ${f.weatherDescription}, ${f.temperatureMin}..${f.temperatureMax}°C (ощущается ${f.apparentTemperatureMin}..${f.apparentTemperatureMax}°C)`;
    if (f.precipitationSum > 0) {
      ctx += `, осадки ${f.precipitationSum}мм (вероятность ${f.precipitationProbabilityMax}%)`;
    }
    if (f.windSpeedMax > 15) {
      ctx += `, ветер до ${Math.round(f.windSpeedMax)} км/ч`;
    }
  }
  ctx += `\n\nИспользуй эти данные, чтобы рекомендовать одежду и условия для тренировки. Предполагай, что пользователь тренируется в ${city}, если он не указал другой город. Давай конкретные рекомендации по экипировке:
- При температуре ниже -5°C: термобельё, утеплённые тайтсы, балаклава, перчатки, шапка
- При -5..+5°C: лонгслив, тайтсы, перчатки, шапка/бафф
- При +5..+15°C: футболка с длинным рукавом или лёгкая куртка, тайтсы или шорты
- При +15°C и выше: футболка, шорты, кепка от солнца
- При дожде: непромокаемая куртка, трейловые кроссовки
- При снеге: гамаши, трейловые кроссовки с шипами, яркая одежда
- При сильном ветре (>25 км/ч): ветровка, защита лица
Рекомендуй экипировку КРАТКО, 1-2 предложения, только когда создаёшь тренировку или пользователь спрашивает о погоде/одежде.`;

  return ctx;
}
