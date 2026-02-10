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

function formatDuration(durationType: string, durationValue: number | null): string {
  if (!durationValue) return "";
  if (durationType === "time") {
    const m = Math.floor(durationValue / 60);
    const s = durationValue % 60;
    if (s === 0) return `${m}m`;
    return `${m}m${s}`;
  } else if (durationType === "distance") {
    if (durationValue >= 1000) {
      const km = durationValue / 1000;
      return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`;
    }
    return `${durationValue}m`;
  }
  return "";
}

function formatTarget(step: { targetType: string; targetValueLow: number | null; targetValueHigh: number | null }): string {
  if (step.targetType === "no.target" || !step.targetValueLow || !step.targetValueHigh) return "";
  if (step.targetType === "heart.rate.zone") {
    return ` ${step.targetValueLow}-${step.targetValueHigh}bpm`;
  } else if (step.targetType === "pace.zone") {
    const lo = `${Math.floor(step.targetValueLow / 60)}:${(step.targetValueLow % 60).toString().padStart(2, "0")}`;
    const hi = `${Math.floor(step.targetValueHigh / 60)}:${(step.targetValueHigh % 60).toString().padStart(2, "0")}`;
    return ` ${lo}-${hi}/km`;
  } else if (step.targetType === "power.zone") {
    return ` ${step.targetValueLow}-${step.targetValueHigh}w`;
  } else if (step.targetType === "cadence") {
    return ` ${step.targetValueLow}-${step.targetValueHigh}rpm`;
  }
  return "";
}

function buildStepLine(step: { durationType: string; durationValue: number | null; targetType: string; targetValueLow: number | null; targetValueHigh: number | null }): string {
  const dur = formatDuration(step.durationType, step.durationValue);
  const target = formatTarget(step);
  return `- ${dur}${target}`.trim();
}

function buildWorkoutDescription(workout: Workout): string {
  const lines: string[] = [];

  if (workout.description) {
    lines.push(workout.description);
    lines.push("");
  }

  for (const step of workout.steps) {
    if (step.stepType === "warmup") {
      lines.push("Warmup");
      lines.push(buildStepLine(step));
    } else if (step.stepType === "cooldown") {
      lines.push("Cooldown");
      lines.push(buildStepLine(step));
    } else if (step.stepType === "repeat" && step.repeatCount && step.childSteps) {
      lines.push(`${step.repeatCount}x`);
      for (const child of step.childSteps) {
        if (child.stepType === "recovery") {
          const dur = formatDuration(child.durationType, child.durationValue);
          lines.push(`- ${dur} recovery`);
        } else {
          lines.push(buildStepLine(child));
        }
      }
    } else if (step.stepType === "recovery" || step.stepType === "rest") {
      const dur = formatDuration(step.durationType, step.durationValue);
      lines.push(`- ${dur} recovery`);
    } else {
      lines.push(buildStepLine(step));
    }
  }

  return lines.join("\n");
}
