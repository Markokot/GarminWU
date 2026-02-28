import GarminConnectModule from "@gooin/garmin-connect";
const { GarminConnect } = GarminConnectModule;
import type { Workout, WorkoutStep, User } from "@shared/schema";
import { debugLog } from "./debug-log";


const garminSessions: Map<string, any> = new Map();
const garminCredentials: Map<string, { email: string; password: string }> = new Map();
const garminLastUsed: Map<string, number> = new Map();

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const activitiesCache: Map<string, CacheEntry<any[]>> = new Map();
const calendarCache: Map<string, CacheEntry<any>> = new Map();
const dailyStatsCache: Map<string, CacheEntry<GarminDailyStats>> = new Map();

export interface GarminDailyStats {
  stressLevel: number | null;
  bodyBattery: number | null;
  steps: number | null;
  stepsYesterday: number | null;
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateGarminCache(userId: string): void {
  for (const key of activitiesCache.keys()) {
    if (key.startsWith(userId)) activitiesCache.delete(key);
  }
  for (const key of calendarCache.keys()) {
    if (key.startsWith(userId)) calendarCache.delete(key);
  }
  for (const key of dailyStatsCache.keys()) {
    if (key.startsWith(userId)) dailyStatsCache.delete(key);
  }
}

export async function connectGarmin(userId: string, email: string, password: string): Promise<boolean> {
  try {
    const client = new GarminConnect({
      username: email,
      password: password,
    });
    await client.login();
    garminSessions.set(userId, client);
    garminCredentials.set(userId, { email, password });
    garminLastUsed.set(userId, Date.now());
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

const SESSION_CHECK_INTERVAL = 10 * 60 * 1000;

async function isSessionAlive(userId: string): Promise<boolean> {
  const client = garminSessions.get(userId);
  if (!client) return false;
  
  const lastUsed = garminLastUsed.get(userId) || 0;
  if (Date.now() - lastUsed < SESSION_CHECK_INTERVAL) {
    return true;
  }
  
  try {
    await client.getUserProfile();
    garminLastUsed.set(userId, Date.now());
    return true;
  } catch {
    console.log(`[Garmin] Session expired for user ${userId}`);
    garminSessions.delete(userId);
    garminLastUsed.delete(userId);
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
  const cacheKey = `${userId}-${count}`;
  const cached = getCached(activitiesCache, cacheKey);
  if (cached) {
    console.log(`[Garmin] Activities cache hit for user ${userId}`);
    return cached;
  }

  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён");

  const fetchActivities = async (c: any) => {
    const activities = await c.getActivities(0, count);
    const result = (activities || []).map((a: any) => ({
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
    setCache(activitiesCache, cacheKey, result);
    garminLastUsed.set(userId, Date.now());
    return result;
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
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();

  const cacheKey = `${userId}-${y}-${m}`;
  const cached = getCached(calendarCache, cacheKey);
  if (cached) {
    console.log(`[Garmin] Calendar cache hit for ${y}-${String(m + 1).padStart(2, '0')}`);
    return cached;
  }

  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён");

  const fetchCalendar = async (c: any) => {
    console.log(`[Garmin] Fetching calendar for year=${y} month=${m} (0-based, real month=${m + 1})`);
    const calendar = await c.getCalendar(y, m);
    const itemCount = calendar?.calendarItems?.length ?? 0;
    const workoutCount = calendar?.calendarItems?.filter((i: any) => i.itemType === "workout")?.length ?? 0;
    console.log(`[Garmin] Calendar ${y}-${String(m + 1).padStart(2, '0')}: ${itemCount} total items, ${workoutCount} workouts`);
    setCache(calendarCache, cacheKey, calendar);
    garminLastUsed.set(userId, Date.now());
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

async function findScheduleIdFromCalendar(
  c: any,
  workoutId: string,
  currentDate?: string
): Promise<number | null> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const calendar = await c.getCalendar(year, month);
    const items = calendar?.calendarItems || [];

    let nextMonthItems: any[] = [];
    try {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const cal2 = await c.getCalendar(nextYear, nextMonth);
      nextMonthItems = cal2?.calendarItems || [];
    } catch {}

    const allItems = [...items, ...nextMonthItems];
    const wId = Number(workoutId);

    for (const item of allItems) {
      if (item.itemType === "workout" && item.workoutId === wId) {
        if (currentDate && item.date !== currentDate) continue;
        if (item.id) {
          console.log(`[Garmin FindSchedule] MATCH: scheduleId=${item.id} for workoutId=${workoutId} on ${item.date}`);
          return item.id;
        }
      }
    }
    console.log(`[Garmin FindSchedule] No scheduleId found for workoutId=${workoutId}${currentDate ? ` on ${currentDate}` : ''}`);
    return null;
  } catch (err: any) {
    console.log(`[Garmin] Error searching calendar for scheduleId: ${err.message}`);
    return null;
  }
}

export async function rescheduleGarminWorkout(
  userId: string,
  workoutId: string,
  newDate: string,
  currentDate?: string
): Promise<{ success: boolean; scheduledDate: string }> {
  const client = garminSessions.get(userId);
  if (!client) throw new Error("Garmin не подключён");

  const doReschedule = async (c: any) => {
    const scheduleId = await findScheduleIdFromCalendar(c, workoutId, currentDate);
    
    if (scheduleId) {
      try {
        const scheduleUrl = (c as any).url?.SCHEDULE_WORKOUTS;
        if (scheduleUrl) {
          const deleteUrl = `${scheduleUrl}${scheduleId}`;
          await (c as any).client.delete(deleteUrl);
        }
      } catch (delErr: any) {
        console.log(`[Garmin] Error deleting old schedule: ${delErr.message}`);
      }
    }

    const scheduleDate = new Date(newDate + "T12:00:00");
    const numericWorkoutId = Number(workoutId);
    await c.scheduleWorkout({ workoutId: numericWorkoutId }, scheduleDate);
    
    invalidateGarminCache(userId);
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

export async function getGarminDailyStats(userId: string): Promise<GarminDailyStats> {
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `${userId}-${today}`;
  const cached = getCached(dailyStatsCache, cacheKey);
  if (cached) {
    console.log(`[Garmin] DailyStats cache hit for user ${userId}`);
    return cached;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const client = garminSessions.get(userId);
  if (!client) {
    debugLog("Health API", "No Garmin client available for daily stats");
    return { stressLevel: null, bodyBattery: null, steps: null, stepsYesterday: null };
  }

  const result: GarminDailyStats = { stressLevel: null, bodyBattery: null, steps: null, stepsYesterday: null };

  const fetchStats = async (c: any) => {
    try {
      const stepsVal = await c.getSteps(new Date());
      if (typeof stepsVal === "number") {
        result.steps = stepsVal;
      }
      debugLog("Health API", `Steps today: ${result.steps}`);
    } catch (err: any) {
      debugLog("Health API", `Steps today fetch failed: ${err.message}`);
    }

    try {
      const yesterdayDate = new Date(Date.now() - 86400000);
      const stepsYesterdayVal = await c.getSteps(yesterdayDate);
      if (typeof stepsYesterdayVal === "number") {
        result.stepsYesterday = stepsYesterdayVal;
      }
      debugLog("Health API", `Steps yesterday: ${result.stepsYesterday}`);
    } catch (err: any) {
      debugLog("Health API", `Steps yesterday fetch failed: ${err.message}`);
    }

    const domain = c.url?.domain || "garmin.com";
    const apiBase = `https://connectapi.${domain}`;

    try {
      const stressUrl = `${apiBase}/usersummary-service/usersummary/daily/${today}/${today}`;
      debugLog("Health API", `Stress URL: ${stressUrl}`);
      const stressData = await c.get(stressUrl);
      debugLog("Health API", `Stress raw response type: ${typeof stressData}, isArray: ${Array.isArray(stressData)}`, {
        keys: stressData ? Object.keys(stressData).slice(0, 20) : null,
        sample: stressData ? JSON.stringify(stressData).substring(0, 500) : null,
      });
      if (stressData) {
        const stress = Array.isArray(stressData) ? stressData[0] : stressData;
        if (stress?.averageStressLevel != null && stress.averageStressLevel > 0) {
          result.stressLevel = stress.averageStressLevel;
        }
        debugLog("Health API", `Stress parsed: averageStressLevel=${stress?.averageStressLevel}, result=${result.stressLevel}`);
      }
    } catch (err: any) {
      debugLog("Health API", `Stress fetch FAILED: ${err.message}`, { stack: err.stack?.substring(0, 300) });
    }

    try {
      const bbUrl = `${apiBase}/wellness-service/wellness/bodyBattery/dates/${today}/${today}`;
      debugLog("Health API", `Body Battery URL: ${bbUrl}`);
      const bbData = await c.get(bbUrl);
      debugLog("Health API", `BB raw response type: ${typeof bbData}, isArray: ${Array.isArray(bbData)}`, {
        sample: bbData ? JSON.stringify(bbData).substring(0, 500) : null,
      });
      if (bbData && Array.isArray(bbData) && bbData.length > 0) {
        const dayData = bbData[0];
        debugLog("Health API", `BB dayData keys: ${Object.keys(dayData || {}).join(", ")}`, {
          charged: dayData?.charged,
          drained: dayData?.drained,
          hasStatList: !!dayData?.bodyBatteryStatList,
          statListLength: dayData?.bodyBatteryStatList?.length,
        });
        const charged = dayData?.charged;
        const drained = dayData?.drained;
        if (charged != null && drained != null) {
          const currentBB = Math.max(0, Math.min(100, 100 + charged - drained));
          result.bodyBattery = currentBB;
        }
        if (dayData?.bodyBatteryStatList) {
          const list = dayData.bodyBatteryStatList;
          if (Array.isArray(list) && list.length > 0) {
            const latest = list[list.length - 1];
            if (latest?.bodyBatteryLevel != null) {
              result.bodyBattery = latest.bodyBatteryLevel;
            }
          }
        }
      } else if (bbData && !Array.isArray(bbData)) {
        debugLog("Health API", `BB unexpected format (not array)`, {
          keys: Object.keys(bbData).slice(0, 20),
          sample: JSON.stringify(bbData).substring(0, 500),
        });
        if (bbData?.bodyBatteryValuesArray) {
          const arr = bbData.bodyBatteryValuesArray;
          if (Array.isArray(arr) && arr.length > 0) {
            const latest = arr[arr.length - 1];
            if (Array.isArray(latest) && latest.length >= 2) {
              result.bodyBattery = latest[1];
            }
          }
          debugLog("Health API", `BB from bodyBatteryValuesArray: ${result.bodyBattery}`);
        }
      }
      debugLog("Health API", `Body Battery final: ${result.bodyBattery}`);
    } catch (err: any) {
      debugLog("Health API", `Body Battery fetch FAILED: ${err.message}`, { stack: err.stack?.substring(0, 300) });
    }

    debugLog("Health API", `Final results — Stress: ${result.stressLevel}, BB: ${result.bodyBattery}, Steps: ${result.steps}, StepsYesterday: ${result.stepsYesterday}`);

    garminLastUsed.set(userId, Date.now());
    setCache(dailyStatsCache, cacheKey, result);
    return result;
  };

  try {
    return await fetchStats(client);
  } catch (error: any) {
    console.log("[Garmin] DailyStats fetch failed, attempting reconnect:", error.message);
    garminSessions.delete(userId);
    if (await reconnectFromCredentials(userId)) {
      const newClient = garminSessions.get(userId);
      if (newClient) return await fetchStats(newClient);
    }
    return result;
  }
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
