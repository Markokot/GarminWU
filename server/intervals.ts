import type { Workout } from "@shared/schema";

const INTERVALS_API = "https://intervals.icu/api/v1";

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64");
}

const sportTypeMap: Record<string, string> = {
  running: "Run",
  cycling: "Ride",
  swimming: "Swim",
};

export async function verifyIntervalsConnection(athleteId: string, apiKey: string): Promise<{ name: string }> {
  const res = await fetch(`${INTERVALS_API}/athlete/${athleteId}`, {
    headers: {
      Authorization: authHeader(apiKey),
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Неверный API ключ. Проверьте ключ в настройках Intervals.icu");
    }
    if (res.status === 404) {
      throw new Error("Athlete ID не найден. Проверьте ID в настройках Intervals.icu");
    }
    throw new Error(`Ошибка подключения к Intervals.icu (${res.status})`);
  }

  const data = await res.json();
  return { name: data.name || data.email || athleteId };
}

export async function pushWorkoutToIntervals(
  athleteId: string,
  apiKey: string,
  workout: Workout
): Promise<{ eventId: string; scheduled: boolean; scheduledDate?: string }> {
  const sportType = sportTypeMap[workout.sportType] || "Run";

  const description = buildWorkoutDescription(workout);

  const event: Record<string, any> = {
    category: "WORKOUT",
    type: sportType,
    name: workout.name,
    description: description,
  };

  if (workout.scheduledDate) {
    event.start_date_local = workout.scheduledDate.includes("T")
      ? workout.scheduledDate
      : workout.scheduledDate + "T00:00:00";
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    event.start_date_local = tomorrow.toISOString().split("T")[0] + "T00:00:00";
  }

  if (workout.sportType === "cycling") {
    event.indoor = true;
  }

  const res = await fetch(`${INTERVALS_API}/athlete/${athleteId}/events`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[Intervals] Push failed (${res.status}): ${text}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error("API ключ Intervals.icu истёк или недействителен. Переподключите в настройках.");
    }
    throw new Error(`Ошибка отправки в Intervals.icu (${res.status})`);
  }

  const data = await res.json();
  console.log(`[Intervals] Workout pushed: ${data.id}`);

  return {
    eventId: String(data.id),
    scheduled: true,
    scheduledDate: event.start_date_local,
  };
}

function buildWorkoutDescription(workout: Workout): string {
  const lines: string[] = [];

  if (workout.description) {
    lines.push(workout.description);
    lines.push("");
  }

  lines.push("Структура:");
  for (const step of workout.steps) {
    let line = `- ${step.stepType}`;

    if (step.durationValue) {
      if (step.durationType === "time") {
        const m = Math.floor(step.durationValue / 60);
        const s = step.durationValue % 60;
        line += ` ${m}:${s.toString().padStart(2, "0")}`;
      } else if (step.durationType === "distance") {
        line += step.durationValue >= 1000
          ? ` ${(step.durationValue / 1000).toFixed(1)}км`
          : ` ${step.durationValue}м`;
      }
    }

    if (step.targetType !== "no.target" && step.targetValueLow && step.targetValueHigh) {
      if (step.targetType === "heart.rate.zone") {
        line += ` (пульс ${step.targetValueLow}-${step.targetValueHigh})`;
      } else if (step.targetType === "pace.zone") {
        const lo = `${Math.floor(step.targetValueLow / 60)}:${(step.targetValueLow % 60).toString().padStart(2, "0")}`;
        const hi = `${Math.floor(step.targetValueHigh / 60)}:${(step.targetValueHigh % 60).toString().padStart(2, "0")}`;
        line += ` (темп ${lo}-${hi})`;
      } else if (step.targetType === "power.zone") {
        line += ` (мощность ${step.targetValueLow}-${step.targetValueHigh}W)`;
      } else if (step.targetType === "cadence") {
        line += ` (каденс ${step.targetValueLow}-${step.targetValueHigh})`;
      }
    }

    if (step.stepType === "repeat" && step.repeatCount) {
      line += ` x${step.repeatCount}`;
    }

    lines.push(line);
  }

  lines.push("");
  lines.push("Создано в GarminCoach AI");

  return lines.join("\n");
}
