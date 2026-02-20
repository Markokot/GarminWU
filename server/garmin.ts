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

async function isSessionAlive(userId: string): Promise<boolean> {
  const client = garminSessions.get(userId);
  if (!client) return false;
  try {
    await client.getUserProfile();
    return true;
  } catch {
    console.log(`[Garmin] Session expired for user ${userId}`);
    garminSessions.delete(userId);
    return false;
  }
}

async function reconnectFromCredentials(userId: string): Promise<boolean> {
  const creds = garminCredentials.get(userId);
  if (!creds) return false;
  console.log(`[Garmin] Re-authenticating from cached credentials for user ${userId}`);
  try {
    await connectGarmin(userId, creds.email, creds.password);
    return true;
  } catch (err: any) {
    console.error(`[Garmin] Re-auth from cache failed: ${err.message}`);
    return false;
  }
}

export async function ensureGarminSession(userId: string, user: User): Promise<void> {
  if (await isSessionAlive(userId)) return;

  if (await reconnectFromCredentials(userId)) return;

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

  const fetchActivities = async (c: any) => {
    const activities = await c.getActivities(0, count);
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
      startLatitude: a.startLatitude || null,
      startLongitude: a.startLongitude || null,
      locationName: a.locationName || null,
    }));
  };

  try {
    return await fetchActivities(client);
  } catch (error: any) {
    console.log("[Garmin] Activities fetch failed, attempting reconnect:", error.message);
    garminSessions.delete(userId);
    if (await reconnectFromCredentials(userId)) {
      const newClient = garminSessions.get(userId);
      if (newClient) return await fetchActivities(newClient);
    }
    throw new Error("Ошибка получения данных из Garmin. Переподключите аккаунт в настройках.");
  }
}

function convertStepType(step: WorkoutStep): { stepTypeId: number; stepTypeKey: string } {
  const map: Record<string, { stepTypeId: number; stepTypeKey: string }> = {
    warmup: { stepTypeId: 1, stepTypeKey: "warmup" },
    interval: { stepTypeId: 3, stepTypeKey: "interval" },
    recovery: { stepTypeId: 4, stepTypeKey: "recovery" },
    rest: { stepTypeId: 5, stepTypeKey: "rest" },
    cooldown: { stepTypeId: 2, stepTypeKey: "cooldown" },
    repeat: { stepTypeId: 6, stepTypeKey: "repeat" },
  };
  return map[step.stepType] || { stepTypeId: 3, stepTypeKey: "interval" };
}

function convertSportType(sportType: string): { sportTypeId: number; sportTypeKey: string } {
  const map: Record<string, { sportTypeId: number; sportTypeKey: string }> = {
    running: { sportTypeId: 1, sportTypeKey: "running" },
    cycling: { sportTypeId: 2, sportTypeKey: "cycling" },
    swimming: { sportTypeId: 4, sportTypeKey: "swimming" },
  };
  return map[sportType] || { sportTypeId: 1, sportTypeKey: "running" };
}

const STROKE_TYPE_MAPPING: Record<string, { strokeTypeId: number; strokeTypeKey: string; displayOrder: number }> = {
  free: { strokeTypeId: 6, strokeTypeKey: "free", displayOrder: 6 },
  backstroke: { strokeTypeId: 2, strokeTypeKey: "backstroke", displayOrder: 2 },
  breaststroke: { strokeTypeId: 3, strokeTypeKey: "breaststroke", displayOrder: 3 },
  fly: { strokeTypeId: 5, strokeTypeKey: "fly", displayOrder: 5 },
};

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

function convertPaceTargets(step: WorkoutStep): { low: number | null; high: number | null } {
  if (step.targetType !== "pace.zone" || step.targetValueLow == null || step.targetValueHigh == null) {
    return { low: step.targetValueLow, high: step.targetValueHigh };
  }
  const speedFromLow = 1000 / step.targetValueLow;
  const speedFromHigh = 1000 / step.targetValueHigh;
  return {
    low: Math.min(speedFromLow, speedFromHigh),
    high: Math.max(speedFromLow, speedFromHigh),
  };
}

function buildGarminSteps(steps: WorkoutStep[], sportType: string = "running"): any[] {
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
        workoutSteps: buildGarminSteps(step.childSteps, sportType),
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

    const isSwimming = sportType === "swimming";

    const targetType = isSwimming && step.targetType === "no.target"
      ? { workoutTargetTypeId: 18, workoutTargetTypeKey: "swim.instruction", displayOrder: 18 }
      : buildTargetType(step);
    const hasTarget = step.targetType !== "no.target";

    const strokeType = isSwimming
      ? (STROKE_TYPE_MAPPING["free"])
      : { strokeTypeId: 0, strokeTypeKey: null, displayOrder: 0 };

    let preferredEndConditionUnit = null;
    if (isSwimming && step.durationType === "distance") {
      preferredEndConditionUnit = { unitId: 1, unitKey: "meter", factor: 100 };
    }

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
      preferredEndConditionUnit,
      endConditionCompare: null,
      endConditionZone: null,
      targetType,
      targetValueOne: hasTarget ? convertPaceTargets(step).low : null,
      targetValueTwo: hasTarget ? convertPaceTargets(step).high : null,
      targetValueUnit: null,
      zoneNumber: null,
      secondaryTargetType: null,
      secondaryTargetValueOne: null,
      secondaryTargetValueTwo: null,
      secondaryTargetValueUnit: null,
      secondaryZoneNumber: null,
      strokeType,
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
  const isSwimming = workout.sportType === "swimming";

  const garminWorkout: any = {
    workoutName: workout.name,
    description: workout.description || "Created by GarminCoach AI",
    sportType: { sportTypeId, sportTypeKey },
    subSportType: isSwimming ? "LAP_SWIMMING" : null,
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType: { sportTypeId, sportTypeKey },
        workoutSteps: buildGarminSteps(workout.steps, workout.sportType),
      },
    ],
  };

  if (isSwimming) {
    garminWorkout.poolLength = 25;
    garminWorkout.poolLengthUnit = { unitId: 1, unitKey: "meter", factor: 100 };
  }

  return garminWorkout;
}

export async function getGarminCalendar(userId: string, year?: number, month?: number): Promise<any> {
  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён");

  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const fetchCalendar = async (c: any) => {
    const calendar = await c.getCalendar(y, m);
    return calendar;
  };

  try {
    return await fetchCalendar(client);
  } catch (error: any) {
    console.log("[Garmin] Calendar fetch failed, attempting reconnect:", error.message);
    garminSessions.delete(userId);
    if (await reconnectFromCredentials(userId)) {
      const newClient = garminSessions.get(userId);
      if (newClient) return await fetchCalendar(newClient);
    }
    throw new Error("Ошибка получения календаря Garmin.");
  }
}

export async function rescheduleGarminWorkout(
  userId: string,
  workoutId: string,
  newDate: string
): Promise<{ success: boolean; scheduledDate: string }> {
  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён");

  const doReschedule = async (c: any) => {
    const scheduleDate = new Date(newDate + "T12:00:00");
    console.log(`[Garmin] Rescheduling workout ${workoutId} to ${newDate}`);
    await c.scheduleWorkout({ workoutId }, scheduleDate);
    console.log(`[Garmin] Workout ${workoutId} rescheduled to ${newDate}`);
    return { success: true, scheduledDate: newDate };
  };

  try {
    return await doReschedule(client);
  } catch (error: any) {
    console.log("[Garmin] Reschedule failed, attempting reconnect:", error.message);
    garminSessions.delete(userId);
    if (await reconnectFromCredentials(userId)) {
      const newClient = garminSessions.get(userId);
      if (newClient) return await doReschedule(newClient);
    }
    throw new Error("Ошибка переноса тренировки в Garmin Connect.");
  }
}

export async function deleteGarminWorkout(userId: string, workoutId: string): Promise<boolean> {
  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён");

  const doDelete = async (c: any) => {
    console.log(`[Garmin] Deleting workout ${workoutId}`);
    await c.deleteWorkout({ workoutId });
    console.log(`[Garmin] Workout ${workoutId} deleted`);
    return true;
  };

  try {
    return await doDelete(client);
  } catch (error: any) {
    console.log("[Garmin] Delete failed, attempting reconnect:", error.message);
    garminSessions.delete(userId);
    if (await reconnectFromCredentials(userId)) {
      const newClient = garminSessions.get(userId);
      if (newClient) return await doDelete(newClient);
    }
    throw new Error("Ошибка удаления тренировки из Garmin Connect.");
  }
}

async function doPushAndSchedule(
  client: any,
  garminWorkout: any,
  workout: { scheduledDate?: string | null }
): Promise<{ workoutId: number | null; scheduled: boolean; scheduledDate?: string }> {
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
    return await doPushAndSchedule(client, garminWorkout, workout);
  } catch (error: any) {
    console.log("[Garmin] Push failed, attempting reconnect and retry:", error.message);
    garminSessions.delete(userId);
    if (await reconnectFromCredentials(userId)) {
      const newClient = garminSessions.get(userId);
      if (newClient) {
        try {
          return await doPushAndSchedule(newClient, garminWorkout, workout);
        } catch (retryErr: any) {
          console.error("[Garmin] Retry after reconnect also failed:", retryErr.message);
        }
      }
    }
    throw new Error("Ошибка при отправке тренировки в Garmin Connect. Попробуйте переподключить аккаунт в настройках.");
  }
}
