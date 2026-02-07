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
    console.log(`[Garmin] Connected successfully for user ${userId}`);
    return true;
  } catch (error: any) {
    console.error("[Garmin] Connect error:", error.message);
    throw new Error("Не удалось подключиться к Garmin Connect. Проверьте логин и пароль.");
  }
}

export function disconnectGarmin(userId: string) {
  garminSessions.delete(userId);
  garminCredentials.delete(userId);
  console.log(`[Garmin] Disconnected user ${userId}`);
}

export function isGarminConnected(userId: string): boolean {
  return garminSessions.has(userId);
}

export async function ensureGarminSession(userId: string, user: User): Promise<void> {
  if (garminSessions.has(userId)) return;

  const creds = garminCredentials.get(userId);
  if (creds) {
    console.log(`[Garmin] Re-authenticating from cached credentials for user ${userId}`);
    try {
      await connectGarmin(userId, creds.email, creds.password);
      return;
    } catch (err: any) {
      console.error(`[Garmin] Re-auth from cache failed: ${err.message}`);
    }
  }

  if (user.garminEmail) {
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
    console.error("[Garmin] Error fetching activities:", error.message);
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

function buildEndCondition(step: WorkoutStep) {
  if (step.durationType === "time") {
    return {
      conditionTypeId: 2,
      conditionTypeKey: "time",
      displayOrder: 2,
      displayable: true,
    };
  } else if (step.durationType === "distance") {
    return {
      conditionTypeId: 3,
      conditionTypeKey: "distance",
      displayOrder: 3,
      displayable: true,
    };
  }
  return {
    conditionTypeId: 1,
    conditionTypeKey: "lap.button",
    displayOrder: 1,
    displayable: true,
  };
}

function buildTargetType(step: WorkoutStep) {
  const targetMap: Record<string, { workoutTargetTypeId: number; displayOrder: number }> = {
    "no.target": { workoutTargetTypeId: 1, displayOrder: 1 },
    "pace.zone": { workoutTargetTypeId: 6, displayOrder: 6 },
    "heart.rate.zone": { workoutTargetTypeId: 4, displayOrder: 4 },
    "power.zone": { workoutTargetTypeId: 2, displayOrder: 2 },
    "cadence": { workoutTargetTypeId: 3, displayOrder: 3 },
  };
  const target = targetMap[step.targetType] || targetMap["no.target"];
  return {
    workoutTargetTypeId: target.workoutTargetTypeId,
    workoutTargetTypeKey: step.targetType,
    displayOrder: target.displayOrder,
  };
}

function buildGarminSteps(steps: WorkoutStep[]): any[] {
  return steps.map((step, i) => {
    const { stepTypeId, stepTypeKey } = convertStepType(step);

    if (step.stepType === "repeat" && step.childSteps && step.childSteps.length > 0) {
      return {
        type: "RepeatGroupDTO",
        stepId: null,
        stepOrder: i + 1,
        stepType: {
          stepTypeId: 6,
          stepTypeKey: "repeat",
          displayOrder: 6,
        },
        numberOfIterations: step.repeatCount || 2,
        smartRepeat: false,
        childStepId: null,
        workoutSteps: buildGarminSteps(step.childSteps),
      };
    }

    const endCondition = buildEndCondition(step);

    let endConditionValue = step.durationValue;
    if (step.durationType === "time" && endConditionValue) {
      endConditionValue = endConditionValue;
    }
    if (step.durationType === "distance" && endConditionValue) {
      endConditionValue = endConditionValue;
    }

    const targetType = buildTargetType(step);
    const hasTarget = step.targetType !== "no.target";

    const garminStep: any = {
      type: "ExecutableStepDTO",
      stepId: null,
      stepOrder: i + 1,
      stepType: {
        stepTypeId,
        stepTypeKey,
        displayOrder: stepTypeId,
      },
      childStepId: null,
      description: null,
      endCondition,
      endConditionValue: endConditionValue,
      preferredEndConditionUnit: null,
      endConditionCompare: null,
      endConditionZone: null,
      targetType,
      targetValueOne: hasTarget ? step.targetValueLow : null,
      targetValueTwo: hasTarget ? step.targetValueHigh : null,
      targetValueUnit: null,
      zoneNumber: null,
      secondaryTargetType: null,
      secondaryTargetValueOne: null,
      secondaryTargetValueTwo: null,
      secondaryTargetValueUnit: null,
      secondaryZoneNumber: null,
      strokeType: {
        strokeTypeId: 0,
        strokeTypeKey: null,
        displayOrder: 0,
      },
      equipmentType: {
        equipmentTypeId: 0,
        equipmentTypeKey: null,
        displayOrder: 0,
      },
      category: null,
      exerciseName: null,
      workoutProvider: null,
      providerExerciseSourceId: null,
      weightValue: null,
      weightUnit: null,
    };

    return garminStep;
  });
}

export function convertToGarminWorkout(workout: { name: string; description?: string; sportType: string; steps: WorkoutStep[] }): any {
  const { sportTypeId, sportTypeKey } = convertSportType(workout.sportType);

  return {
    workoutName: workout.name,
    description: workout.description || "Created by GarminCoach AI",
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

export async function pushWorkoutToGarmin(
  userId: string,
  workout: { name: string; description?: string; sportType: string; steps: WorkoutStep[]; scheduledDate?: string | null }
): Promise<{ workoutId: number | null; scheduled: boolean; scheduledDate?: string }> {
  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён. Подключите аккаунт в настройках.");

  const garminWorkout = convertToGarminWorkout(workout);

  console.log("[Garmin] Pushing workout:", JSON.stringify(garminWorkout, null, 2));

  try {
    const result = await client.addWorkout(garminWorkout);
    const workoutId = result?.workoutId || null;
    console.log("[Garmin] Push workout result, workoutId:", workoutId);

    let scheduled = false;
    let scheduledDate: string | undefined;

    if (workoutId && workout.scheduledDate) {
      try {
        const dateStr = workout.scheduledDate;
        const scheduleDate = new Date(dateStr + "T12:00:00");
        console.log(`[Garmin] Scheduling workout ${workoutId} for ${dateStr}`);
        await client.scheduleWorkout(
          { workoutId: String(workoutId) },
          scheduleDate
        );
        scheduled = true;
        scheduledDate = dateStr;
        console.log(`[Garmin] Workout ${workoutId} scheduled for ${dateStr}`);
      } catch (schedErr: any) {
        console.error("[Garmin] Schedule error:", schedErr.message);
      }
    }

    return { workoutId, scheduled, scheduledDate };
  } catch (error: any) {
    console.error("[Garmin] Push workout error:", error.message);
    if (error.response) {
      console.error("[Garmin] Response status:", error.response?.status);
      try {
        const body = typeof error.response?.data === "string" ? error.response.data : JSON.stringify(error.response?.data);
        console.error("[Garmin] Response body:", body?.substring(0, 1000));
      } catch {}
    }
    if (error.data) {
      console.error("[Garmin] Error data:", typeof error.data === "string" ? error.data.substring(0, 500) : JSON.stringify(error.data));
    }
    throw new Error("Ошибка при отправке тренировки в Garmin Connect: " + (error.message || "Unknown error"));
  }
}
