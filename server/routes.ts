import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { loginSchema, registerSchema, garminConnectSchema, createWorkoutSchema, workoutStepSchema } from "@shared/schema";
import { z } from "zod";
import { connectGarmin, disconnectGarmin, getGarminActivities, pushWorkoutToGarmin, isGarminConnected, ensureGarminSession } from "./garmin";
import { chat } from "./ai";

const MemStore = MemoryStore(session);

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
      secret: process.env.SESSION_SECRET || "garmin-coach-secret-key",
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
      });
      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
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
      const { password: _, ...safeUser } = user;
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
    const garminActive = isGarminConnected(user.id);
    const { password: _, ...safeUser } = user;
    res.json({ ...safeUser, garminConnected: user.garminConnected && garminActive ? true : user.garminConnected });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const user = await storage.updateUser(req.session.userId!, {
        sportTypes: req.body.sportTypes,
        goals: req.body.goals,
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Garmin routes
  app.post("/api/garmin/connect", requireAuth, async (req, res) => {
    try {
      const parsed = garminConnectSchema.parse(req.body);
      await connectGarmin(req.session.userId!, parsed.garminEmail, parsed.garminPassword);
      const user = await storage.updateUser(req.session.userId!, {
        garminEmail: parsed.garminEmail,
        garminConnected: true,
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, ...safeUser } = user;
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
      });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/garmin/activities", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.garminConnected) {
        return res.status(400).json({ message: "Garmin не подключён" });
      }
      await ensureGarminSession(req.session.userId!, user);
      const activities = await getGarminActivities(req.session.userId!);
      res.json(activities);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/garmin/push-workout", requireAuth, async (req, res) => {
    try {
      const pushSchema = createWorkoutSchema.extend({ id: z.string().optional() });
      const workout = pushSchema.parse(req.body);

      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.garminConnected) {
        return res.status(400).json({ message: "Garmin не подключён. Подключите аккаунт в настройках." });
      }
      await ensureGarminSession(req.session.userId!, user);

      const garminWorkoutId = await pushWorkoutToGarmin(req.session.userId!, workout);

      if (workout.id) {
        await storage.updateWorkout(workout.id, {
          sentToGarmin: true,
          garminWorkoutId: garminWorkoutId || undefined,
        });
      }

      res.json({ success: true, garminWorkoutId });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Некорректный формат тренировки: " + error.errors.map((e) => e.message).join(", ") });
      }
      res.status(400).json({ message: error.message });
    }
  });

  // Workout routes
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
    const result = await storage.deleteWorkout(req.params.id);
    if (!result) return res.status(404).json({ message: "Тренировка не найдена" });
    res.json({ ok: true });
  });

  // Chat routes
  app.get("/api/chat/messages", requireAuth, async (req, res) => {
    const messages = await storage.getMessages(req.session.userId!);
    res.json(messages);
  });

  app.post("/api/chat/send", requireAuth, async (req, res) => {
    try {
      const { content } = req.body;
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
        if (user.garminConnected) {
          await ensureGarminSession(user.id, user);
          activities = await getGarminActivities(user.id, 5);
        }
      } catch {}

      const aiResponse = await chat(user, content, history, activities);

      const assistantMessage = await storage.addMessage({
        userId: user.id,
        role: "assistant",
        content: aiResponse.text,
        timestamp: new Date().toISOString(),
        workoutJson: aiResponse.workout || undefined,
      });

      res.json(assistantMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Ошибка AI" });
    }
  });

  app.delete("/api/chat/messages", requireAuth, async (req, res) => {
    await storage.clearMessages(req.session.userId!);
    res.json({ ok: true });
  });

  return httpServer;
}
