import OpenAI from "openai";
import type { User, Workout, ChatMessage, GarminActivity, FitnessLevel, GarminWatchModel, AiPromptVariant } from "@shared/schema";
import { fitnessLevelLabels, garminWatchLabels, swimStructuredWatchModels, nativeRunningPowerWatchModels } from "@shared/schema";

function getOpenAIClient(): OpenAI {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set. AI features are unavailable.");
  }
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
}

function getServerDate(): { dateStr: string; dayIndex: number } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { dateStr: `${y}-${m}-${d}`, dayIndex: now.getDay() };
}

function getUserDate(timezone: string): { dateStr: string; dayIndex: number } | null {
  try {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const dow = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dateStr, dayIndex: map[dow] ?? 0 };
  } catch {
    return null;
  }
}

function getResolvedDate(timezone?: string): { dateStr: string; dayIndex: number } {
  const server = getServerDate();
  if (!timezone) return server;
  const user = getUserDate(timezone);
  if (!user) return server;
  const serverMs = new Date(server.dateStr + "T12:00:00Z").getTime();
  const userMs = new Date(user.dateStr + "T12:00:00Z").getTime();
  const diffDays = Math.abs(userMs - serverMs) / (1000 * 60 * 60 * 24);
  if (diffDays > 1) {
    console.log(`[AI] Timezone sanity check FAILED: user=${user.dateStr} server=${server.dateStr} tz=${timezone} diff=${diffDays}d — using server date`);
    return server;
  }
  return user;
}

function getTodayDateString(timezone?: string): string {
  return getResolvedDate(timezone).dateStr;
}

function getDayOfWeek(timezone?: string): string {
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  return days[getResolvedDate(timezone).dayIndex];
}

export function buildWeekCalendar(todayStr: string): string {
  const days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const today = new Date(todayStr + "T12:00:00Z");
  const parts: string[] = [];
  for (let i = 0; i <= 13; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const dow = days[d.getUTCDay()];
    const label = i === 0 ? "СЕГОДНЯ" : i === 1 ? "завтра" : "";
    parts.push(`${y}-${m}-${dd}(${dow}${label ? "," + label : ""})`);
  }
  return "Ближайшие дни: " + parts.join(", ");
}

const SYSTEM_PROMPT = `Ты — Тренер. Опытный тренер по триатлону, бегу, велоспорту и плаванию с 20-летним стажем. Ты подготовил десятки спортсменов от новичков до Ironman-финишеров.

ТЕКУЩАЯ ДАТА: {TODAY_DATE} ({TODAY_DOW}).
КРИТИЧЕСКИ ВАЖНО ПРО ДАТЫ:
- Используй ТОЛЬКО эту дату как "сегодня". НЕ ПРИДУМЫВАЙ даты — ВСЕГДА вычисляй от {TODAY_DATE}.
- "Завтра" = {TODAY_DATE} + 1 день. "Послезавтра" = {TODAY_DATE} + 2 дня.
- "Следующая суббота" = ближайшая суббота ПОСЛЕ {TODAY_DATE} (проверь по мини-календарю в сообщении пользователя).
- Перед тем как написать ЛЮБУЮ дату — сверься с мини-календарём в квадратных скобках в сообщении пользователя.
- НИКОГДА не путай день недели и число. Если пишешь "суббота, 28 февраля" — проверь по мини-календарю, что 28 февраля действительно суббота.
- ВНИМАНИЕ К ИСТОРИИ: Сообщения из прошлых дней помечены [написано YYYY-MM-DD]. Когда в старом сообщении сказано "завтра" или "в субботу" — это относилось к дате написания, НЕ к сегодняшней. Для текущих расчётов используй ТОЛЬКО сегодняшнюю дату из мини-календаря.

ОГРАНИЧЕНИЕ ТЕМАТИКИ:
- Ты отвечаешь ТОЛЬКО на вопросы, связанные с тренировками, спортом, физической подготовкой, питанием для спортсменов, восстановлением, Garmin, и использованием этого приложения.
- Если пользователь задаёт вопрос НЕ по теме (политика, наука, развлечения, программирование, и т.д.) — вежливо откажи одним предложением: "Я тренер по спорту и могу помочь только с тренировками и подготовкой. Задай вопрос о тренировке — и я помогу!" НЕ отвечай на нетематические вопросы, даже частично.

ТВОЙ ХАРАКТЕР:
- Ты профессионал. Ты анализируешь данные спортсмена, прежде чем давать рекомендации.
- Ты НЕ СОГЛАШАЕШЬСЯ с пользователем, если он просит что-то вредное для здоровья или неэффективное. Например:
  - Слишком резкое увеличение объёма (>10% в неделю) — предупреди о травмах
  - Интенсивные тренировки каждый день — объясни важность восстановления
  - Нереалистичные цели (марафон за 3 часа для новичка) — предложи поэтапный план
  - Игнорирование травм — настоятельно рекомендуй снизить нагрузку
- Ты даёшь ОБОСНОВАННЫЕ рекомендации, опираясь на: историю тренировок из Garmin, уровень подготовки, возраст, цели, травмы
- Ты задаёшь уточняющие вопросы, если информации недостаточно для хорошей рекомендации
- Ты краток и по делу, но при этом объясняешь ПОЧЕМУ именно такая тренировка подходит
- Иногда предлагаешь альтернативу лучше того, что просит пользователь

ГОТОВНОСТЬ К ТРЕНИРОВКЕ (Readiness Score):
- В контексте может быть секция "ГОТОВНОСТЬ К ТРЕНИРОВКЕ" с оценкой 0-100.
- ОБЯЗАТЕЛЬНО учитывай этот показатель при рекомендациях:
  - Score 70-100 (зелёный): можно давать полноценные тренировки
  - Score 40-69 (жёлтый): рекомендуй лёгкую/восстановительную нагрузку, предупреди о накопленной усталости
  - Score 0-39 (красный): настоятельно рекомендуй отдых, объясни риски перетренированности
- Не нужно называть точный числовой score пользователю — просто учитывай его при выборе интенсивности и объёма тренировки.

ПРАВИЛО ПРОТИВ ПОВТОРОВ:
- НЕ ПОВТОРЯЙ информацию, которую ты уже дал ранее в этом диалоге. Это касается: погоды, экипировки, рекомендаций по одежде, анализа недельного объёма, пульсовых зон, общих советов.
- Если ты уже рассказал о погоде и одежде в предыдущем сообщении — НЕ упоминай это снова. Пользователь уже прочитал.
- Если пользователь задаёт уточняющий вопрос (например, "сколько бегать?") — отвечай только на вопрос, не повторяя то, что уже сказано.
- На простые реплики ("спасибо", "ок", "понял") — отвечай коротко, без повтора предыдущих рекомендаций.
- Исключение: повторяй информацию только если пользователь ЯВНО попросил ("напомни про погоду", "повтори совет по одежде").

ВАЖНЫЕ ПРАВИЛА:
1. Отвечай на русском языке
2. КАЖДЫЙ РАЗ, когда в разговоре речь идёт о тренировке (пользователь просит, описывает, предлагает, обсуждает, спрашивает какую тренировку делать, или ты сам рекомендуешь тренировку), ты ОБЯЗАН создать блок \`\`\`workout_json ... \`\`\` с полной структурой тренировки. БЕЗ ИСКЛЮЧЕНИЙ. Если ты описываешь тренировку текстом — ты ОБЯЗАН также приложить workout_json. Без блока workout_json кнопка отправки на часы НЕ ПОЯВИТСЯ и тренировка бесполезна. Пользователь пришёл сюда именно для загрузки тренировок на часы.
3. Перед workout_json коротко объясни: зачем эта тренировка, какой эффект, на что обратить внимание (2-3 предложения, не больше)
4. Учитывай ВСЮ информацию из профиля: уровень, возраст, объём тренировок, травмы, личные рекорды
5. Если видишь данные из Garmin — используй их для анализа текущей формы (темп, пульс, объёмы)
6. ЗАПРЕЩЕНО: никогда не предлагай пользователю "скопировать JSON", "импортировать в Garmin Connect", "скопировать код", не давай пошаговых инструкций по ручному импорту. Приложение само отправляет тренировки на часы — пользователь нажимает кнопку "На Garmin" или "В избранное". Ты просто создаёшь тренировку в формате workout_json.
7. ДАННЫЕ КАЛЕНДАРЯ GARMIN: В конце этого промпта могут быть секции "ЗАПЛАНИРОВАННЫЕ ТРЕНИРОВКИ В GARMIN" и другие данные контекста. ЭТО РЕАЛЬНЫЕ ДАННЫЕ из аккаунта пользователя — ты ОБЯЗАН их использовать. Если пользователь спрашивает "какие тренировки запланированы" или "что у меня на этой неделе" — ответ находится в этих данных. НЕ ГОВОРИ "я не вижу данных календаря" если секция "ЗАПЛАНИРОВАННЫЕ ТРЕНИРОВКИ В GARMIN" присутствует ниже.

ФОРМАТ ТРЕНИРОВКИ (внутри блока \`\`\`workout_json):
{
  "name": "Название тренировки",
  "description": "Краткое описание",
  "sportType": "running" | "cycling" | "swimming",
  "scheduledDate": "YYYY-MM-DD или null",
  "steps": [
    {
      "stepId": 1,
      "stepOrder": 1,
      "stepType": "warmup" | "interval" | "recovery" | "rest" | "cooldown" | "repeat",
      "durationType": "time" | "distance" | "lap.button",
      "durationValue": <число в секундах для time, в метрах для distance, null для lap.button>,
      "targetType": "no.target" | "pace.zone" | "heart.rate.zone" | "power.zone" | "cadence",
      "targetValueLow": <число или null>,
      "targetValueHigh": <число или null>,
      "intensity": "active" | "resting",
      "repeatCount": <число, только для stepType "repeat">,
      "childSteps": [<вложенные шаги для repeat>]
    }
  ]
}

ПРАВИЛА ДЛЯ scheduledDate:
- Если пользователь говорит "сегодня", "сейчас", "на сегодня" — ставь {TODAY_DATE}
- Если "завтра", "на завтра" — найди "завтра" в мини-календаре из сообщения пользователя и используй ту дату
- Если "послезавтра" — {TODAY_DATE} + 2 дня, проверь по мини-календарю
- Если "в понедельник", "во вторник", "в субботу" и т.д. — найди ближайший такой день в мини-календаре из сообщения пользователя
- Если "на следующей неделе в среду" — найди среду на следующей неделе в мини-календаре
- Если конкретная дата не упоминается в разговоре, ставь {TODAY_DATE}
- Формат даты СТРОГО: YYYY-MM-DD
- ВСЕГДА сверяй вычисленную дату с мини-календарём — он содержит точные соответствия дат и дней недели

ПРИМЕРЫ ЗНАЧЕНИЙ:
- pace.zone: targetValueLow и targetValueHigh в секундах на км (например, 300 = 5:00/км, 360 = 6:00/км)
- heart.rate.zone: targetValueLow и targetValueHigh в ударах/мин (например, 140, 160)
- power.zone: в ваттах
- cadence: в шагах/оборотах в минуту
- time: в секундах (600 = 10 мин)
- distance: в метрах (1000 = 1 км)

Для интервалов используй stepType "repeat" с childSteps. Например, 5x1000м:
{
  "stepType": "repeat",
  "repeatCount": 5,
  "childSteps": [
    {"stepType": "interval", "durationType": "distance", "durationValue": 1000, ...},
    {"stepType": "recovery", "durationType": "time", "durationValue": 120, ...}
  ]
}

Всегда включай разминку и заминку в тренировку.
ОБЯЗАТЕЛЬНО указывай heart.rate.zone для ВСЕХ шагов (warmup, interval, recovery, cooldown) — не оставляй "no.target". Для разминки и заминки ставь лёгкий пульс, для recovery — восстановительный.

КРИТИЧЕСКИ ВАЖНО — ЗАПРЕЩЕНО:
- НИКОГДА не предлагай пользователю копировать JSON, экспортировать код, импортировать тренировку вручную в Garmin Connect или работать с JSON напрямую.
- НИКОГДА не давай пошаговые инструкции по ручному импорту тренировок.
- Пользователь отправляет тренировки на часы КНОПКОЙ в интерфейсе приложения. Просто создай тренировку в формате workout_json — всё остальное сделает приложение автоматически.
- Если часы не поддерживают какой-то формат — создай УПРОЩЁННУЮ тренировку в workout_json, а НЕ предлагай ручной импорт.

ГЛАВНОЕ ПРАВИЛО: Если ты рекомендуешь или описываешь тренировку — ВСЕГДА прикладывай workout_json. Текстовое описание тренировки БЕЗ workout_json = ошибка. Пользователь не может вручную ввести тренировку — ему нужна кнопка отправки, которая появляется ТОЛЬКО при наличии workout_json.

ТРЕНИРОВОЧНЫЙ ПЛАН НА ПЕРИОД:
Когда пользователь просит составить план на несколько дней/недель (например, "план на 4 недели", "расписание тренировок на 2 недели"), верни ВСЕ тренировки в одном блоке \`\`\`training_plan_json ... \`\`\`:
{
  "planTitle": "Название плана",
  "planDescription": "Краткое описание плана и его целей",
  "workouts": [
    {
      "name": "Название тренировки",
      "description": "Описание",
      "sportType": "running",
      "scheduledDate": "YYYY-MM-DD",
      "steps": [...]
    }
  ]
}

ПРАВИЛА ДЛЯ ПЛАНА:
- Максимальная длительность плана: 12 недель. Если пользователь просит больше — объясни, что планирование более чем на 12 недель неэффективно (нужна корректировка по ходу)
- КАЖДАЯ тренировка в плане ОБЯЗАНА иметь scheduledDate (конкретную дату YYYY-MM-DD)
- Распределяй тренировки по дням недели, учитывая дни отдыха
- Чередуй интенсивные и восстановительные тренировки
- Не ставь тяжёлые тренировки два дня подряд
- Включай разнообразие: лёгкие пробежки, длительные, интервальные, темповые
- Если пользователь просит ОДНУ тренировку — используй формат workout_json (как описано выше)
- Если пользователь просит ПЛАН/РАСПИСАНИЕ на период — используй формат training_plan_json

ПЕРЕНОС ТРЕНИРОВОК:
Когда пользователь просит перенести запланированную тренировку (например, "перенеси тренировку на завтра", "сдвинь пробежку на пятницу", "не смогу сегодня, перенеси на другой день"), и в контексте есть информация о календаре Garmin с workoutId — создай блок \`\`\`reschedule_json\`\`\`:
{
  "workoutId": "ID тренировки из календаря",
  "currentDate": "YYYY-MM-DD",
  "newDate": "YYYY-MM-DD",
  "reason": "Краткая причина переноса"
}
- workoutId берётся из данных календаря Garmin (если они предоставлены в контексте)
- currentDate — текущая дата тренировки
- newDate — новая дата
- reason — необязательное поле, краткое объяснение
- Если нет данных календаря или workoutId — просто объясни текстом, что для переноса нужно подключить Garmin

АНАЛИЗ ТРЕНИРОВОЧНЫХ ДАННЫХ:
- Если есть данные Garmin, оцени текущую нагрузку и форму
- Обрати внимание на соотношение пульса и темпа — это показатель формы
- Если пользователь тренировался интенсивно последние дни — предложи восстановительную тренировку
- Следи за балансом интенсивности: 80% лёгких / 20% интенсивных (правило 80/20)`;


export function pickPromptVariant(variants: AiPromptVariant[]): AiPromptVariant {
  const active = variants.filter((v) => v.isActive && v.weight > 0);
  if (active.length === 0) {
    return { id: "base", name: "Базовый", instructions: "", weight: 1, isActive: true, createdAt: "" };
  }
  const totalWeight = active.reduce((sum, v) => sum + v.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const v of active) {
    rand -= v.weight;
    if (rand <= 0) return v;
  }
  return active[active.length - 1];
}

function buildUserContext(user: User, activities?: GarminActivity[]): string {
  let context = `\n\n===== ПРОФИЛЬ СПОРТСМЕНА =====
- Имя: ${user.username}
- Виды спорта: ${user.sportTypes.join(", ")}
- Цели: ${user.goals || "не указаны"}`;

  if (user.fitnessLevel) {
    context += `\n- Уровень подготовки: ${fitnessLevelLabels[user.fitnessLevel as FitnessLevel] || user.fitnessLevel}`;
  }
  if (user.age != null) context += `\n- Возраст: ${user.age} лет`;
  if (user.weeklyHours != null) context += `\n- Тренировочный объём: ~${user.weeklyHours} ч/неделю`;
  if (user.experienceYears != null) context += `\n- Стаж в спорте: ${user.experienceYears} лет`;
  if (user.personalRecords) context += `\n- Личные рекорды: ${user.personalRecords}`;
  if (user.injuries) context += `\n- Травмы/ограничения: ${user.injuries}`;
  if (user.preferences) context += `\n- Предпочтения: ${user.preferences}`;

  if (user.garminWatch) {
    const watchLabel = garminWatchLabels[user.garminWatch as GarminWatchModel] || user.garminWatch;
    const supportsSwimStructured = swimStructuredWatchModels.includes(user.garminWatch as GarminWatchModel);
    const hasNativeRunningPower = nativeRunningPowerWatchModels.includes(user.garminWatch as GarminWatchModel);
    context += `\n- Часы Garmin: ${watchLabel}`;
    if (!supportsSwimStructured) {
      context += ` (ВАЖНО: эти часы НЕ поддерживают плавательные тренировки — это аппаратное ограничение Garmin, загрузить тренировку по плаванию на эту модель невозможно ни через Garmin Connect, ни через Intervals.icu. Для плавания: создавай workout_json (чтобы пользователь мог сохранить в избранное как справочник), но ОБЯЗАТЕЛЬНО предупреди, что на часы тренировка НЕ загрузится — нужно открыть план на экране телефона и выполнять по нему, запустив обычную активность "Плавание в бассейне" на часах.)`;
    }
    if (!hasNativeRunningPower) {
      context += ` (НЕ имеет встроенного датчика мощности бега — для беговых тренировок используй targetType "pace.zone" или "heart.rate.zone", НЕ используй "power.zone" если пользователь не упоминает внешний датчик мощности типа Stryd или Garmin RDP)`;
    }
  }
  context += `\n- Garmin: ${user.garminConnected ? "подключён" : "не подключён"}`;

  if (activities && activities.length > 0) {
    context += `\n\n===== ПОСЛЕДНИЕ ТРЕНИРОВКИ ИЗ GARMIN =====`;
    let totalDistKm = 0;
    let totalDurMin = 0;
    activities.forEach((a) => {
      const distKm = a.distance / 1000;
      const durMin = a.duration / 60;
      totalDistKm += distKm;
      totalDurMin += durMin;
      const location = a.locationName ? ` [${a.locationName}]` : "";
      context += `\n- ${a.startTimeLocal?.split("T")[0] || "?"} | ${a.activityName} (${a.activityType})${location}: ${distKm.toFixed(1)} км, ${Math.round(durMin)} мин`;
      if (a.averageHR) context += `, ср.пульс ${a.averageHR}`;
      if (a.maxHR) context += `, макс.пульс ${a.maxHR}`;
      if (a.averagePace) {
        const paceMin = Math.floor(a.averagePace / 60);
        const paceSec = Math.round(a.averagePace % 60);
        context += `, темп ${paceMin}:${paceSec.toString().padStart(2, "0")}/км`;
      }
    });
    context += `\nИтого за последние тренировки: ${totalDistKm.toFixed(1)} км, ${Math.round(totalDurMin)} мин`;
    context += `\n(Используй эти данные для анализа текущей формы и нагрузки)`;
  } else if (user.garminConnected) {
    context += `\n\n(Данные Garmin пока не загружены — спроси пользователя о его текущей форме)`;
  }

  return context;
}

export interface RescheduleData {
  workoutId: string;
  currentDate: string;
  newDate: string;
  reason?: string;
}

export interface AiResponse {
  text: string;
  workout: (Workout & { scheduledDate?: string }) | null;
  workouts: (Workout & { scheduledDate?: string })[] | null;
  planTitle?: string;
  planDescription?: string;
  reschedule?: RescheduleData;
}

function extractWorkoutJson(text: string): (Workout & { scheduledDate?: string }) | null {
  const regex = /```workout_json\s*([\s\S]*?)```/;
  let match = text.match(regex);
  if (!match) {
    const fallback = /```json\s*([\s\S]*?)```/;
    const fallbackMatch = text.match(fallback);
    if (fallbackMatch) {
      try {
        const obj = JSON.parse(fallbackMatch[1].trim());
        if (obj.steps && Array.isArray(obj.steps) && obj.sportType) {
          match = fallbackMatch;
        }
      } catch {}
    }
  }
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    return {
      id: "",
      userId: "",
      name: parsed.name || "Тренировка",
      description: parsed.description || "",
      sportType: parsed.sportType || "running",
      scheduledDate: parsed.scheduledDate || null,
      steps: (parsed.steps || []).map((s: any, i: number) => ({
        stepId: s.stepId || i + 1,
        stepOrder: s.stepOrder || i + 1,
        stepType: s.stepType || "interval",
        durationType: s.durationType || "time",
        durationValue: s.durationValue ?? null,
        targetType: s.targetType || "no.target",
        targetValueLow: s.targetValueLow ?? null,
        targetValueHigh: s.targetValueHigh ?? null,
        intensity: s.intensity || "active",
        repeatCount: s.repeatCount,
        childSteps: s.childSteps?.map((cs: any, j: number) => ({
          stepId: cs.stepId || j + 100,
          stepOrder: cs.stepOrder || j + 1,
          stepType: cs.stepType || "interval",
          durationType: cs.durationType || "time",
          durationValue: cs.durationValue ?? null,
          targetType: cs.targetType || "no.target",
          targetValueLow: cs.targetValueLow ?? null,
          targetValueHigh: cs.targetValueHigh ?? null,
          intensity: cs.intensity || "active",
        })),
      })),
      createdAt: new Date().toISOString(),
      sentToGarmin: false,
      sentToIntervals: false,
    };
  } catch (e) {
    console.error("Failed to parse workout JSON:", e);
    return null;
  }
}

function extractTrainingPlanJson(text: string): { workouts: (Workout & { scheduledDate?: string })[]; planTitle?: string; planDescription?: string } | null {
  const regex = /```training_plan_json\s*([\s\S]*?)```/;
  const match = text.match(regex);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    const rawWorkouts = parsed.workouts || parsed;
    if (!Array.isArray(rawWorkouts) || rawWorkouts.length === 0) return null;

    const workouts = rawWorkouts.map((w: any, idx: number) => ({
      id: "",
      userId: "",
      name: w.name || `Тренировка ${idx + 1}`,
      description: w.description || "",
      sportType: w.sportType || "running",
      scheduledDate: w.scheduledDate || null,
      steps: (w.steps || []).map((s: any, i: number) => ({
        stepId: s.stepId || i + 1,
        stepOrder: s.stepOrder || i + 1,
        stepType: s.stepType || "interval",
        durationType: s.durationType || "time",
        durationValue: s.durationValue ?? null,
        targetType: s.targetType || "no.target",
        targetValueLow: s.targetValueLow ?? null,
        targetValueHigh: s.targetValueHigh ?? null,
        intensity: s.intensity || "active",
        repeatCount: s.repeatCount,
        childSteps: s.childSteps?.map((cs: any, j: number) => ({
          stepId: cs.stepId || j + 100,
          stepOrder: cs.stepOrder || j + 1,
          stepType: cs.stepType || "interval",
          durationType: cs.durationType || "time",
          durationValue: cs.durationValue ?? null,
          targetType: cs.targetType || "no.target",
          targetValueLow: cs.targetValueLow ?? null,
          targetValueHigh: cs.targetValueHigh ?? null,
          intensity: cs.intensity || "active",
        })),
      })),
      createdAt: new Date().toISOString(),
      sentToGarmin: false,
      sentToIntervals: false,
    }));

    return {
      workouts,
      planTitle: parsed.planTitle || undefined,
      planDescription: parsed.planDescription || undefined,
    };
  } catch (e) {
    console.error("Failed to parse training plan JSON:", e);
    return null;
  }
}

function stripManualImportInstructions(text: string): string {
  return text
    .replace(/\*?\*?(?:Пошаговая инструкция|Краткая инструкция|Как загрузить и запустить|Инструкция для загрузки)[^]*?(?=\n\n|\*\*Итого|\*\*Тренировка|Хорошего|Удачной|$)/gi, "")
    .replace(/\d+\.\s*\*?\*?(?:Скопируй|Импортируй|Открой Garmin Connect|Вставь|Сохрани и синхронизируй)[^\n]*(?:\n(?:\s+\*[^\n]*|\s+\d+\.[^\n]*)?)*/gi, "")
    .replace(/\*?\*?Скопируй (?:код|JSON|весь блок)[^\n]*/gi, "")
    .replace(/Вот (?:JSON-код|код|готовый JSON|финальный код)[^\n]*/gi, "")
    .replace(/[^\n]*(?:код тренировки для импорта|готовая? для импорта|для прямой загрузки)[^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanResponseText(text: string, hadWorkout: boolean, hadPlan: boolean): string {
  let cleaned = text
    .replace(/```workout_json\s*[\s\S]*?```/g, "")
    .replace(/```training_plan_json\s*[\s\S]*?```/g, "");
  if (hadWorkout || hadPlan) {
    cleaned = cleaned.replace(/```json\s*[\s\S]*?```/g, "");
  }
  cleaned = stripManualImportInstructions(cleaned);
  return cleaned.trim();
}

function compressAssistantMessage(content: string): string {
  let compressed = stripManualImportInstructions(content);

  compressed = compressed
    .replace(/```workout_json\s*[\s\S]*?```/g, "[тренировка создана]")
    .replace(/```training_plan_json\s*[\s\S]*?```/g, "[план тренировок создан]")
    .replace(/```reschedule_json\s*[\s\S]*?```/g, "[перенос тренировки]")
    .replace(/```json\s*[\s\S]*?```/g, "");

  const lines = compressed.split("\n");
  const filteredLines: string[] = [];
  for (const line of lines) {
    if (/^\s*[-*]\s*(Разминка|Заминка|Интервал|Повтор|Основная|Восстановл|Шаг \d)/i.test(line)) continue;
    if (/^\s*\d+\.\s*(Разминка|Заминка|Интервал|Повтор|Основная|Восстановл)/i.test(line)) continue;
    filteredLines.push(line);
  }
  compressed = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const MAX_MSG_LENGTH = 500;
  if (compressed.length > MAX_MSG_LENGTH) {
    compressed = compressed.substring(0, MAX_MSG_LENGTH) + "...";
  }

  return compressed;
}

function buildChatMessages(
  user: User,
  userMessage: string,
  history: ChatMessage[],
  activities?: GarminActivity[],
  timezone?: string,
  weatherContext?: string,
  variantInstructions?: string
): OpenAI.ChatCompletionMessageParam[] {
  const userContext = buildUserContext(user, activities);
  const todayDate = getTodayDateString(timezone);
  const todayDow = getDayOfWeek(timezone);

  const systemPrompt = SYSTEM_PROMPT
    .replace(/\{TODAY_DATE\}/g, todayDate)
    .replace(/\{TODAY_DOW\}/g, todayDow);

  const variantSuffix = variantInstructions ? `\n\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:\n${variantInstructions}` : "";
  const fullSystemContent = systemPrompt + userContext + (weatherContext || "") + variantSuffix;
  console.log(`[AI] System prompt length: ${fullSystemContent.length} chars`);
  if (weatherContext) {
    console.log(`[AI] Extra context included (${weatherContext.length} chars), starts with: ${weatherContext.substring(0, 200)}`);
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: fullSystemContent },
  ];

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    const msgDate = msg.timestamp ? msg.timestamp.split("T")[0] : "";
    const datePrefix = msgDate && msgDate !== todayDate ? `[написано ${msgDate}] ` : "";

    if (msg.role === "user") {
      const content = msg.content.length > 300 ? msg.content.substring(0, 300) + "..." : msg.content;
      messages.push({ role: "user", content: datePrefix + content });
    } else if (msg.role === "assistant") {
      let content = compressAssistantMessage(msg.content);
      if (content) {
        content = content.replace(/я не вижу данных.*?календар[яьей].*?(?:\.|$)/gi, "[данные календаря доступны в контексте]");
        content = content.replace(/информация о запланированных тренировках должна подгружаться.*?(?:\.|$)/gi, "");
        messages.push({ role: "assistant", content: datePrefix + content.trim() });
      }
    }
  }

  const weekCalendar = buildWeekCalendar(todayDate);
  const dateReminder = `[Сегодня: ${todayDate}, ${todayDow}. ${weekCalendar}]\n${userMessage}`;
  messages.push({ role: "user", content: dateReminder });
  return messages;
}

function extractRescheduleJson(text: string): RescheduleData | null {
  const regex = /```reschedule_json\s*([\s\S]*?)```/;
  const match = text.match(regex);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    if (!parsed.workoutId || !parsed.newDate) return null;
    return {
      workoutId: String(parsed.workoutId),
      currentDate: parsed.currentDate || "",
      newDate: parsed.newDate,
      reason: parsed.reason || undefined,
    };
  } catch (e) {
    console.error("Failed to parse reschedule JSON:", e);
    return null;
  }
}

export function parseAiResponse(responseText: string): AiResponse {
  const workout = extractWorkoutJson(responseText);
  const plan = extractTrainingPlanJson(responseText);
  const reschedule = extractRescheduleJson(responseText);
  let cleanText = cleanResponseText(responseText, !!workout, !!plan);
  if (reschedule) {
    cleanText = cleanText.replace(/```reschedule_json\s*[\s\S]*?```/g, "").trim();
  }

  return {
    text: cleanText,
    workout,
    workouts: plan?.workouts || null,
    planTitle: plan?.planTitle,
    planDescription: plan?.planDescription,
    reschedule: reschedule || undefined,
  };
}

export async function chat(
  user: User,
  userMessage: string,
  history: ChatMessage[],
  activities?: GarminActivity[]
): Promise<AiResponse> {
  const messages = buildChatMessages(user, userMessage, history, activities);

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 8192,
    });

    const responseText = completion.choices[0]?.message?.content || "Извините, не удалось получить ответ.";
    return parseAiResponse(responseText);
  } catch (error: any) {
    console.error("DeepSeek API error:", error.message);
    throw new Error("Ошибка AI: " + (error.message || "не удалось получить ответ"));
  }
}

export async function chatStream(
  user: User,
  userMessage: string,
  history: ChatMessage[],
  activities?: GarminActivity[],
  onChunk?: (chunk: string) => void,
  timezone?: string,
  weatherContext?: string,
  variantInstructions?: string
): Promise<AiResponse> {
  const messages = buildChatMessages(user, userMessage, history, activities, timezone, weatherContext, variantInstructions);

  try {
    const openai = getOpenAIClient();
    const stream = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 8192,
      stream: true,
    });

    let responseText = "";
    let finishReason = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        responseText += delta;
        onChunk?.(delta);
      }
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    if (finishReason === "length") {
      console.warn(`[AI] Response truncated (finish_reason=length), text length: ${responseText.length}`);
      responseText += "\n\n⚠️ Ответ был обрезан из-за ограничения длины. Попросите создать план на меньший период или запросите продолжение.";
      onChunk?.("\n\n⚠️ Ответ был обрезан из-за ограничения длины. Попросите создать план на меньший период или запросите продолжение.");
    }

    if (!responseText) {
      responseText = "Извините, не удалось получить ответ.";
    }

    return parseAiResponse(responseText);
  } catch (error: any) {
    console.error("DeepSeek API error:", error.message);
    throw new Error("Ошибка AI: " + (error.message || "не удалось получить ответ"));
  }
}
