import OpenAI from "openai";
import type { User, Workout, ChatMessage, GarminActivity, FitnessLevel, GarminWatchModel } from "@shared/schema";
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

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayOfWeek(): string {
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  return days[new Date().getDay()];
}

const SYSTEM_PROMPT = `Ты — Тренер. Опытный тренер по триатлону, бегу, велоспорту и плаванию с 20-летним стажем. Ты подготовил десятки спортсменов от новичков до Ironman-финишеров.

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

ВАЖНЫЕ ПРАВИЛА:
1. Отвечай на русском языке
2. КАЖДЫЙ РАЗ, когда в разговоре речь идёт о тренировке (пользователь просит, описывает, предлагает, обсуждает, спрашивает какую тренировку делать, или ты сам рекомендуешь тренировку), ты ОБЯЗАН создать блок \`\`\`workout_json ... \`\`\` с полной структурой тренировки. БЕЗ ИСКЛЮЧЕНИЙ. Если ты описываешь тренировку текстом — ты ОБЯЗАН также приложить workout_json. Без блока workout_json кнопка отправки на часы НЕ ПОЯВИТСЯ и тренировка бесполезна. Пользователь пришёл сюда именно для загрузки тренировок на часы.
3. Перед workout_json коротко объясни: зачем эта тренировка, какой эффект, на что обратить внимание (2-3 предложения, не больше)
4. Учитывай ВСЮ информацию из профиля: уровень, возраст, объём тренировок, травмы, личные рекорды
5. Если видишь данные из Garmin — используй их для анализа текущей формы (темп, пульс, объёмы)
6. ЗАПРЕЩЕНО: никогда не предлагай пользователю "скопировать JSON", "импортировать в Garmin Connect", "скопировать код", не давай пошаговых инструкций по ручному импорту. Приложение само отправляет тренировки на часы — пользователь нажимает кнопку "На Garmin" или "В избранное". Ты просто создаёшь тренировку в формате workout_json.

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
- Если пользователь говорит "сегодня", "сейчас", "на сегодня" — ставь сегодняшнюю дату
- Если "завтра", "на завтра" — ставь завтрашнюю дату  
- Если "послезавтра" — ставь послезавтрашнюю дату
- Если "в понедельник", "во вторник" и т.д. — вычисли ближайшую дату этого дня недели
- Если конкретная дата не упоминается в разговоре, ставь сегодняшнюю дату (сегодня {TODAY_DATE}, {TODAY_DOW})
- Формат даты СТРОГО: YYYY-MM-DD

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

АНАЛИЗ ТРЕНИРОВОЧНЫХ ДАННЫХ:
- Если есть данные Garmin, оцени текущую нагрузку и форму
- Обрати внимание на соотношение пульса и темпа — это показатель формы
- Если пользователь тренировался интенсивно последние дни — предложи восстановительную тренировку
- Следи за балансом интенсивности: 80% лёгких / 20% интенсивных (правило 80/20)`;


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
      context += `\n- ${a.startTimeLocal?.split("T")[0] || "?"} | ${a.activityName} (${a.activityType}): ${distKm.toFixed(1)} км, ${Math.round(durMin)} мин`;
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

export interface AiResponse {
  text: string;
  workout: (Workout & { scheduledDate?: string }) | null;
  workouts: (Workout & { scheduledDate?: string })[] | null;
  planTitle?: string;
  planDescription?: string;
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

function buildChatMessages(
  user: User,
  userMessage: string,
  history: ChatMessage[],
  activities?: GarminActivity[]
): OpenAI.ChatCompletionMessageParam[] {
  const userContext = buildUserContext(user, activities);
  const todayDate = getTodayDateString();
  const todayDow = getDayOfWeek();

  const systemPrompt = SYSTEM_PROMPT
    .replace("{TODAY_DATE}", todayDate)
    .replace("{TODAY_DOW}", todayDow);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt + userContext },
  ];

  const recentHistory = history.slice(-30);
  for (const msg of recentHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      let content = msg.content;
      if (msg.role === "assistant") {
        content = stripManualImportInstructions(content);
      }
      messages.push({ role: msg.role, content });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

export function parseAiResponse(responseText: string): AiResponse {
  const workout = extractWorkoutJson(responseText);
  const plan = extractTrainingPlanJson(responseText);
  const cleanText = cleanResponseText(responseText, !!workout, !!plan);

  return {
    text: cleanText,
    workout,
    workouts: plan?.workouts || null,
    planTitle: plan?.planTitle,
    planDescription: plan?.planDescription,
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
  onChunk?: (chunk: string) => void
): Promise<AiResponse> {
  const messages = buildChatMessages(user, userMessage, history, activities);

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
