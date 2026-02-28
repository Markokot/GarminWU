import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { loginSchema, registerSchema, garminConnectSchema, intervalsConnectSchema, createWorkoutSchema, workoutStepSchema, swimStructuredWatchModels, type GarminWatchModel } from "@shared/schema";
import { z } from "zod";
import { connectGarmin, disconnectGarmin, getGarminActivities, pushWorkoutToGarmin, isGarminConnected, getGarminCalendar, rescheduleGarminWorkout, deleteGarminWorkout, invalidateGarminCache, getGarminDailyStats } from "./garmin";
import { debugLog, getDebugLogs, clearDebugLogs } from "./debug-log";
import { verifyIntervalsConnection, pushWorkoutToIntervals, getIntervalsActivities, rescheduleIntervalsWorkout, getIntervalsCalendarEvents } from "./intervals";
import { chat, chatStream, parseAiResponse, pickPromptVariant } from "./ai";
import { runAllTests } from "./tests";
import { encrypt, decrypt } from "./crypto";
import { enrichActivitiesWithCity, detectLikelyCity, getWeatherForecast, buildWeatherContext, reverseGeocode } from "./weather";
import { calculateReadiness } from "./readiness";

const MemStore = MemoryStore(session);

const SYNC_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const lastSyncTimes = new Map<string, string>();

export function buildCalendarContext(calendar: any, now: Date): string {
  const scheduledWorkouts: { date: string; name: string; workoutId?: string; sportType?: string }[] = [];

  if (calendar?.calendarItems) {
    for (const item of calendar.calendarItems) {
      if (item.itemType === "workout" && item.date) {
        scheduledWorkouts.push({
          date: item.date,
          name: item.title || item.workoutName || "Тренировка",
          workoutId: item.workoutId ? String(item.workoutId) : undefined,
          sportType: item.sportTypeKey || undefined,
        });
      }
    }
  }

  if (scheduledWorkouts.length === 0) return "";

  scheduledWorkouts.sort((a, b) => a.date.localeCompare(b.date));

  const today = now.toISOString().split("T")[0];
  const upcoming = scheduledWorkouts.filter((w) => w.date >= today);
  const past = scheduledWorkouts.filter((w) => w.date < today);

  let ctx = "\n\n===== ЗАПЛАНИРОВАННЫЕ ТРЕНИРОВКИ В GARMIN =====";
  if (upcoming.length > 0) {
    ctx += "\nПредстоящие:";
    for (const w of upcoming.slice(0, 14)) {
      const label = w.date === today ? "(СЕГОДНЯ)" : "";
      ctx += `\n- ${w.date} ${label}: ${w.name}${w.workoutId ? ` [ID:${w.workoutId}]` : ""}`;
    }
  }
  if (past.length > 0) {
    const recentPast = past.slice(-3);
    ctx += "\nНедавно прошедшие:";
    for (const w of recentPast) {
      ctx += `\n- ${w.date}: ${w.name}${w.workoutId ? ` [ID:${w.workoutId}]` : ""}`;
    }
  }

  ctx += `\n\nЕсли пользователь просит перенести тренировку — создай блок \`\`\`reschedule_json с данными:
{
  "workoutId": "ID тренировки из списка выше",
  "currentDate": "текущая дата тренировки YYYY-MM-DD",
  "newDate": "новая дата YYYY-MM-DD",
  "reason": "причина переноса"
}
\`\`\`
Если пользователь говорит "перенеси на завтра" или "не могу сегодня" — вычисли новую дату от текущей и создай reschedule_json.
Если пользователь заболел — предложи удалить ближайшие тренировки и создать восстановительный план после выздоровления.
Если пропустил тренировку — не просто переноси, а адаптируй: лёгкая тренировка могла быть пропущена без последствий, а ключевую интервальную лучше перенести.`;

  return ctx;
}


async function ensureGarminSessionWithDecrypt(userId: string, user: any): Promise<void> {
  if (isGarminConnected(userId)) return;

  if (!user.garminEmail || !user.garminPassword) {
    throw new Error("Garmin не подключён");
  }

  try {
    const garminPass = decrypt(user.garminPassword);
    await connectGarmin(userId, user.garminEmail, garminPass);
    console.log(`[Garmin] Lazy connect for user ${userId}`);
  } catch (err: any) {
    console.error(`[Garmin] Lazy connect failed: ${err.message}`);
    throw new Error("Сессия Garmin истекла. Переподключите аккаунт в настройках.");
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new MemStore({ checkPeriod: 86400000 }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(400).json({ message: "Пользователь с таким именем уже существует" });
      }
      const user = await storage.createUser({
        username: parsed.username,
        password: parsed.password,
        sportTypes: parsed.sportTypes,
        goals: parsed.goals || "",
        fitnessLevel: parsed.fitnessLevel,
      });
      req.session.userId = user.id;
      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(parsed.username);
      if (!user) {
        return res.status(401).json({ message: "Неверное имя пользователя или пароль" });
      }
      const valid = await storage.verifyPassword(user, parsed.password);
      if (!valid) {
        return res.status(401).json({ message: "Неверное имя пользователя или пароль" });
      }
      req.session.userId = user.id;
      await storage.updateUser(user.id, { lastLogin: new Date().toISOString() });

      const updatedUser = await storage.getUser(user.id);
      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = updatedUser!;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка входа" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { profileSchema } = await import("@shared/schema");
      const parsed = profileSchema.parse(req.body);
      const user = await storage.updateUser(req.session.userId!, {
        sportTypes: parsed.sportTypes,
        goals: parsed.goals || "",
        fitnessLevel: parsed.fitnessLevel,
        age: parsed.age ?? undefined,
        weeklyHours: parsed.weeklyHours ?? undefined,
        experienceYears: parsed.experienceYears ?? undefined,
        injuries: parsed.injuries,
        personalRecords: parsed.personalRecords,
        preferences: parsed.preferences,
        garminWatch: parsed.garminWatch,
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/onboarding-shown", requireAuth, async (req, res) => {
    try {
      const user = await storage.updateUser(req.session.userId!, { onboardingShown: true });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Garmin routes
  app.post("/api/garmin/connect", requireAuth, async (req, res) => {
    try {
      const parsed = garminConnectSchema.parse(req.body);
      await connectGarmin(req.session.userId!, parsed.garminEmail, parsed.garminPassword);
      const user = await storage.updateUser(req.session.userId!, {
        garminEmail: parsed.garminEmail,
        garminPassword: encrypt(parsed.garminPassword),
        garminConnected: true,
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/garmin/disconnect", requireAuth, async (req, res) => {
    try {
      disconnectGarmin(req.session.userId!);
      const user = await storage.updateUser(req.session.userId!, {
        garminConnected: false,
        garminEmail: undefined,
        garminPassword: undefined,
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  async function fetchActivitiesWithFallback(userId: string, user: any, count: number = 10) {
    if (user.garminConnected) {
      try {
        await ensureGarminSessionWithDecrypt(userId, user);
        const activities = await getGarminActivities(userId, count);
        return { activities, source: "garmin" };
      } catch (err: any) {
        console.log(`[Activities] Garmin failed for user ${userId}: ${err.message}`);
        if (user.intervalsConnected && user.intervalsAthleteId && user.intervalsApiKey) {
          console.log(`[Activities] Falling back to Intervals.icu for user ${userId}`);
          const apiKey = decrypt(user.intervalsApiKey);
          const activities = await getIntervalsActivities(user.intervalsAthleteId, apiKey, count);
          return { activities, source: "intervals" };
        }
        throw err;
      }
    }

    if (user.intervalsConnected && user.intervalsAthleteId && user.intervalsApiKey) {
      const apiKey = decrypt(user.intervalsApiKey);
      const activities = await getIntervalsActivities(user.intervalsAthleteId, apiKey, count);
      return { activities, source: "intervals" };
    }

    throw new Error("Нет подключённых источников данных. Подключите Garmin или Intervals.icu в настройках.");
  }

  app.get("/api/activities", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      debugLog("Activities", `Запрос активностей для ${user.username}`, {
        garminConnected: user.garminConnected,
        intervalsConnected: user.intervalsConnected,
      });

      const cachedIds = await storage.getCachedActivityIds(userId);
      let fetchSource = user.garminConnected ? "garmin" : "intervals";

      if (!lastSyncTimes.has(userId) && cachedIds.size > 0) {
        const dbSyncTime = await storage.getLastCachedAt(userId);
        if (dbSyncTime) {
          lastSyncTimes.set(userId, dbSyncTime);
          debugLog("Activities", `Время синхронизации восстановлено из БД: ${dbSyncTime}`);
        }
      }

      const lastSync = lastSyncTimes.get(userId);
      const lastSyncMs = lastSync ? new Date(lastSync).getTime() : 0;
      const sinceLastSync = Date.now() - lastSyncMs;
      const cooldownActive = cachedIds.size > 0 && sinceLastSync < SYNC_COOLDOWN_MS;

      debugLog("Activities", `Состояние кэша`, {
        cachedCount: cachedIds.size,
        cooldownActive,
        lastSync: lastSync || "нет",
        sinceLastSyncMin: Math.round(sinceLastSync / 60000),
      });

      if (cooldownActive) {
        debugLog("Activities", `Cooldown активен, отдаём из кэша (синхронизировано ${Math.round(sinceLastSync / 60000)} мин назад)`);
      } else if (cachedIds.size === 0) {
        debugLog("Activities", `Кэш пуст — начальная загрузка 30 активностей`);
        try {
          const result = await fetchActivitiesWithFallback(userId, user, 30);
          fetchSource = result.source;
          debugLog("Activities", `Начальная загрузка: получено ${result.activities.length} активностей из ${result.source}`);
          if (result.activities.length > 0) {
            await storage.saveCachedActivities(userId, result.activities, result.source);
            debugLog("Activities", `Сохранено в кэш: ${result.activities.length} активностей`);
          }
          lastSyncTimes.set(userId, new Date().toISOString());
        } catch (err: any) {
          debugLog("Activities", `ОШИБКА начальной загрузки: ${err.message}`, { stack: err.stack });
          throw err;
        }
      } else {
        debugLog("Activities", `Дельта-синхронизация (кэш: ${cachedIds.size} записей)`);
        try {
          const steps = [3, 10, 30];
          for (const count of steps) {
            const result = await fetchActivitiesWithFallback(userId, user, count);
            fetchSource = result.source;
            const hasOverlap = result.activities.some((a: any) => cachedIds.has(a.activityId));
            const newActivities = result.activities.filter((a: any) => !cachedIds.has(a.activityId));

            if (newActivities.length > 0) {
              await storage.saveCachedActivities(userId, newActivities, result.source);
              for (const a of newActivities) cachedIds.add(a.activityId);
              debugLog("Activities", `Дельта step=${count}: сохранено ${newActivities.length} новых`);
            }

            if (hasOverlap) {
              debugLog("Activities", `Дельта step=${count}: найдено пересечение, стоп`);
              break;
            }

            debugLog("Activities", `Дельта step=${count}: нет пересечений, расширяем...`);
          }
        } catch (err: any) {
          debugLog("Activities", `Ошибка API при дельта-синхронизации, отдаём кэш: ${err.message}`);
        }
        lastSyncTimes.set(userId, new Date().toISOString());
      }

      let allActivities = await storage.getCachedActivities(userId);
      debugLog("Activities", `Из кэша получено ${allActivities.length} активностей`);

      if (allActivities.length === 0) {
        debugLog("Activities", `Кэш пуст после синхронизации — прямой запрос как fallback`);
        try {
          const fallback = await fetchActivitiesWithFallback(userId, user, 30);
          fetchSource = fallback.source;
          if (fallback.activities.length > 0) {
            await storage.saveCachedActivities(userId, fallback.activities, fallback.source);
            allActivities = fallback.activities;
            lastSyncTimes.set(userId, new Date().toISOString());
            debugLog("Activities", `Fallback: сохранено ${fallback.activities.length} активностей из ${fallback.source}`);
          } else {
            debugLog("Activities", `Fallback: API вернул 0 активностей`);
          }
        } catch (fallbackErr: any) {
          debugLog("Activities", `Fallback тоже провалился: ${fallbackErr.message}`, { stack: fallbackErr.stack });
        }
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthActivities = allActivities.filter(
        a => new Date(a.startTimeLocal) >= thirtyDaysAgo
      );
      const displayActivities = monthActivities.length >= 10
        ? monthActivities
        : allActivities.slice(0, Math.max(10, monthActivities.length));

      debugLog("Activities", `Итог: карточки=${displayActivities.length}, статистика за 30д=${monthActivities.length}, всего=${allActivities.length}`);

      const enrichedDisplay = await enrichActivitiesWithCity(displayActivities);
      const enrichedMonth = monthActivities.length < displayActivities.length
        ? enrichedDisplay.filter(a => new Date(a.startTimeLocal) >= thirtyDaysAgo)
        : enrichedDisplay;
      res.json({
        activities: enrichedDisplay,
        monthActivities: enrichedMonth,
        source: fetchSource,
        lastSyncedAt: lastSyncTimes.get(userId) || null,
      });
    } catch (error: any) {
      debugLog("Activities", `КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, { stack: error.stack });
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/readiness", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      let activities = await storage.getCachedActivities(userId);
      if (activities.length === 0) {
        const result = await fetchActivitiesWithFallback(userId, user, 20);
        activities = result.activities;
      }

      let dailyStats = null;
      if (isGarminConnected(userId.toString())) {
        try {
          dailyStats = await getGarminDailyStats(userId.toString());
          debugLog("Health Data", `Stress: ${dailyStats.stressLevel}, BB: ${dailyStats.bodyBattery}, Steps: ${dailyStats.steps}`);
        } catch (err: any) {
          debugLog("Health Data", `Failed to fetch daily stats: ${err.message}`);
        }
      }

      const readiness = calculateReadiness(activities, dailyStats);
      res.json(readiness);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/garmin/activities", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      const result = await fetchActivitiesWithFallback(req.session.userId!, user);
      res.json(result.activities);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/garmin/push-workout", requireAuth, async (req, res) => {
    const startTime = Date.now();
    const user = await storage.getUser(req.session.userId!);
    const username = user?.username || req.session.userId;
    try {
      const pushSchema = createWorkoutSchema.extend({
        id: z.string().optional(),
      });
      const workout = pushSchema.parse(req.body);
      console.log(`[Garmin Push] user=${username} workout="${workout.name}" sport=${workout.sportType} steps=${workout.steps.length} date=${workout.scheduledDate || 'none'}`);

      if (!user || !user.garminConnected) {
        console.log(`[Garmin Push] FAIL user=${username} reason=not_connected`);
        return res.status(400).json({ message: "Garmin не подключён. Подключите аккаунт в настройках." });
      }
      await ensureGarminSessionWithDecrypt(req.session.userId!, user);

      const isSwimIncompat = workout.sportType === "swimming" && user.garminWatch && !swimStructuredWatchModels.includes(user.garminWatch as GarminWatchModel);

      if (isSwimIncompat) {
        console.log(`[Garmin Push] BLOCKED user=${username} reason=swim_incompatible watch=${user.garminWatch}`);
        return res.json({
          success: false,
          swimIncompatible: true,
          message: `${user.garminWatch?.replace(/_/g, ' ')} не поддерживает плавательные тренировки через Garmin Connect. Тренировка сохранена в описании — откройте план на экране телефона и выполняйте по нему.`,
        });
      }

      const result = await pushWorkoutToGarmin(req.session.userId!, workout);
      const elapsed = Date.now() - startTime;
      console.log(`[Garmin Push] OK user=${username} workout="${workout.name}" workoutId=${result.workoutId} scheduled=${result.scheduled} date=${result.scheduledDate || 'none'} time=${elapsed}ms`);

      if (workout.id) {
        await storage.updateWorkout(workout.id, {
          sentToGarmin: true,
          garminWorkoutId: result.workoutId || undefined,
        });
      }

      await storage.updateUser(req.session.userId!, {
        garminPushCount: (user.garminPushCount || 0) + 1,
      });

      res.json({
        success: true,
        garminWorkoutId: result.workoutId,
        scheduled: result.scheduled,
        scheduledDate: result.scheduledDate,
      });
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      const errMsg = error instanceof z.ZodError
        ? "Некорректный формат тренировки: " + error.errors.map((e) => e.message).join(", ")
        : error.message;
      if (error instanceof z.ZodError) {
        console.log(`[Garmin Push] FAIL user=${username} reason=validation error="${error.errors.map((e) => e.message).join(", ")}" time=${elapsed}ms`);
      } else {
        console.log(`[Garmin Push] FAIL user=${username} reason=error error="${error.message}" stack="${error.stack?.split('\n').slice(0,3).join(' | ')}" time=${elapsed}ms`);
      }
      try {
        await storage.addErrorLog({
          source: "garmin",
          userId: req.session.userId!,
          username: String(username),
          errorMessage: errMsg,
          context: `Тренировка: ${req.body?.name || "?"}`,
        });
      } catch {}
      res.status(400).json({ message: errMsg });
    }
  });

  // Intervals.icu routes
  app.post("/api/intervals/connect", requireAuth, async (req, res) => {
    try {
      const parsed = intervalsConnectSchema.parse(req.body);
      await verifyIntervalsConnection(parsed.athleteId, parsed.apiKey);
      const user = await storage.updateUser(req.session.userId!, {
        intervalsAthleteId: parsed.athleteId,
        intervalsApiKey: encrypt(parsed.apiKey),
        intervalsConnected: true,
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/intervals/disconnect", requireAuth, async (req, res) => {
    try {
      const user = await storage.updateUser(req.session.userId!, {
        intervalsConnected: false,
        intervalsAthleteId: undefined,
        intervalsApiKey: undefined,
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/intervals/push-workout", requireAuth, async (req, res) => {
    try {
      const pushSchema = createWorkoutSchema.extend({
        id: z.string().optional(),
      });
      const workout = pushSchema.parse(req.body);

      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.intervalsConnected || !user.intervalsAthleteId || !user.intervalsApiKey) {
        return res.status(400).json({ message: "Intervals.icu не подключён. Подключите в настройках." });
      }

      const apiKey = decrypt(user.intervalsApiKey);
      const result = await pushWorkoutToIntervals(user.intervalsAthleteId, apiKey, workout as any, user.age ?? undefined);

      if (workout.id) {
        await storage.updateWorkout(workout.id, {
          sentToIntervals: true,
          intervalsEventId: result.eventId,
        });
      }

      await storage.updateUser(req.session.userId!, {
        intervalsPushCount: (user.intervalsPushCount || 0) + 1,
      });

      res.json({
        success: true,
        eventId: result.eventId,
        scheduled: result.scheduled,
        scheduledDate: result.scheduledDate,
      });
    } catch (error: any) {
      const errMsg = error instanceof z.ZodError
        ? "Некорректный формат тренировки: " + error.errors.map((e) => e.message).join(", ")
        : error.message;
      try {
        const errUser = await storage.getUser(req.session.userId!);
        await storage.addErrorLog({
          source: "intervals",
          userId: req.session.userId!,
          username: errUser?.username || req.session.userId!,
          errorMessage: errMsg,
          context: `Тренировка: ${req.body?.name || "?"}`,
        });
      } catch {}
      res.status(400).json({ message: errMsg });
    }
  });

  app.get("/api/garmin/calendar", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.garminConnected) {
        return res.status(400).json({ message: "Garmin не подключён" });
      }
      await ensureGarminSessionWithDecrypt(req.session.userId!, user);

      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const calendar = await getGarminCalendar(req.session.userId!, year, month);
      res.json(calendar);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/upcoming-workouts", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Не авторизован" });

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 14);
      const maxDateStr = maxDate.toISOString().split("T")[0];

      const workouts: import("@shared/schema").UpcomingWorkout[] = [];
      const sources = { garmin: false, intervals: false };

      let todayActivityNames: string[] = [];

      if (user.garminConnected) {
        try {
          await ensureGarminSessionWithDecrypt(req.session.userId!, user);
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();

          const [cal1, cal2, acts] = await Promise.all([
            getGarminCalendar(req.session.userId!, year, month).catch(() => null),
            getGarminCalendar(req.session.userId!, month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1).catch(() => null),
            getGarminActivities(req.session.userId!, 10).catch(() => []),
          ]);

          todayActivityNames = acts
            .filter((a: any) => a.startTimeLocal && a.startTimeLocal.startsWith(todayStr))
            .map((a: any) => (a.activityName || "").toLowerCase());

          const calendars = [cal1, cal2];

          const seenGarmin = new Set<string>();
          for (const cal of calendars) {
            if (!cal?.calendarItems) continue;
            for (const item of cal.calendarItems) {
              if (item.itemType === "workout" && item.date >= todayStr && item.date <= maxDateStr) {
                const dedupKey = `${item.workoutId || item.id}-${item.date}`;
                if (seenGarmin.has(dedupKey)) continue;
                seenGarmin.add(dedupKey);
                workouts.push({
                  id: `garmin-${item.workoutId || item.id}`,
                  source: "garmin",
                  date: item.date,
                  name: item.title || item.workoutName || "Тренировка",
                  sportType: item.sportTypeKey || "other",
                  workoutId: item.workoutId ? String(item.workoutId) : undefined,
                  isToday: item.date === todayStr,
                });
              }
            }
          }
          sources.garmin = true;
        } catch (err: any) {
          console.log(`[UpcomingWorkouts] Garmin fetch error: ${err.message}`);
        }
      }

      if (user.intervalsConnected && user.intervalsAthleteId && user.intervalsApiKey) {
        try {
          const apiKey = decrypt(user.intervalsApiKey);

          if (todayActivityNames.length === 0) {
            const acts = await getIntervalsActivities(user.intervalsAthleteId, apiKey, 10).catch(() => []);
            todayActivityNames = acts
              .filter((a: any) => a.startTimeLocal && a.startTimeLocal.startsWith(todayStr))
              .map((a: any) => (a.activityName || "").toLowerCase());
          }

          const events = await getIntervalsCalendarEvents(user.intervalsAthleteId, apiKey);

          const intervalsTypeMap: Record<string, string> = { Run: "running", Ride: "cycling", Swim: "swimming", Walk: "walking", VirtualRide: "cycling", VirtualRun: "running" };
          for (const ev of events) {
            const eventDate = (ev.start_date_local || ev.start_date || "").split("T")[0];
            if (eventDate >= todayStr && eventDate <= maxDateStr && ev.category === "WORKOUT") {
              workouts.push({
                id: `intervals-${ev.id}`,
                source: "intervals",
                date: eventDate,
                name: ev.name || ev.description || "Тренировка",
                sportType: ev.type ? (intervalsTypeMap[ev.type] || ev.type.toLowerCase()) : "other",
                workoutId: String(ev.id),
                isToday: eventDate === todayStr,
              });
            }
          }
          sources.intervals = true;
        } catch (err: any) {
          console.log(`[UpcomingWorkouts] Intervals fetch error: ${err.message}`);
        }
      }

      const filtered = todayActivityNames.length > 0
        ? workouts.filter(w => {
            if (!w.isToday) return true;
            const nameLower = w.name.toLowerCase();
            return !todayActivityNames.some(actName => nameLower.includes(actName) || actName.includes(nameLower));
          })
        : workouts;

      filtered.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

      res.json({ workouts: filtered, sources });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/refresh-data", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Не авторизован" });
      if (user.garminConnected) {
        invalidateGarminCache(userId);
      }
      await storage.clearCachedActivities(userId);
      lastSyncTimes.delete(userId);
      console.log(`[Activities] Cache + cooldown cleared for user ${user.username} (manual refresh)`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/garmin/reschedule-workout", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        workoutId: z.string(),
        newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      });
      const { workoutId, newDate, currentDate } = schema.parse(req.body);

      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.garminConnected) {
        return res.status(400).json({ message: "Garmin не подключён" });
      }
      await ensureGarminSessionWithDecrypt(req.session.userId!, user);

      const result = await rescheduleGarminWorkout(req.session.userId!, workoutId, newDate, currentDate);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Некорректные данные: " + error.errors.map((e) => e.message).join(", ") });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/garmin/workout/:workoutId", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.garminConnected) {
        return res.status(400).json({ message: "Garmin не подключён" });
      }
      await ensureGarminSessionWithDecrypt(req.session.userId!, user);

      const workoutId = req.params.workoutId as string;
      await deleteGarminWorkout(req.session.userId!, workoutId);
      console.log(`[Garmin Delete] user=${user.username} workoutId=${req.params.workoutId}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/intervals/reschedule-workout", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.intervalsAthleteId || !user?.intervalsApiKey) {
        return res.status(400).json({ message: "Intervals.icu не подключён" });
      }

      const { workoutId, newDate, currentDate } = req.body;
      if (!workoutId || !newDate) {
        return res.status(400).json({ message: "Требуется workoutId и newDate" });
      }

      const apiKey = decrypt(user.intervalsApiKey);
      const result = await rescheduleIntervalsWorkout(
        user.intervalsAthleteId,
        apiKey,
        workoutId,
        newDate,
        currentDate
      );
      res.json(result);
    } catch (error: any) {
      console.error("[Intervals] Reschedule error:", error.message);
      res.status(500).json({ message: error.message || "Ошибка переноса тренировки" });
    }
  });

  // Workout routes (legacy, kept for compatibility)
  app.get("/api/workouts", requireAuth, async (req, res) => {
    const workouts = await storage.getWorkouts(req.session.userId!);
    res.json(workouts);
  });

  app.post("/api/workouts", requireAuth, async (req, res) => {
    try {
      const parsed = createWorkoutSchema.parse(req.body);
      const workout = await storage.createWorkout({
        userId: req.session.userId!,
        name: parsed.name,
        description: parsed.description || "",
        sportType: parsed.sportType,
        steps: parsed.steps,
      });
      res.json(workout);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors.map((e) => e.message).join(", ") });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workouts/:id", requireAuth, async (req, res) => {
    const result = await storage.deleteWorkout(req.params.id as string);
    if (!result) return res.status(404).json({ message: "Тренировка не найдена" });
    res.json({ ok: true });
  });

  // Favorites routes
  app.get("/api/favorites", requireAuth, async (req, res) => {
    const favorites = await storage.getFavorites(req.session.userId!);
    res.json(favorites);
  });

  app.post("/api/favorites", requireAuth, async (req, res) => {
    try {
      const parsed = createWorkoutSchema.parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      const favorite = await storage.addFavorite({
        userId: req.session.userId!,
        name: parsed.name,
        description: parsed.description || "",
        sportType: parsed.sportType,
        steps: parsed.steps,
      });

      await storage.updateUser(req.session.userId!, {
        favoritesCount: (user.favoritesCount || 0) + 1,
      });

      res.json(favorite);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors.map((e) => e.message).join(", ") });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/favorites/:id", requireAuth, async (req, res) => {
    const favorites = await storage.getFavorites(req.session.userId!);
    const found = favorites.find((f) => f.id === req.params.id);
    if (!found) return res.status(404).json({ message: "Тренировка не найдена" });

    const result = await storage.deleteFavorite(req.params.id as string);
    if (!result) return res.status(404).json({ message: "Ошибка удаления" });

    const user = await storage.getUser(req.session.userId!);
    if (user && (user.favoritesCount || 0) > 0) {
      await storage.updateUser(req.session.userId!, {
        favoritesCount: (user.favoritesCount || 0) - 1,
      });
    }

    res.json({ ok: true });
  });

  // Chat routes
  app.get("/api/chat/messages", requireAuth, async (req, res) => {
    const messages = await storage.getMessages(req.session.userId!);
    res.json(messages);
  });

  app.post("/api/chat/send", requireAuth, async (req, res) => {
    let chatUser: any = null;
    let chatContent = "";
    let chatVariantId = "base";
    let chatVariantName = "Базовый";
    try {
      const { content, timezone } = req.body;
      chatContent = content || "";
      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Сообщение не может быть пустым" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      chatUser = user;

      debugLog("AI Chat", `Новое сообщение от ${user.username}`, { message: content });

      await storage.addMessage({
        userId: user.id,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      });

      const history = await storage.getMessages(user.id);
      debugLog("AI Chat", `История: ${history.length} сообщений`);

      let activities: any[] | undefined;
      try {
        const result = await fetchActivitiesWithFallback(user.id, user, 10);
        activities = await enrichActivitiesWithCity(result.activities);
        debugLog("AI Chat", `Активности для контекста: ${activities.length}`, {
          summary: activities.slice(0, 5).map(a => ({
            name: a.activityName,
            type: a.activityType,
            date: a.startTimeLocal,
            distance: a.distance,
          })),
        });
      } catch (err: any) {
        debugLog("AI Chat", `Не удалось загрузить активности: ${err.message}`);
      }

      let readinessCtx = "";
      if (activities && activities.length > 0) {
        try {
          let dailyStatsForAI = null;
          if (isGarminConnected(userId.toString())) {
            try {
              dailyStatsForAI = await getGarminDailyStats(userId.toString());
            } catch {}
          }
          const readiness = calculateReadiness(activities, dailyStatsForAI);
          readinessCtx = `\n\n===== ГОТОВНОСТЬ К ТРЕНИРОВКЕ =====\nScore: ${readiness.score}/100 (${readiness.label})\n${readiness.summary}\n`;
          readiness.factors.forEach(f => {
            readinessCtx += `- ${f.name}: ${f.score}/${f.maxScore} — ${f.description}\n`;
          });
          if (dailyStatsForAI) {
            if (dailyStatsForAI.stressLevel != null) readinessCtx += `- Стресс Garmin: ${dailyStatsForAI.stressLevel}\n`;
            if (dailyStatsForAI.bodyBattery != null) readinessCtx += `- Body Battery: ${dailyStatsForAI.bodyBattery}/100\n`;
            if (dailyStatsForAI.steps != null) readinessCtx += `- Шаги сегодня: ${dailyStatsForAI.steps}\n`;
            if (dailyStatsForAI.stepsYesterday != null) readinessCtx += `- Шаги вчера: ${dailyStatsForAI.stepsYesterday}\n`;
          }
          debugLog("AI Context", `Готовность: ${readiness.score}/100 (${readiness.label})`, { readinessCtx });
        } catch (err: any) {
          debugLog("AI Context", `Ошибка расчёта готовности: ${err.message}`);
        }
      }

      let weatherCtx = "";
      if (activities && activities.length > 0) {
        try {
          const likelyCity = detectLikelyCity(activities);
          if (likelyCity) {
            const forecast = await getWeatherForecast(likelyCity.lat, likelyCity.lon, 3);
            weatherCtx = buildWeatherContext(likelyCity.city, forecast, !!likelyCity.recentCity);
            debugLog("AI Context", `Погода: ${likelyCity.city}`, { weatherCtx });
          } else {
            debugLog("AI Context", `Город не определён — погода не добавлена`);
          }
        } catch (err: any) {
          debugLog("AI Context", `Ошибка получения погоды: ${err.message}`);
        }
      }

      let calendarCtx = "";
      if (user.garminConnected) {
        try {
          await ensureGarminSessionWithDecrypt(user.id, user);
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
          const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
          const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;

          const [cal1, cal2] = await Promise.all([
            getGarminCalendar(user.id, currentYear, currentMonth).catch(() => null),
            getGarminCalendar(user.id, nextMonthYear, nextMonth).catch(() => null),
          ]);

          const mergedItems = [
            ...(cal1?.calendarItems || []),
            ...(cal2?.calendarItems || []),
          ];

          if (mergedItems.length > 0) {
            calendarCtx = buildCalendarContext({ calendarItems: mergedItems }, now);
            const workoutItems = mergedItems.filter((i: any) => i.itemType === "workout");
            debugLog("AI Context", `Календарь Garmin: ${workoutItems.length} тренировок`, { calendarCtx });
          } else {
            debugLog("AI Context", `Календарь Garmin: пуст`);
          }
        } catch (err: any) {
          debugLog("AI Context", `Ошибка получения календаря Garmin: ${err.message}`);
        }
      }

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
      }, 15000);

      try {
        const userTimezone = typeof timezone === "string" ? timezone : undefined;
        const extraContext = readinessCtx + weatherCtx + calendarCtx;

        const variants = await storage.getPromptVariants();
        const selectedVariant = pickPromptVariant(variants);
        chatVariantId = selectedVariant.id;
        chatVariantName = selectedVariant.name;

        debugLog("AI Prompt", `Вариант промпта: ${selectedVariant.name} (id=${selectedVariant.id})`, {
          variantInstructions: selectedVariant.instructions || "(нет дополнительных инструкций)",
        });

        debugLog("AI Prompt", `Полный контекст для AI`, {
          readinessCtxLength: readinessCtx.length,
          weatherCtxLength: weatherCtx.length,
          calendarCtxLength: calendarCtx.length,
          extraContextLength: extraContext.length,
          activitiesCount: activities?.length || 0,
          historyMessages: history.length,
          timezone: userTimezone || "не указан",
        });

        debugLog("AI Prompt", `Контекст отправляемый AI (extraContext)`, { extraContext: extraContext || "(пусто)" });

        const startTime = Date.now();
        debugLog("AI Chat", `Отправляем запрос в DeepSeek...`);
        const aiResponse = await chatStream(user, content, history, activities, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
        }, userTimezone, extraContext, selectedVariant.instructions || undefined);
        const responseTimeMs = Date.now() - startTime;

        debugLog("AI Chat", `Ответ AI получен за ${responseTimeMs}ms`, {
          responseLength: aiResponse.text.length,
          hasWorkout: !!aiResponse.workout,
          hasPlan: !!(aiResponse.workouts && aiResponse.workouts.length > 0),
          hasReschedule: !!aiResponse.reschedule,
          workoutName: aiResponse.workout?.name || null,
          planWorkouts: aiResponse.workouts?.length || 0,
        });

        const assistantMessage = await storage.addMessage({
          userId: user.id,
          role: "assistant",
          content: aiResponse.text,
          timestamp: new Date().toISOString(),
          workoutJson: aiResponse.workout || undefined,
          workoutsJson: aiResponse.workouts || undefined,
          rescheduleData: aiResponse.reschedule || undefined,
        });

        await storage.addAiLog({
          userId: user.id,
          username: user.username,
          timestamp: new Date().toISOString(),
          userMessage: content.length > 200 ? content.substring(0, 200) + "..." : content,
          aiResponse: aiResponse.text,
          responseLength: aiResponse.text.length,
          hadWorkout: !!aiResponse.workout,
          hadPlan: !!(aiResponse.workouts && aiResponse.workouts.length > 0),
          responseTimeMs,
          promptVariantId: selectedVariant.id,
          promptVariantName: selectedVariant.name,
        });

        res.write(`data: ${JSON.stringify({ type: "done", message: assistantMessage })}\n\n`);
      } finally {
        clearInterval(heartbeat);
      }
      res.end();
    } catch (error: any) {
      debugLog("AI Chat", `ОШИБКА: ${error.message}`, { stack: error.stack });
      if (chatUser) {
        try {
          const msg = chatContent.length > 200 ? chatContent.substring(0, 200) + "..." : chatContent;
          await storage.addErrorLog({
            source: "ai",
            userId: chatUser.id,
            username: chatUser.username,
            errorMessage: error.message || "Неизвестная ошибка AI",
            context: `Запрос: ${msg || "(пустое сообщение)"}. Промпт: ${chatVariantName}`,
          });
        } catch (logErr: any) {
          console.error("[Chat] Failed to log AI error:", logErr.message);
        }
      }
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || "Ошибка AI" });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message || "Ошибка AI" })}\n\n`);
        res.end();
      }
    }
  });

  app.delete("/api/chat/messages", requireAuth, async (req, res) => {
    await storage.clearMessages(req.session.userId!);
    res.json({ ok: true });
  });

  const ADMIN_USERNAME = "Andrey";

  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }

    const allUsers = await storage.getAllUsers();
    const allMessages = await storage.getAllMessages();

    const userStats = allUsers.map((u) => {
      const userMessages = allMessages.filter((m) => m.userId === u.id);
      const lastMessage = userMessages.length > 0
        ? userMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
        : null;

      return {
        id: u.id,
        username: u.username,
        garminConnected: u.garminConnected,
        intervalsConnected: u.intervalsConnected,
        sportTypes: u.sportTypes,
        fitnessLevel: u.fitnessLevel || null,
        messageCount: userMessages.filter((m) => m.role === "user").length,
        totalMessages: userMessages.length,
        garminPushCount: u.garminPushCount || 0,
        intervalsPushCount: u.intervalsPushCount || 0,
        favoritesCount: u.favoritesCount || 0,
        lastMessageDate: lastMessage?.timestamp || null,
        lastLogin: u.lastLogin || null,
      };
    });

    const recentUsers = [...userStats]
      .sort((a, b) => {
        const dateA = a.lastLogin || a.lastMessageDate || "1970-01-01";
        const dateB = b.lastLogin || b.lastMessageDate || "1970-01-01";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

    const totalUserMessages = allMessages.filter((m) => m.role === "user").length;
    const totalAiMessages = allMessages.filter((m) => m.role === "assistant").length;
    const lastGlobalMessage = allMessages.length > 0
      ? allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      : null;

    const sportDistribution: Record<string, number> = {};
    allUsers.forEach((u) => {
      u.sportTypes.forEach((s) => {
        sportDistribution[s] = (sportDistribution[s] || 0) + 1;
      });
    });

    const fitnessDistribution: Record<string, number> = {};
    allUsers.forEach((u) => {
      const level = u.fitnessLevel || "not_set";
      fitnessDistribution[level] = (fitnessDistribution[level] || 0) + 1;
    });

    res.json({
      totalUsers: allUsers.length,
      garminConnected: allUsers.filter((u) => u.garminConnected).length,
      intervalsConnected: allUsers.filter((u) => u.intervalsConnected).length,
      totalGarminPushes: allUsers.reduce((sum, u) => sum + (u.garminPushCount || 0), 0),
      totalIntervalsPushes: allUsers.reduce((sum, u) => sum + (u.intervalsPushCount || 0), 0),
      totalFavorites: allUsers.reduce((sum, u) => sum + (u.favoritesCount || 0), 0),
      totalUserMessages,
      totalAiMessages,
      lastGlobalMessageDate: lastGlobalMessage?.timestamp || null,
      sportDistribution,
      fitnessDistribution,
      recentUsers,
    });
  });

  app.get("/api/admin/users/:userId/profile", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }

    const user = await storage.getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const { password, garminPassword, intervalsApiKey, ...safeUser } = user;
    res.json(safeUser);
  });

  app.get("/api/admin/users/:userId/messages", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }

    const user = await storage.getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const messages = await storage.getMessages(req.params.userId);
    res.json(messages);
  });

  app.post("/api/bug-reports", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) return res.status(401).json({ message: "Не авторизован" });

    const { message, page } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Сообщение не может быть пустым" });
    }

    const report = await storage.addBugReport({
      userId: currentUser.id,
      username: currentUser.username,
      message: message.trim().slice(0, 2000),
      page: page || "",
    });

    res.json(report);
  });

  app.get("/api/admin/bug-reports", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const reports = await storage.getAllBugReports();
    res.json(reports);
  });

  app.patch("/api/admin/bug-reports/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const { status } = req.body;
    if (!status || !["read", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Некорректный статус" });
    }
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await storage.updateBugReport(reportId, { status });
    if (!updated) return res.status(404).json({ message: "Отчёт не найден" });
    res.json(updated);
  });

  app.delete("/api/admin/bug-reports/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await storage.deleteBugReport(reportId);
    if (!deleted) return res.status(404).json({ message: "Отчёт не найден" });
    res.json({ success: true });
  });

  app.get("/api/admin/error-logs", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const errors = await storage.getAllErrorLogs();
    res.json(errors);
  });

  app.patch("/api/admin/error-logs/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const errorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await storage.updateErrorLog(errorId, { status: req.body.status });
    if (!updated) return res.status(404).json({ message: "Ошибка не найдена" });
    res.json(updated);
  });

  app.delete("/api/admin/error-logs/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const errorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await storage.deleteErrorLog(errorId);
    if (!deleted) return res.status(404).json({ message: "Ошибка не найдена" });
    res.json({ success: true });
  });

  app.get("/api/admin/debug-logs", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    res.json(getDebugLogs());
  });

  app.delete("/api/admin/debug-logs", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    clearDebugLogs();
    res.json({ success: true });
  });

  app.get("/api/admin/ai-logs", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const logs = await storage.getAllAiLogs();
    res.json(logs);
  });

  app.patch("/api/admin/ai-logs/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const logId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { rating, notes } = req.body;
    const updates: any = {};
    if (rating !== undefined) updates.rating = rating;
    if (notes !== undefined) updates.notes = notes;
    const updated = await storage.updateAiLog(logId, updates);
    if (!updated) return res.status(404).json({ message: "Лог не найден" });
    res.json(updated);
  });

  app.get("/api/admin/prompt-variants", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const variants = await storage.getPromptVariants();
    res.json(variants);
  });

  app.post("/api/admin/prompt-variants", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
        return res.status(403).json({ message: "Доступ запрещён" });
      }
      const { name, instructions, weight, isActive } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Название обязательно" });
      }
      const variant = await storage.addPromptVariant({
        name,
        instructions: instructions || "",
        weight: typeof weight === "number" ? weight : 1,
        isActive: isActive !== false,
      });
      res.json(variant);
    } catch (error: any) {
      console.error("[Admin] Error creating prompt variant:", error);
      res.status(500).json({ message: error.message || "Ошибка сервера" });
    }
  });

  app.patch("/api/admin/prompt-variants/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const variantId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, instructions, weight, isActive } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (instructions !== undefined) updates.instructions = instructions;
    if (weight !== undefined) updates.weight = weight;
    if (isActive !== undefined) updates.isActive = isActive;
    const updated = await storage.updatePromptVariant(variantId, updates);
    if (!updated) return res.status(404).json({ message: "Вариант не найден" });
    res.json(updated);
  });

  app.delete("/api/admin/prompt-variants/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const variantId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (variantId === "base") {
      return res.status(400).json({ message: "Базовый вариант нельзя удалить" });
    }
    const deleted = await storage.deletePromptVariant(variantId);
    if (!deleted) return res.status(404).json({ message: "Вариант не найден" });
    res.json({ success: true });
  });

  app.get("/api/admin/prompt-variants/metrics", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    const logs = await storage.getAllAiLogs();
    const variants = await storage.getPromptVariants();
    const metricsMap = new Map<string, { name: string; totalRequests: number; totalRated: number; ratingSum: number; workoutCount: number; planCount: number; totalResponseTime: number }>();

    for (const v of variants) {
      metricsMap.set(v.id, { name: v.name, totalRequests: 0, totalRated: 0, ratingSum: 0, workoutCount: 0, planCount: 0, totalResponseTime: 0 });
    }
    metricsMap.set("base", { name: "Базовый", totalRequests: 0, totalRated: 0, ratingSum: 0, workoutCount: 0, planCount: 0, totalResponseTime: 0 });

    for (const log of logs) {
      let m = metricsMap.get(log.promptVariantId);
      if (!m) {
        m = { name: log.promptVariantName, totalRequests: 0, totalRated: 0, ratingSum: 0, workoutCount: 0, planCount: 0, totalResponseTime: 0 };
        metricsMap.set(log.promptVariantId, m);
      }
      m.totalRequests++;
      m.totalResponseTime += log.responseTimeMs;
      if (log.hadWorkout) m.workoutCount++;
      if (log.hadPlan) m.planCount++;
      if (log.rating) {
        m.totalRated++;
        m.ratingSum += log.rating;
      }
    }

    const metrics = Array.from(metricsMap.entries()).map(([id, m]) => ({
      variantId: id,
      variantName: m.name,
      totalRequests: m.totalRequests,
      avgRating: m.totalRated > 0 ? Math.round((m.ratingSum / m.totalRated) * 10) / 10 : null,
      ratedCount: m.totalRated,
      workoutRate: m.totalRequests > 0 ? Math.round((m.workoutCount / m.totalRequests) * 100) : 0,
      planRate: m.totalRequests > 0 ? Math.round((m.planCount / m.totalRequests) * 100) : 0,
      avgResponseTime: m.totalRequests > 0 ? Math.round(m.totalResponseTime / m.totalRequests) : 0,
    })).filter(m => m.totalRequests > 0);

    res.json(metrics);
  });

  app.post("/api/admin/run-tests", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }

    try {
      const includeLive = req.body?.includeLive === true;
      const results = await runAllTests(includeLive);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
