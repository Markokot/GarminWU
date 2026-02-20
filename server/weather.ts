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

export function detectLikelyCity(activities: GarminActivity[]): { city: string; lat: number; lon: number; recentCity?: string } | null {
  if (activities.length === 0) return null;

  const recentActivities = activities.slice(0, 3);
  const recentCityCount = new Map<string, { count: number; lat: number; lon: number }>();
  for (const a of recentActivities) {
    if (a.locationName && a.startLatitude && a.startLongitude) {
      const existing = recentCityCount.get(a.locationName);
      if (existing) {
        existing.count++;
      } else {
        recentCityCount.set(a.locationName, { count: 1, lat: a.startLatitude, lon: a.startLongitude });
      }
    }
  }

  let recentCity = "";
  let recentData = { count: 0, lat: 0, lon: 0 };
  recentCityCount.forEach((data, city) => {
    if (data.count > recentData.count) {
      recentCity = city;
      recentData = data;
    }
  });

  if (recentCity && recentData.count >= 2) {
    const allCityCount = new Map<string, number>();
    for (const a of activities) {
      if (a.locationName) {
        allCityCount.set(a.locationName, (allCityCount.get(a.locationName) || 0) + 1);
      }
    }
    let homeCity = "";
    let homeCount = 0;
    allCityCount.forEach((count, city) => {
      if (count > homeCount) {
        homeCity = city;
        homeCount = count;
      }
    });

    if (recentCity !== homeCity && homeCount > recentData.count) {
      return { city: recentCity, lat: recentData.lat, lon: recentData.lon, recentCity };
    }
  }

  if (recentCity) {
    return { city: recentCity, lat: recentData.lat, lon: recentData.lon };
  }

  const allCityCount = new Map<string, { count: number; lat: number; lon: number }>();
  for (const a of activities) {
    if (a.locationName && a.startLatitude && a.startLongitude) {
      const existing = allCityCount.get(a.locationName);
      if (existing) {
        existing.count++;
      } else {
        allCityCount.set(a.locationName, { count: 1, lat: a.startLatitude, lon: a.startLongitude });
      }
    }
  }

  if (allCityCount.size === 0) return null;

  let maxCity = "";
  let maxData = { count: 0, lat: 0, lon: 0 };
  allCityCount.forEach((data, city) => {
    if (data.count > maxData.count) {
      maxCity = city;
      maxData = data;
    }
  });

  return { city: maxCity, lat: maxData.lat, lon: maxData.lon };
}

export function buildWeatherContext(city: string, forecast: WeatherForecast[], isRecentTravel?: boolean): string {
  if (forecast.length === 0) return "";

  const travelNote = isRecentTravel
    ? `\nПоследние тренировки были в ${city} — вероятно, пользователь сейчас в поездке/отпуске. Используй погоду ${city}.`
    : "";

  let ctx = `\n\n===== ПРОГНОЗ ПОГОДЫ (${city}) =====${travelNote}`;
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
  ctx += `\n\nПРАВИЛА ПОГОДНЫХ РЕКОМЕНДАЦИЙ:
Предполагай, что пользователь тренируется в ${city}, если он не указал другой город.

ИСКЛЮЧЕНИЯ — когда НЕ НАДО давать рекомендации по погоде/одежде:
- Если пользователь упоминает "манеж", "зал", "тренажёр", "дорожка", "indoor", "крытый" — это тренировка в помещении, погода не важна. Не рекомендуй одежду.

ЭКИПИРОВКА по температуре (только для уличных тренировок):
- Ниже -15°C: РЕКОМЕНДУЙ МАНЕЖ. Если пользователь настаивает на улице — термобельё, утеплённые тайтсы, балаклава, перчатки, шапка, ветрозащита. Предупреди об опасности обморожения.
- -15..-5°C: термобельё, утеплённые тайтсы, балаклава, перчатки, шапка. Предложи манеж как альтернативу.
- -5..+5°C: лонгслив, тайтсы, перчатки, шапка/бафф
- +5..+15°C: футболка с длинным рукавом или лёгкая куртка, тайтсы или шорты
- +15..+25°C: футболка, шорты, кепка от солнца
- Выше +30°C: РЕКОМЕНДУЙ бегать рано утром (до 7-8 утра) или после заката. Лёгкая светлая одежда, кепка, обязательно вода. Предупреди о перегреве.
- +25..+30°C: лёгкая одежда, кепка, вода. Предложи утреннюю или вечернюю тренировку.
- При дожде: непромокаемая куртка, трейловые кроссовки
- При снеге: гамаши, трейловые кроссовки с шипами, яркая одежда
- При сильном ветре (>25 км/ч): ветровка, защита лица
- При гололёде/изморози: трейловые кроссовки с шипами или манеж

Рекомендуй экипировку КРАТКО, 1-2 предложения, только когда создаёшь тренировку или пользователь спрашивает о погоде/одежде. Формат: "Если ты будешь в ${city}, то сегодня/завтра [погода] — рекомендую [одежда/обувь]."`;

  return ctx;
}
