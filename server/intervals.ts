import type { Workout, GarminActivity } from "@shared/schema";

const INTERVALS_API = "https://intervals.icu/api/v1";

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64");
}

const sportTypeMap: Record<string, string> = {
  running: "Run",
  cycling: "Ride",
  swimming: "Swim",
};

const intervalsTypeToLocal: Record<string, string> = {
  Run: "running",
  Ride: "cycling",
  Swim: "swimming",
  Walk: "walking",
  Hike: "hiking",
  WeightTraining: "strength_training",
  VirtualRide: "virtual_ride",
  VirtualRun: "virtual_run",
};

export async function getIntervalsActivities(
  athleteId: string,
  apiKey: string,
  count: number = 10
): Promise<GarminActivity[]> {
  const newest = new Date();
  const oldest = new Date();
  oldest.setDate(oldest.getDate() - 90);

  const params = new URLSearchParams({
    oldest: oldest.toISOString().split("T")[0],
    newest: newest.toISOString().split("T")[0],
  });

  const res = await fetch(`${INTERVALS_API}/athlete/${athleteId}/activities?${params}`, {
    headers: {
      Authorization: authHeader(apiKey),
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("API ключ Intervals.icu истёк. Переподключите в настройках.");
    }
    throw new Error(`Ошибка получения активностей из Intervals.icu (${res.status})`);
  }

  const data: any[] = await res.json();

  const activities = data
    .sort((a, b) => new Date(b.start_date_local || "").getTime() - new Date(a.start_date_local || "").getTime())
    .slice(0, count)
    .map((a: any) => ({
      activityId: typeof a.id === "string" ? parseInt(a.id.replace(/\D/g, "")) || 0 : a.id || 0,
      activityName: a.name || "Тренировка",
      activityType: intervalsTypeToLocal[a.type] || a.type || "unknown",
      distance: a.distance || 0,
      duration: a.moving_time || a.elapsed_time || 0,
      startTimeLocal: a.start_date_local || new Date().toISOString(),
      averageHR: a.avg_hr || undefined,
      maxHR: a.max_hr || undefined,
      averagePace: a.avg_speed ? (1000 / a.avg_speed) : undefined,
    }));

  console.log(`[Intervals] Fetched ${activities.length} activities for athlete ${athleteId}`);
  return activities;
}

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

async function fetchAthleteMaxHR(athleteId: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(`${INTERVALS_API}/athlete/${athleteId}`, {
      headers: { Authorization: authHeader(apiKey) },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.max_hr && data.max_hr > 0) {
      console.log(`[Intervals] Athlete maxHR from profile: ${data.max_hr}`);
      return data.max_hr;
    }
    return null;
  } catch (e) {
    console.error("[Intervals] Failed to fetch athlete maxHR:", e);
    return null;
  }
}

export async function pushWorkoutToIntervals(
  athleteId: string,
  apiKey: string,
  workout: Workout,
  userAge?: number
): Promise<{ eventId: string; scheduled: boolean; scheduledDate?: string }> {
  const sportType = sportTypeMap[workout.sportType] || "Run";

  let maxHR = await fetchAthleteMaxHR(athleteId, apiKey);
  if (!maxHR && userAge) {
    maxHR = Math.round(220 - userAge);
    console.log(`[Intervals] Using estimated maxHR from age ${userAge}: ${maxHR}`);
  }
  const description = buildWorkoutDescription(workout, maxHR);
  console.log(`[Intervals] maxHR used: ${maxHR}, workout description:\n${description}`);

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
    const totalMinutes = Math.floor(durationValue / 60);
    const s = durationValue % 60;
    if (totalMinutes > 0 && s > 0) return `${totalMinutes}m${s}s`;
    if (totalMinutes > 0) return `${totalMinutes}m`;
    return `${s}s`;
  } else if (durationType === "distance") {
    if (durationValue >= 1000) {
      const km = durationValue / 1000;
      return km % 1 === 0 ? `${km}km` : `${km.toFixed(2)}km`.replace(/0+km$/, "km");
    }
    return `${durationValue}mtr`;
  }
  return "";
}

function formatTarget(step: { targetType: string; targetValueLow: number | null; targetValueHigh: number | null }, maxHR: number | null = null): string {
  if (step.targetType === "no.target" || step.targetValueLow == null || step.targetValueHigh == null) return "";
  if (step.targetType === "heart.rate.zone") {
    if (maxHR && maxHR > 0) {
      const pctLow = Math.round((step.targetValueLow / maxHR) * 100);
      const pctHigh = Math.round((step.targetValueHigh / maxHR) * 100);
      if (pctLow === pctHigh) {
        return ` ${pctHigh}% HR`;
      }
      return ` ${pctLow}-${pctHigh}% HR`;
    }
    if (step.targetValueLow === step.targetValueHigh) {
      return `HR ${step.targetValueHigh}`;
    }
    return `HR ${step.targetValueLow}-${step.targetValueHigh}`;
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

function buildStepLine(step: { durationType: string; durationValue: number | null; targetType: string; targetValueLow: number | null; targetValueHigh: number | null }, maxHR: number | null = null): string {
  const dur = formatDuration(step.durationType, step.durationValue);
  const target = formatTarget(step, maxHR);
  if (step.targetType === "heart.rate.zone" && !maxHR && target) {
    return `- ${target} ${dur}`.trim();
  }
  return `- ${dur}${target}`.trim();
}

function buildWorkoutDescription(workout: Workout, maxHR: number | null = null): string {
  const parts: string[] = [];

  if (workout.description) {
    parts.push(workout.description);
  }

  for (const step of workout.steps) {
    if (step.stepType === "warmup") {
      const section: string[] = [];
      section.push("Warmup");
      section.push(buildStepLine(step, maxHR));
      parts.push(section.join("\n"));
    } else if (step.stepType === "cooldown") {
      const section: string[] = [];
      section.push("Cooldown");
      section.push(buildStepLine(step, maxHR));
      parts.push(section.join("\n"));
    } else if (step.stepType === "repeat" && step.repeatCount && step.childSteps) {
      const section: string[] = [];
      section.push(`Main set ${step.repeatCount}x`);
      for (const child of step.childSteps) {
        if (child.stepType === "recovery" || child.stepType === "rest") {
          const dur = formatDuration(child.durationType, child.durationValue);
          const target = formatTarget(child, maxHR);
          if (target) {
            section.push(`- ${dur}${target}`);
          } else {
            section.push(`- ${dur} rest`);
          }
        } else {
          section.push(buildStepLine(child, maxHR));
        }
      }
      parts.push(section.join("\n"));
    } else if (step.stepType === "recovery" || step.stepType === "rest") {
      const dur = formatDuration(step.durationType, step.durationValue);
      const target = formatTarget(step, maxHR);
      if (target) {
        parts.push(`- ${dur}${target}`);
      } else {
        parts.push(`- ${dur} rest`);
      }
    } else {
      parts.push(buildStepLine(step, maxHR));
    }
  }

  return parts.join("\n\n");
}
