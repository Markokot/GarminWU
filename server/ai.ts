import OpenAI from "openai";
import type { User, Workout, ChatMessage, GarminActivity } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const SYSTEM_PROMPT = `Ты — профессиональный тренер по бегу, велосипеду и плаванию. Ты помогаешь спортсменам планировать тренировки и загружать их на часы Garmin.

ВАЖНЫЕ ПРАВИЛА:
1. Отвечай на русском языке
2. Будь конкретным и практичным
3. Когда пользователь просит создать тренировку, ОБЯЗАТЕЛЬНО верни её в формате JSON внутри блока \`\`\`workout_json ... \`\`\`
4. Учитывай уровень подготовки и цели пользователя
5. Давай краткие пояснения к каждой тренировке

ФОРМАТ ТРЕНИРОВКИ (внутри блока \`\`\`workout_json):
{
  "name": "Название тренировки",
  "description": "Краткое описание",
  "sportType": "running" | "cycling" | "swimming",
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

Всегда включай разминку и заминку в тренировку.`;

function buildUserContext(user: User, activities?: GarminActivity[]): string {
  let context = `\nИнформация о пользователе:
- Имя: ${user.username}
- Виды спорта: ${user.sportTypes.join(", ")}
- Цели: ${user.goals || "не указаны"}
- Garmin: ${user.garminConnected ? "подключён" : "не подключён"}`;

  if (activities && activities.length > 0) {
    context += `\n\nПоследние активности из Garmin:`;
    activities.slice(0, 5).forEach((a) => {
      const distKm = (a.distance / 1000).toFixed(1);
      const durMin = Math.round(a.duration / 60);
      context += `\n- ${a.activityName} (${a.activityType}): ${distKm} км, ${durMin} мин`;
      if (a.averageHR) context += `, пульс ${a.averageHR}`;
      if (a.averagePace) {
        const paceMin = Math.floor(a.averagePace / 60);
        const paceSec = Math.round(a.averagePace % 60);
        context += `, темп ${paceMin}:${paceSec.toString().padStart(2, "0")}/км`;
      }
    });
  }

  return context;
}

export interface AiResponse {
  text: string;
  workout: Workout | null;
}

function extractWorkoutJson(text: string): Workout | null {
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

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT + userContext },
  ];

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  try {
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
