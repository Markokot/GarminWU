import type { User, Workout, ChatMessage, FavoriteWorkout, SportType, FitnessLevel, BugReport, AiPromptVariant, AiRequestLog, ErrorLog, GarminActivity } from "@shared/schema";
import {
  usersTable, workoutsTable, favoritesTable, messagesTable,
  bugReportsTable, aiLogsTable, promptVariantsTable, errorLogsTable,
  cachedActivitiesTable,
} from "@shared/schema";
import type { IStorage } from "./storage";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, asc } from "drizzle-orm";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool;
let db: ReturnType<typeof drizzle>;

export function initPgPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for pg storage mode");
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool);
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    garminEmail: row.garminEmail ?? undefined,
    garminPassword: row.garminPassword ?? undefined,
    garminConnected: row.garminConnected,
    intervalsAthleteId: row.intervalsAthleteId ?? undefined,
    intervalsApiKey: row.intervalsApiKey ?? undefined,
    intervalsConnected: row.intervalsConnected,
    sportTypes: (row.sportTypes as SportType[]) || [],
    goals: row.goals || "",
    fitnessLevel: row.fitnessLevel ?? undefined,
    age: row.age ?? undefined,
    weeklyHours: row.weeklyHours ?? undefined,
    experienceYears: row.experienceYears ?? undefined,
    injuries: row.injuries ?? undefined,
    personalRecords: row.personalRecords ?? undefined,
    preferences: row.preferences ?? undefined,
    garminWatch: row.garminWatch ?? undefined,
    garminPushCount: row.garminPushCount ?? undefined,
    intervalsPushCount: row.intervalsPushCount ?? undefined,
    favoritesCount: row.favoritesCount ?? undefined,
    onboardingShown: row.onboardingShown ?? undefined,
    lastLogin: row.lastLogin ?? undefined,
  };
}

function rowToWorkout(row: any): Workout {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    sportType: row.sportType as SportType,
    steps: (row.steps as any[]) || [],
    scheduledDate: row.scheduledDate ?? undefined,
    createdAt: row.createdAt,
    sentToGarmin: row.sentToGarmin,
    garminWorkoutId: row.garminWorkoutId ?? undefined,
    sentToIntervals: row.sentToIntervals,
    intervalsEventId: row.intervalsEventId ?? undefined,
    explanation: row.explanation ?? undefined,
  };
}

function rowToFavorite(row: any): FavoriteWorkout {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    sportType: row.sportType as SportType,
    steps: (row.steps as any[]) || [],
    savedAt: row.savedAt,
  };
}

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    userId: row.userId,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    timestamp: row.timestamp,
    workoutJson: row.workoutJson ?? undefined,
    workoutsJson: row.workoutsJson ?? undefined,
    rescheduleData: row.rescheduleData ?? undefined,
  };
}

function rowToBugReport(row: any): BugReport {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    message: row.message,
    page: row.page,
    timestamp: row.timestamp,
    status: row.status as "new" | "read" | "resolved",
  };
}

function rowToAiLog(row: any): AiRequestLog {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    timestamp: row.timestamp,
    userMessage: row.userMessage,
    aiResponse: row.aiResponse ?? undefined,
    responseLength: row.responseLength,
    hadWorkout: row.hadWorkout,
    hadPlan: row.hadPlan,
    responseTimeMs: row.responseTimeMs,
    promptVariantId: row.promptVariantId,
    promptVariantName: row.promptVariantName,
    rating: row.rating ?? undefined,
    notes: row.notes ?? undefined,
    isError: row.isError ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
  };
}

function rowToPromptVariant(row: any): AiPromptVariant {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    weight: row.weight,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function rowToErrorLog(row: any): ErrorLog {
  return {
    id: row.id,
    source: row.source as "ai" | "garmin" | "intervals",
    userId: row.userId,
    username: row.username,
    timestamp: row.timestamp,
    errorMessage: row.errorMessage,
    context: row.context ?? undefined,
    status: row.status as "new" | "resolved",
  };
}

export class PostgresStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return rows.length ? rowToUser(rows[0]) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(usersTable).where(eq(usersTable.username, username));
    return rows.length ? rowToUser(rows[0]) : undefined;
  }

  async createUser(input: { username: string; password: string; sportTypes: SportType[]; goals: string; fitnessLevel?: FitnessLevel }): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(input.password, 10);
    await db.insert(usersTable).values({
      id,
      username: input.username,
      password: hashedPassword,
      sportTypes: input.sportTypes,
      goals: input.goals || "",
      fitnessLevel: input.fitnessLevel,
      garminConnected: false,
      intervalsConnected: false,
    });
    return (await this.getUser(id))!;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existing = await this.getUser(id);
    if (!existing) return undefined;
    const dbUpdates: any = {};
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.password !== undefined) dbUpdates.password = updates.password;
    if (updates.garminEmail !== undefined) dbUpdates.garminEmail = updates.garminEmail;
    if (updates.garminPassword !== undefined) dbUpdates.garminPassword = updates.garminPassword;
    if (updates.garminConnected !== undefined) dbUpdates.garminConnected = updates.garminConnected;
    if (updates.intervalsAthleteId !== undefined) dbUpdates.intervalsAthleteId = updates.intervalsAthleteId;
    if (updates.intervalsApiKey !== undefined) dbUpdates.intervalsApiKey = updates.intervalsApiKey;
    if (updates.intervalsConnected !== undefined) dbUpdates.intervalsConnected = updates.intervalsConnected;
    if (updates.sportTypes !== undefined) dbUpdates.sportTypes = updates.sportTypes;
    if (updates.goals !== undefined) dbUpdates.goals = updates.goals;
    if (updates.fitnessLevel !== undefined) dbUpdates.fitnessLevel = updates.fitnessLevel;
    if (updates.age !== undefined) dbUpdates.age = updates.age;
    if (updates.weeklyHours !== undefined) dbUpdates.weeklyHours = updates.weeklyHours;
    if (updates.experienceYears !== undefined) dbUpdates.experienceYears = updates.experienceYears;
    if (updates.injuries !== undefined) dbUpdates.injuries = updates.injuries;
    if (updates.personalRecords !== undefined) dbUpdates.personalRecords = updates.personalRecords;
    if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;
    if (updates.garminWatch !== undefined) dbUpdates.garminWatch = updates.garminWatch;
    if (updates.garminPushCount !== undefined) dbUpdates.garminPushCount = updates.garminPushCount;
    if (updates.intervalsPushCount !== undefined) dbUpdates.intervalsPushCount = updates.intervalsPushCount;
    if (updates.favoritesCount !== undefined) dbUpdates.favoritesCount = updates.favoritesCount;
    if (updates.onboardingShown !== undefined) dbUpdates.onboardingShown = updates.onboardingShown;
    if (updates.lastLogin !== undefined) dbUpdates.lastLogin = updates.lastLogin;
    if (Object.keys(dbUpdates).length > 0) {
      await db.update(usersTable).set(dbUpdates).where(eq(usersTable.id, id));
    }
    return this.getUser(id);
  }

  async getWorkouts(userId: string): Promise<Workout[]> {
    const rows = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId)).orderBy(desc(workoutsTable.createdAt));
    return rows.map(rowToWorkout);
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    const rows = await db.select().from(workoutsTable).where(eq(workoutsTable.id, id));
    return rows.length ? rowToWorkout(rows[0]) : undefined;
  }

  async createWorkout(input: Omit<Workout, "id" | "createdAt" | "sentToGarmin" | "sentToIntervals">): Promise<Workout> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.insert(workoutsTable).values({
      id,
      userId: input.userId,
      name: input.name,
      description: input.description,
      sportType: input.sportType,
      steps: input.steps,
      scheduledDate: input.scheduledDate ?? null,
      createdAt,
      sentToGarmin: false,
      sentToIntervals: false,
      garminWorkoutId: input.garminWorkoutId ?? null,
      intervalsEventId: input.intervalsEventId ?? null,
      explanation: input.explanation ?? null,
    });
    return (await this.getWorkout(id))!;
  }

  async updateWorkout(id: string, updates: Partial<Workout>): Promise<Workout | undefined> {
    const existing = await this.getWorkout(id);
    if (!existing) return undefined;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.sportType !== undefined) dbUpdates.sportType = updates.sportType;
    if (updates.steps !== undefined) dbUpdates.steps = updates.steps;
    if (updates.scheduledDate !== undefined) dbUpdates.scheduledDate = updates.scheduledDate;
    if (updates.sentToGarmin !== undefined) dbUpdates.sentToGarmin = updates.sentToGarmin;
    if (updates.garminWorkoutId !== undefined) dbUpdates.garminWorkoutId = updates.garminWorkoutId;
    if (updates.sentToIntervals !== undefined) dbUpdates.sentToIntervals = updates.sentToIntervals;
    if (updates.intervalsEventId !== undefined) dbUpdates.intervalsEventId = updates.intervalsEventId;
    if (updates.explanation !== undefined) dbUpdates.explanation = updates.explanation;
    if (Object.keys(dbUpdates).length > 0) {
      await db.update(workoutsTable).set(dbUpdates).where(eq(workoutsTable.id, id));
    }
    return this.getWorkout(id);
  }

  async deleteWorkout(id: string): Promise<boolean> {
    const result = await db.delete(workoutsTable).where(eq(workoutsTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getFavorites(userId: string): Promise<FavoriteWorkout[]> {
    const rows = await db.select().from(favoritesTable).where(eq(favoritesTable.userId, userId)).orderBy(desc(favoritesTable.savedAt));
    return rows.map(rowToFavorite);
  }

  async addFavorite(input: Omit<FavoriteWorkout, "id" | "savedAt">): Promise<FavoriteWorkout> {
    const id = randomUUID();
    const savedAt = new Date().toISOString();
    await db.insert(favoritesTable).values({
      id,
      userId: input.userId,
      name: input.name,
      description: input.description,
      sportType: input.sportType,
      steps: input.steps,
      savedAt,
    });
    const rows = await db.select().from(favoritesTable).where(eq(favoritesTable.id, id));
    return rowToFavorite(rows[0]);
  }

  async deleteFavorite(id: string): Promise<boolean> {
    const result = await db.delete(favoritesTable).where(eq(favoritesTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getMessages(userId: string): Promise<ChatMessage[]> {
    const rows = await db.select().from(messagesTable).where(eq(messagesTable.userId, userId)).orderBy(asc(messagesTable.timestamp));
    return rows.map(rowToMessage);
  }

  async addMessage(input: Omit<ChatMessage, "id">): Promise<ChatMessage> {
    const id = randomUUID();
    await db.insert(messagesTable).values({
      id,
      userId: input.userId,
      role: input.role,
      content: input.content,
      timestamp: input.timestamp,
      workoutJson: input.workoutJson ?? null,
      workoutsJson: input.workoutsJson ?? null,
      rescheduleData: input.rescheduleData ?? null,
    });
    const rows = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
    return rowToMessage(rows[0]);
  }

  async clearMessages(userId: string): Promise<void> {
    await db.delete(messagesTable).where(eq(messagesTable.userId, userId));
  }

  async getAllUsers(): Promise<User[]> {
    const rows = await db.select().from(usersTable);
    return rows.map(rowToUser);
  }

  async getAllWorkouts(): Promise<Workout[]> {
    const rows = await db.select().from(workoutsTable);
    return rows.map(rowToWorkout);
  }

  async getAllMessages(): Promise<ChatMessage[]> {
    const rows = await db.select().from(messagesTable);
    return rows.map(rowToMessage);
  }

  async addBugReport(input: Omit<BugReport, "id" | "timestamp" | "status">): Promise<BugReport> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    await db.insert(bugReportsTable).values({
      id,
      userId: input.userId,
      username: input.username,
      message: input.message,
      page: input.page,
      timestamp,
      status: "new",
    });
    const rows = await db.select().from(bugReportsTable).where(eq(bugReportsTable.id, id));
    return rowToBugReport(rows[0]);
  }

  async getAllBugReports(): Promise<BugReport[]> {
    const rows = await db.select().from(bugReportsTable).orderBy(desc(bugReportsTable.timestamp));
    return rows.map(rowToBugReport);
  }

  async updateBugReport(id: string, updates: Partial<BugReport>): Promise<BugReport | undefined> {
    const rows = await db.select().from(bugReportsTable).where(eq(bugReportsTable.id, id));
    if (!rows.length) return undefined;
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.message !== undefined) dbUpdates.message = updates.message;
    if (Object.keys(dbUpdates).length > 0) {
      await db.update(bugReportsTable).set(dbUpdates).where(eq(bugReportsTable.id, id));
    }
    const updated = await db.select().from(bugReportsTable).where(eq(bugReportsTable.id, id));
    return rowToBugReport(updated[0]);
  }

  async deleteBugReport(id: string): Promise<boolean> {
    const result = await db.delete(bugReportsTable).where(eq(bugReportsTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getPromptVariants(): Promise<AiPromptVariant[]> {
    const rows = await db.select().from(promptVariantsTable).orderBy(desc(promptVariantsTable.createdAt));
    return rows.map(rowToPromptVariant);
  }

  async addPromptVariant(input: Omit<AiPromptVariant, "id" | "createdAt">): Promise<AiPromptVariant> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.insert(promptVariantsTable).values({
      id,
      name: input.name,
      instructions: input.instructions,
      weight: input.weight,
      isActive: input.isActive,
      createdAt,
    });
    const rows = await db.select().from(promptVariantsTable).where(eq(promptVariantsTable.id, id));
    return rowToPromptVariant(rows[0]);
  }

  async updatePromptVariant(id: string, updates: Partial<AiPromptVariant>): Promise<AiPromptVariant | undefined> {
    const rows = await db.select().from(promptVariantsTable).where(eq(promptVariantsTable.id, id));
    if (!rows.length) return undefined;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.instructions !== undefined) dbUpdates.instructions = updates.instructions;
    if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
    if (updates.isActive !== undefined) dbUpdates.isActive = updates.isActive;
    if (Object.keys(dbUpdates).length > 0) {
      await db.update(promptVariantsTable).set(dbUpdates).where(eq(promptVariantsTable.id, id));
    }
    const updated = await db.select().from(promptVariantsTable).where(eq(promptVariantsTable.id, id));
    return rowToPromptVariant(updated[0]);
  }

  async deletePromptVariant(id: string): Promise<boolean> {
    const result = await db.delete(promptVariantsTable).where(eq(promptVariantsTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllAiLogs(): Promise<AiRequestLog[]> {
    const rows = await db.select().from(aiLogsTable).orderBy(desc(aiLogsTable.timestamp));
    return rows.map(rowToAiLog);
  }

  async addAiLog(input: Omit<AiRequestLog, "id">): Promise<AiRequestLog> {
    const id = randomUUID();
    await db.insert(aiLogsTable).values({
      id,
      userId: input.userId,
      username: input.username,
      timestamp: input.timestamp,
      userMessage: input.userMessage,
      aiResponse: input.aiResponse ?? null,
      responseLength: input.responseLength,
      hadWorkout: input.hadWorkout,
      hadPlan: input.hadPlan,
      responseTimeMs: input.responseTimeMs,
      promptVariantId: input.promptVariantId,
      promptVariantName: input.promptVariantName,
      rating: input.rating ?? null,
      notes: input.notes ?? null,
      isError: input.isError ?? null,
      errorMessage: input.errorMessage ?? null,
    });
    const rows = await db.select().from(aiLogsTable).where(eq(aiLogsTable.id, id));
    return rowToAiLog(rows[0]);
  }

  async updateAiLog(id: string, updates: Partial<AiRequestLog>): Promise<AiRequestLog | undefined> {
    const rows = await db.select().from(aiLogsTable).where(eq(aiLogsTable.id, id));
    if (!rows.length) return undefined;
    const dbUpdates: any = {};
    if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.aiResponse !== undefined) dbUpdates.aiResponse = updates.aiResponse;
    if (updates.isError !== undefined) dbUpdates.isError = updates.isError;
    if (updates.errorMessage !== undefined) dbUpdates.errorMessage = updates.errorMessage;
    if (Object.keys(dbUpdates).length > 0) {
      await db.update(aiLogsTable).set(dbUpdates).where(eq(aiLogsTable.id, id));
    }
    const updated = await db.select().from(aiLogsTable).where(eq(aiLogsTable.id, id));
    return rowToAiLog(updated[0]);
  }

  async getAllErrorLogs(): Promise<ErrorLog[]> {
    const rows = await db.select().from(errorLogsTable).orderBy(desc(errorLogsTable.timestamp));
    return rows.map(rowToErrorLog);
  }

  async addErrorLog(input: Omit<ErrorLog, "id" | "timestamp" | "status">): Promise<ErrorLog> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    await db.insert(errorLogsTable).values({
      id,
      source: input.source,
      userId: input.userId,
      username: input.username,
      errorMessage: input.errorMessage,
      context: input.context ?? null,
      timestamp,
      status: "new",
    });
    const rows = await db.select().from(errorLogsTable).where(eq(errorLogsTable.id, id));
    return rowToErrorLog(rows[0]);
  }

  async updateErrorLog(id: string, updates: Partial<ErrorLog>): Promise<ErrorLog | undefined> {
    const rows = await db.select().from(errorLogsTable).where(eq(errorLogsTable.id, id));
    if (!rows.length) return undefined;
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.errorMessage !== undefined) dbUpdates.errorMessage = updates.errorMessage;
    if (updates.context !== undefined) dbUpdates.context = updates.context;
    if (Object.keys(dbUpdates).length > 0) {
      await db.update(errorLogsTable).set(dbUpdates).where(eq(errorLogsTable.id, id));
    }
    const updated = await db.select().from(errorLogsTable).where(eq(errorLogsTable.id, id));
    return rowToErrorLog(updated[0]);
  }

  async deleteErrorLog(id: string): Promise<boolean> {
    const result = await db.delete(errorLogsTable).where(eq(errorLogsTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async ensureBasePromptVariant(): Promise<void> {
    const rows = await db.select().from(promptVariantsTable).where(eq(promptVariantsTable.id, "base"));
    if (!rows.length) {
      await db.insert(promptVariantsTable).values({
        id: "base",
        name: "Базовый",
        instructions: "",
        weight: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async getCachedActivities(userId: string): Promise<GarminActivity[]> {
    const rows = await db.select().from(cachedActivitiesTable)
      .where(eq(cachedActivitiesTable.userId, userId))
      .orderBy(desc(cachedActivitiesTable.startTimeLocal));
    return rows.map(r => ({
      activityId: r.activityId,
      activityName: r.activityName,
      activityType: r.activityType,
      distance: r.distance,
      duration: r.duration,
      startTimeLocal: r.startTimeLocal,
      averageHR: r.averageHR ?? undefined,
      maxHR: r.maxHR ?? undefined,
      averagePace: r.averagePace ?? undefined,
      startLatitude: r.startLatitude ?? undefined,
      startLongitude: r.startLongitude ?? undefined,
      locationName: r.locationName ?? undefined,
    }));
  }

  async saveCachedActivities(userId: string, activities: GarminActivity[], source: string): Promise<void> {
    if (!activities.length) return;
    const existing = await db.select({ activityId: cachedActivitiesTable.activityId })
      .from(cachedActivitiesTable)
      .where(eq(cachedActivitiesTable.userId, userId));
    const existingIds = new Set(existing.map(r => r.activityId));
    const newActivities = activities.filter(a => !existingIds.has(a.activityId));
    if (!newActivities.length) return;
    const now = new Date().toISOString();
    const values = newActivities.map(a => ({
      id: randomUUID(),
      userId,
      activityId: a.activityId,
      activityName: a.activityName,
      activityType: a.activityType,
      distance: a.distance,
      duration: a.duration,
      startTimeLocal: a.startTimeLocal,
      averageHR: a.averageHR ?? null,
      maxHR: a.maxHR ?? null,
      averagePace: a.averagePace ?? null,
      startLatitude: a.startLatitude ?? null,
      startLongitude: a.startLongitude ?? null,
      locationName: a.locationName ?? null,
      source,
      cachedAt: now,
    }));
    for (let i = 0; i < values.length; i += 50) {
      await db.insert(cachedActivitiesTable).values(values.slice(i, i + 50));
    }
  }

  async getCachedActivityIds(userId: string): Promise<Set<number>> {
    const rows = await db.select({ activityId: cachedActivitiesTable.activityId })
      .from(cachedActivitiesTable)
      .where(eq(cachedActivitiesTable.userId, userId));
    return new Set(rows.map(r => r.activityId));
  }

  async clearCachedActivities(userId: string): Promise<void> {
    await db.delete(cachedActivitiesTable).where(eq(cachedActivitiesTable.userId, userId));
  }
}
