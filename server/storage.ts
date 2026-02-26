import type { User, Workout, ChatMessage, FavoriteWorkout, SportType, FitnessLevel, BugReport, AiPromptVariant, AiRequestLog, ErrorLog, GarminActivity } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const WORKOUTS_FILE = path.join(DATA_DIR, "workouts.json");
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const BUG_REPORTS_FILE = path.join(DATA_DIR, "bug-reports.json");
const AI_LOGS_FILE = path.join(DATA_DIR, "ai-logs.json");
const PROMPT_VARIANTS_FILE = path.join(DATA_DIR, "prompt-variants.json");
const ERROR_LOGS_FILE = path.join(DATA_DIR, "error-logs.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJson<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {}
  return defaultVal;
}

function saveJson(filePath: string, data: any) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: { username: string; password: string; sportTypes: SportType[]; goals: string; fitnessLevel?: FitnessLevel }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  verifyPassword(user: User, password: string): Promise<boolean>;

  getWorkouts(userId: string): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | undefined>;
  createWorkout(workout: Omit<Workout, "id" | "createdAt" | "sentToGarmin" | "sentToIntervals">): Promise<Workout>;
  updateWorkout(id: string, updates: Partial<Workout>): Promise<Workout | undefined>;
  deleteWorkout(id: string): Promise<boolean>;

  getFavorites(userId: string): Promise<FavoriteWorkout[]>;
  addFavorite(favorite: Omit<FavoriteWorkout, "id" | "savedAt">): Promise<FavoriteWorkout>;
  deleteFavorite(id: string): Promise<boolean>;

  getMessages(userId: string): Promise<ChatMessage[]>;
  addMessage(message: Omit<ChatMessage, "id">): Promise<ChatMessage>;
  clearMessages(userId: string): Promise<void>;

  getAllUsers(): Promise<User[]>;
  getAllWorkouts(): Promise<Workout[]>;
  getAllMessages(): Promise<ChatMessage[]>;

  addBugReport(report: Omit<BugReport, "id" | "timestamp" | "status">): Promise<BugReport>;
  getAllBugReports(): Promise<BugReport[]>;
  updateBugReport(id: string, updates: Partial<BugReport>): Promise<BugReport | undefined>;
  deleteBugReport(id: string): Promise<boolean>;

  getPromptVariants(): Promise<AiPromptVariant[]>;
  addPromptVariant(variant: Omit<AiPromptVariant, "id" | "createdAt">): Promise<AiPromptVariant>;
  updatePromptVariant(id: string, updates: Partial<AiPromptVariant>): Promise<AiPromptVariant | undefined>;
  deletePromptVariant(id: string): Promise<boolean>;

  getAllAiLogs(): Promise<AiRequestLog[]>;
  addAiLog(log: Omit<AiRequestLog, "id">): Promise<AiRequestLog>;
  updateAiLog(id: string, updates: Partial<AiRequestLog>): Promise<AiRequestLog | undefined>;

  getAllErrorLogs(): Promise<ErrorLog[]>;
  addErrorLog(log: Omit<ErrorLog, "id" | "timestamp" | "status">): Promise<ErrorLog>;
  updateErrorLog(id: string, updates: Partial<ErrorLog>): Promise<ErrorLog | undefined>;
  deleteErrorLog(id: string): Promise<boolean>;

  getCachedActivities(userId: string): Promise<GarminActivity[]>;
  saveCachedActivities(userId: string, activities: GarminActivity[], source: string): Promise<void>;
  getLatestCachedActivityDate(userId: string): Promise<string | null>;
  clearCachedActivities(userId: string): Promise<void>;
}

export class FileStorage implements IStorage {
  private users: Map<string, User>;
  private workouts: Map<string, Workout>;
  private favorites: Map<string, FavoriteWorkout>;
  private messages: Map<string, ChatMessage>;
  private bugReports: Map<string, BugReport>;
  private aiLogs: Map<string, AiRequestLog>;
  private promptVariants: Map<string, AiPromptVariant>;
  private errorLogs: Map<string, ErrorLog>;

  constructor() {
    ensureDataDir();
    const usersArr: User[] = loadJson(USERS_FILE, []);
    const workoutsArr: Workout[] = loadJson(WORKOUTS_FILE, []);
    const favoritesArr: FavoriteWorkout[] = loadJson(FAVORITES_FILE, []);
    const messagesArr: ChatMessage[] = loadJson(MESSAGES_FILE, []);
    const bugReportsArr: BugReport[] = loadJson(BUG_REPORTS_FILE, []);
    const aiLogsArr: AiRequestLog[] = loadJson(AI_LOGS_FILE, []);
    const promptVariantsArr: AiPromptVariant[] = loadJson(PROMPT_VARIANTS_FILE, []);
    const errorLogsArr: ErrorLog[] = loadJson(ERROR_LOGS_FILE, []);

    this.users = new Map(usersArr.map((u) => [u.id, u]));
    this.workouts = new Map(workoutsArr.map((w) => [w.id, w]));
    this.favorites = new Map(favoritesArr.map((f) => [f.id, f]));
    this.messages = new Map(messagesArr.map((m) => [m.id, m]));
    this.bugReports = new Map(bugReportsArr.map((r) => [r.id, r]));
    this.aiLogs = new Map(aiLogsArr.map((l) => [l.id, l]));
    this.promptVariants = new Map(promptVariantsArr.map((v) => [v.id, v]));
    this.errorLogs = new Map(errorLogsArr.map((e) => [e.id, e]));

    this.ensureBasePromptVariant();
  }

  private ensureBasePromptVariant() {
    const hasBase = Array.from(this.promptVariants.values()).some((v) => v.id === "base");
    if (!hasBase) {
      const base: AiPromptVariant = {
        id: "base",
        name: "Базовый",
        instructions: "",
        weight: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.promptVariants.set("base", base);
      this.savePromptVariants();
    }
  }

  private saveUsers() {
    saveJson(USERS_FILE, Array.from(this.users.values()));
  }
  private saveWorkouts() {
    saveJson(WORKOUTS_FILE, Array.from(this.workouts.values()));
  }
  private saveFavorites() {
    saveJson(FAVORITES_FILE, Array.from(this.favorites.values()));
  }
  private saveMessages() {
    saveJson(MESSAGES_FILE, Array.from(this.messages.values()));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(input: { username: string; password: string; sportTypes: SportType[]; goals: string; fitnessLevel?: FitnessLevel }): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user: User = {
      id,
      username: input.username,
      password: hashedPassword,
      sportTypes: input.sportTypes,
      goals: input.goals,
      fitnessLevel: input.fitnessLevel,
      garminConnected: false,
      intervalsConnected: false,
    };
    this.users.set(id, user);
    this.saveUsers();
    return user;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    this.saveUsers();
    return updated;
  }

  async getWorkouts(userId: string): Promise<Workout[]> {
    return Array.from(this.workouts.values())
      .filter((w) => w.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    return this.workouts.get(id);
  }

  async createWorkout(input: Omit<Workout, "id" | "createdAt" | "sentToGarmin" | "sentToIntervals">): Promise<Workout> {
    const id = randomUUID();
    const workout: Workout = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
      sentToGarmin: false,
      sentToIntervals: false,
    };
    this.workouts.set(id, workout);
    this.saveWorkouts();
    return workout;
  }

  async updateWorkout(id: string, updates: Partial<Workout>): Promise<Workout | undefined> {
    const workout = this.workouts.get(id);
    if (!workout) return undefined;
    const updated = { ...workout, ...updates };
    this.workouts.set(id, updated);
    this.saveWorkouts();
    return updated;
  }

  async deleteWorkout(id: string): Promise<boolean> {
    const result = this.workouts.delete(id);
    if (result) this.saveWorkouts();
    return result;
  }

  async getFavorites(userId: string): Promise<FavoriteWorkout[]> {
    return Array.from(this.favorites.values())
      .filter((f) => f.userId === userId)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }

  async addFavorite(input: Omit<FavoriteWorkout, "id" | "savedAt">): Promise<FavoriteWorkout> {
    const id = randomUUID();
    const favorite: FavoriteWorkout = {
      ...input,
      id,
      savedAt: new Date().toISOString(),
    };
    this.favorites.set(id, favorite);
    this.saveFavorites();
    return favorite;
  }

  async deleteFavorite(id: string): Promise<boolean> {
    const result = this.favorites.delete(id);
    if (result) this.saveFavorites();
    return result;
  }

  async getMessages(userId: string): Promise<ChatMessage[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async addMessage(input: Omit<ChatMessage, "id">): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = { ...input, id };
    this.messages.set(id, message);
    this.saveMessages();
    return message;
  }

  async clearMessages(userId: string): Promise<void> {
    const toDelete = Array.from(this.messages.entries())
      .filter(([, m]) => m.userId === userId)
      .map(([k]) => k);
    toDelete.forEach((k) => this.messages.delete(k));
    this.saveMessages();
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAllWorkouts(): Promise<Workout[]> {
    return Array.from(this.workouts.values());
  }

  async getAllMessages(): Promise<ChatMessage[]> {
    return Array.from(this.messages.values());
  }

  private saveBugReports() {
    saveJson(BUG_REPORTS_FILE, Array.from(this.bugReports.values()));
  }

  async addBugReport(input: Omit<BugReport, "id" | "timestamp" | "status">): Promise<BugReport> {
    const id = randomUUID();
    const report: BugReport = {
      ...input,
      id,
      timestamp: new Date().toISOString(),
      status: "new",
    };
    this.bugReports.set(id, report);
    this.saveBugReports();
    return report;
  }

  async getAllBugReports(): Promise<BugReport[]> {
    return Array.from(this.bugReports.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async updateBugReport(id: string, updates: Partial<BugReport>): Promise<BugReport | undefined> {
    const report = this.bugReports.get(id);
    if (!report) return undefined;
    const updated = { ...report, ...updates };
    this.bugReports.set(id, updated);
    this.saveBugReports();
    return updated;
  }

  async deleteBugReport(id: string): Promise<boolean> {
    const existed = this.bugReports.delete(id);
    if (existed) this.saveBugReports();
    return existed;
  }

  private saveAiLogs() {
    saveJson(AI_LOGS_FILE, Array.from(this.aiLogs.values()));
  }

  private savePromptVariants() {
    saveJson(PROMPT_VARIANTS_FILE, Array.from(this.promptVariants.values()));
  }

  async getPromptVariants(): Promise<AiPromptVariant[]> {
    return Array.from(this.promptVariants.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addPromptVariant(input: Omit<AiPromptVariant, "id" | "createdAt">): Promise<AiPromptVariant> {
    const id = randomUUID();
    const variant: AiPromptVariant = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };
    this.promptVariants.set(id, variant);
    this.savePromptVariants();
    return variant;
  }

  async updatePromptVariant(id: string, updates: Partial<AiPromptVariant>): Promise<AiPromptVariant | undefined> {
    const variant = this.promptVariants.get(id);
    if (!variant) return undefined;
    const updated = { ...variant, ...updates };
    this.promptVariants.set(id, updated);
    this.savePromptVariants();
    return updated;
  }

  async deletePromptVariant(id: string): Promise<boolean> {
    const existed = this.promptVariants.delete(id);
    if (existed) this.savePromptVariants();
    return existed;
  }

  async getAllAiLogs(): Promise<AiRequestLog[]> {
    return Array.from(this.aiLogs.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async addAiLog(input: Omit<AiRequestLog, "id">): Promise<AiRequestLog> {
    const id = randomUUID();
    const log: AiRequestLog = { ...input, id };
    this.aiLogs.set(id, log);
    this.saveAiLogs();
    return log;
  }

  async updateAiLog(id: string, updates: Partial<AiRequestLog>): Promise<AiRequestLog | undefined> {
    const log = this.aiLogs.get(id);
    if (!log) return undefined;
    const updated = { ...log, ...updates };
    this.aiLogs.set(id, updated);
    this.saveAiLogs();
    return updated;
  }

  private saveErrorLogs() {
    saveJson(ERROR_LOGS_FILE, Array.from(this.errorLogs.values()));
  }

  async getAllErrorLogs(): Promise<ErrorLog[]> {
    return Array.from(this.errorLogs.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async addErrorLog(input: Omit<ErrorLog, "id" | "timestamp" | "status">): Promise<ErrorLog> {
    const id = randomUUID();
    const log: ErrorLog = { ...input, id, timestamp: new Date().toISOString(), status: "new" };
    this.errorLogs.set(id, log);
    this.saveErrorLogs();
    return log;
  }

  async updateErrorLog(id: string, updates: Partial<ErrorLog>): Promise<ErrorLog | undefined> {
    const log = this.errorLogs.get(id);
    if (!log) return undefined;
    const updated = { ...log, ...updates };
    this.errorLogs.set(id, updated);
    this.saveErrorLogs();
    return updated;
  }

  async deleteErrorLog(id: string): Promise<boolean> {
    if (!this.errorLogs.has(id)) return false;
    this.errorLogs.delete(id);
    this.saveErrorLogs();
    return true;
  }

  private cachedActivities: Map<string, { activities: GarminActivity[]; source: string }> = new Map();

  async getCachedActivities(userId: string): Promise<GarminActivity[]> {
    return this.cachedActivities.get(userId)?.activities || [];
  }

  async saveCachedActivities(userId: string, activities: GarminActivity[], source: string): Promise<void> {
    const existing = this.cachedActivities.get(userId)?.activities || [];
    const existingIds = new Set(existing.map(a => a.activityId));
    const newActivities = activities.filter(a => !existingIds.has(a.activityId));
    const merged = [...newActivities, ...existing].sort(
      (a, b) => new Date(b.startTimeLocal).getTime() - new Date(a.startTimeLocal).getTime()
    );
    this.cachedActivities.set(userId, { activities: merged, source });
  }

  async getLatestCachedActivityDate(userId: string): Promise<string | null> {
    const cached = this.cachedActivities.get(userId);
    if (!cached || cached.activities.length === 0) return null;
    return cached.activities[0].startTimeLocal;
  }

  async clearCachedActivities(userId: string): Promise<void> {
    this.cachedActivities.delete(userId);
  }
}

import { PostgresStorage, initPgPool } from "./pg-storage";

function createStorage(): IStorage {
  const mode = (process.env.STORAGE_MODE || "json").toLowerCase();
  if (mode === "pg") {
    console.log("[storage] Using PostgreSQL storage mode");
    initPgPool();
    const pgStorage = new PostgresStorage();
    pgStorage.ensureBasePromptVariant().catch((err) =>
      console.error("[storage] Failed to ensure base prompt variant:", err)
    );
    return pgStorage;
  }
  console.log("[storage] Using JSON file storage mode");
  return new FileStorage();
}

export const storage = createStorage();
