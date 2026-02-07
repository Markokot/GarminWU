import OpenAI from "openai";
import type { User, Workout, ChatMessage, GarminActivity, FitnessLevel } from "@shared/schema";
import { fitnessLevelLabels } from "@shared/schema";

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
2. Когда пользователь просит создать тренировку, ОБЯЗАТЕЛЬНО верни её в формате JSON внутри блока \`\`\`workout_json ... \`\`\`
3. Перед созданием тренировки коротко объясни: зачем она, какой эффект, на что обратить внимание
4. Учитывай ВСЮ информацию из профиля: уровень, возраст, объём тренировок, травмы, личные рекорды
5. Если видишь данные из Garmin — используй их для анализа текущей формы (темп, пульс, объёмы)

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
}

function extractWorkoutJson(text: string): (Workout & { scheduledDate?: string }) | null {
  const regex = /```workout_json\s*([\s\S]*?)```/;
  const match = text.match(regex);
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
    };
  } catch (e) {
    console.error("Failed to parse workout JSON:", e);
    return null;
  }
}

function cleanResponseText(text: string): string {
  return text.replace(/```workout_json\s*[\s\S]*?```/g, "").trim();
}

export async function chat(
  user: User,
  userMessage: string,
  history: ChatMessage[],
  activities?: GarminActivity[]
): Promise<AiResponse> {
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
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || "Извините, не удалось получить ответ.";
    const workout = extractWorkoutJson(responseText);
    const cleanText = cleanResponseText(responseText);

    return { text: cleanText, workout };
  } catch (error: any) {
    console.error("DeepSeek API error:", error.message);
    throw new Error("Ошибка AI: " + (error.message || "не удалось получить ответ"));
  }
}
