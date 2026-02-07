import GarminConnectModule from "@gooin/garmin-connect";
const { GarminConnect } = GarminConnectModule;
import type { Workout, WorkoutStep, User } from "@shared/schema";

const garminSessions: Map<string, any> = new Map();
const garminCredentials: Map<string, { email: string; password: string }> = new Map();

export async function connectGarmin(userId: string, email: string, password: string): Promise<boolean> {
  try {
    const client = new GarminConnect({
      username: email,
      password: password,
    });
    await client.login();
    garminSessions.set(userId, client);
    garminCredentials.set(userId, { email, password });
    return true;
  } catch (error: any) {
    console.error("Garmin connect error:", error.message);
    throw new Error("Не удалось подключиться к Garmin Connect. Проверьте логин и пароль.");
  }
}

export function disconnectGarmin(userId: string) {
  garminSessions.delete(userId);
  garminCredentials.delete(userId);
}

export function isGarminConnected(userId: string): boolean {
  return garminSessions.has(userId);
}

export async function ensureGarminSession(userId: string, user: User): Promise<void> {
  if (garminSessions.has(userId)) return;

  if (user.garminEmail) {
    const creds = garminCredentials.get(userId);
    if (creds) {
      try {
        await connectGarmin(userId, creds.email, creds.password);
        return;
      } catch {}
    }
    throw new Error("Сессия Garmin истекла. Переподключите аккаунт в настройках.");
  }
  throw new Error("Garmin не подключён");
}

export function getGarminClient(userId: string): any | undefined {
  return garminSessions.get(userId);
}

export async function getGarminActivities(userId: string, count: number = 10) {
  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён");

  try {
    const activities = await client.getActivities(0, count);
    return (activities || []).map((a: any) => ({
      activityId: a.activityId,
      activityName: a.activityName || "Тренировка",
      activityType: a.activityType?.typeKey || "unknown",
      distance: a.distance || 0,
      duration: a.duration || 0,
      startTimeLocal: a.startTimeLocal || new Date().toISOString(),
      averageHR: a.averageHR || null,
      maxHR: a.maxHR || null,
      averagePace: a.averageSpeed ? (1000 / a.averageSpeed) : null,
    }));
  } catch (error: any) {
    console.error("Error fetching activities:", error.message);
    throw new Error("Ошибка получения данных из Garmin");
  }
}

function convertStepType(step: WorkoutStep): { stepTypeId: number; stepTypeKey: string } {
  const map: Record<string, { stepTypeId: number; stepTypeKey: string }> = {
    warmup: { stepTypeId: 1, stepTypeKey: "warmup" },
    interval: { stepTypeId: 3, stepTypeKey: "interval" },
    recovery: { stepTypeId: 4, stepTypeKey: "recovery" },
    rest: { stepTypeId: 4, stepTypeKey: "rest" },
    cooldown: { stepTypeId: 2, stepTypeKey: "cooldown" },
    repeat: { stepTypeId: 6, stepTypeKey: "repeat" },
  };
  return map[step.stepType] || { stepTypeId: 3, stepTypeKey: "interval" };
}

function convertSportType(sportType: string): { sportTypeId: number; sportTypeKey: string } {
  const map: Record<string, { sportTypeId: number; sportTypeKey: string }> = {
    running: { sportTypeId: 1, sportTypeKey: "running" },
    cycling: { sportTypeId: 2, sportTypeKey: "cycling" },
    swimming: { sportTypeId: 5, sportTypeKey: "lap_swimming" },
  };
  return map[sportType] || { sportTypeId: 1, sportTypeKey: "running" };
}

function buildGarminSteps(steps: WorkoutStep[]): any[] {
  return steps.map((step, i) => {
    const { stepTypeId, stepTypeKey } = convertStepType(step);
    const base: any = {
      type: "ExecutableStepDTO",
      stepId: null,
      stepOrder: i + 1,
      stepType: { stepTypeId, stepTypeKey },
      childStepId: null,
      endCondition: {
        conditionTypeId: step.durationType === "time" ? 2 : step.durationType === "distance" ? 3 : 1,
        conditionTypeKey: step.durationType === "time" ? "time" : step.durationType === "distance" ? "distance" : "lap.button",
      },
      preferredEndConditionUnit: null,
      endConditionValue: step.durationValue,
      endConditionCompare: null,
      endConditionZone: null,
    };

    if (step.targetType === "no.target") {
      base.targetType = { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target" };
      base.targetValueOne = null;
      base.targetValueTwo = null;
    } else if (step.targetType === "heart.rate.zone") {
      base.targetType = { workoutTargetTypeId: 4, workoutTargetTypeKey: "heart.rate.zone" };
      base.targetValueOne = step.targetValueLow;
      base.targetValueTwo = step.targetValueHigh;
    } else if (step.targetType === "pace.zone") {
      base.targetType = { workoutTargetTypeId: 6, workoutTargetTypeKey: "pace.zone" };
      base.targetValueOne = step.targetValueLow;
      base.targetValueTwo = step.targetValueHigh;
    } else if (step.targetType === "power.zone") {
      base.targetType = { workoutTargetTypeId: 2, workoutTargetTypeKey: "power.zone" };
      base.targetValueOne = step.targetValueLow;
      base.targetValueTwo = step.targetValueHigh;
    } else if (step.targetType === "cadence") {
      base.targetType = { workoutTargetTypeId: 3, workoutTargetTypeKey: "cadence" };
      base.targetValueOne = step.targetValueLow;
      base.targetValueTwo = step.targetValueHigh;
    }

    if (step.stepType === "repeat" && step.childSteps && step.childSteps.length > 0) {
      base.type = "RepeatGroupDTO";
      base.numberOfIterations = step.repeatCount || 2;
      base.workoutSteps = buildGarminSteps(step.childSteps);
      base.smartRepeat = false;
    }

    return base;
  });
}

export function convertToGarminWorkout(workout: Workout): any {
  const { sportTypeId, sportTypeKey } = convertSportType(workout.sportType);

  return {
    workoutName: workout.name,
    description: workout.description || "",
    sportType: { sportTypeId, sportTypeKey },
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType: { sportTypeId, sportTypeKey },
        workoutSteps: buildGarminSteps(workout.steps),
      },
    ],
  };
}

export async function pushWorkoutToGarmin(userId: string, workout: Workout): Promise<number | null> {
  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён. Подключите аккаунт в настройках.");

  const garminWorkout = convertToGarminWorkout(workout);

  try {
    const result = await client.post(
      "https://connect.garmin.com/workout-service/workout",
      garminWorkout
    );
    return result?.workoutId || null;
  } catch (error: any) {
    console.error("Push workout error:", error.message);
    throw new Error("Ошибка при отправке тренировки в Garmin Connect. " + (error.message || ""));
  }
}
