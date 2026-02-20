import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { loginSchema, registerSchema, garminConnectSchema, intervalsConnectSchema, createWorkoutSchema, workoutStepSchema, swimStructuredWatchModels, type GarminWatchModel } from "@shared/schema";
import { z } from "zod";
import { connectGarmin, disconnectGarmin, getGarminActivities, pushWorkoutToGarmin, isGarminConnected, getGarminCalendar, rescheduleGarminWorkout, deleteGarminWorkout } from "./garmin";
import { verifyIntervalsConnection, pushWorkoutToIntervals, getIntervalsActivities, rescheduleIntervalsWorkout } from "./intervals";
import { chat, chatStream, parseAiResponse } from "./ai";
import { encrypt, decrypt } from "./crypto";
import { enrichActivitiesWithCity, detectLikelyCity, getWeatherForecast, buildWeatherContext, reverseGeocode } from "./weather";

const MemStore = MemoryStore(session);

function buildCalendarContext(calendar: any, now: Date): string {
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

      const { password: _, garminPassword: __, intervalsApiKey: ___, ...safeUser } = user;
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
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      const result = await fetchActivitiesWithFallback(req.session.userId!, user);
      const enriched = await enrichActivitiesWithCity(result.activities);
      res.json({ activities: enriched, source: result.source });
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
      if (error instanceof z.ZodError) {
        console.log(`[Garmin Push] FAIL user=${username} reason=validation error="${error.errors.map((e) => e.message).join(", ")}" time=${elapsed}ms`);
        return res.status(400).json({ message: "Некорректный формат тренировки: " + error.errors.map((e) => e.message).join(", ") });
      }
      console.log(`[Garmin Push] FAIL user=${username} reason=error error="${error.message}" stack="${error.stack?.split('\n').slice(0,3).join(' | ')}" time=${elapsed}ms`);
      res.status(400).json({ message: error.message });
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Некорректный формат тренировки: " + error.errors.map((e) => e.message).join(", ") });
      }
      res.status(400).json({ message: error.message });
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
      console.log(`[Garmin Reschedule] user=${user.username} workoutId=${workoutId} ${currentDate || '?'} → ${newDate}`);
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
    try {
      const { content, timezone } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Сообщение не может быть пустым" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      await storage.addMessage({
        userId: user.id,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      });

      const history = await storage.getMessages(user.id);

      let activities: any[] | undefined;
      try {
        const result = await fetchActivitiesWithFallback(user.id, user, 10);
        activities = await enrichActivitiesWithCity(result.activities);
      } catch {}

      let weatherCtx = "";
      if (activities && activities.length > 0) {
        try {
          const likelyCity = detectLikelyCity(activities);
          if (likelyCity) {
            const forecast = await getWeatherForecast(likelyCity.lat, likelyCity.lon, 3);
            weatherCtx = buildWeatherContext(likelyCity.city, forecast, !!likelyCity.recentCity);
          }
        } catch (err: any) {
          console.log("[Weather] Failed to get forecast for AI:", err.message);
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
            console.log(`[Calendar] Injected ${mergedItems.filter((i: any) => i.itemType === "workout").length} workout items into AI context for user=${user.username}`);
          } else {
            console.log(`[Calendar] No calendar items found for user=${user.username}`);
          }
        } catch (err: any) {
          console.log("[Calendar] Failed to get Garmin calendar for AI:", err.message);
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
        const extraContext = weatherCtx + calendarCtx;
        console.log(`[Chat] user=${user.username} weatherCtx=${weatherCtx.length}chars calendarCtx=${calendarCtx.length}chars extraContext=${extraContext.length}chars`);
        const aiResponse = await chatStream(user, content, history, activities, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
        }, userTimezone, extraContext);

        const assistantMessage = await storage.addMessage({
          userId: user.id,
          role: "assistant",
          content: aiResponse.text,
          timestamp: new Date().toISOString(),
          workoutJson: aiResponse.workout || undefined,
          workoutsJson: aiResponse.workouts || undefined,
          rescheduleData: aiResponse.reschedule || undefined,
        });

        res.write(`data: ${JSON.stringify({ type: "done", message: assistantMessage })}\n\n`);
      } finally {
        clearInterval(heartbeat);
      }
      res.end();
    } catch (error: any) {
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
      };
    });

    const recentUsers = [...userStats]
      .sort((a, b) => {
        const dateA = a.lastMessageDate || "1970-01-01";
        const dateB = b.lastMessageDate || "1970-01-01";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .slice(0, 10);

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

  return httpServer;
}
