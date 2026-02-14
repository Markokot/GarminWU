import type { User, Workout, ChatMessage, FavoriteWorkout, SportType, FitnessLevel } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const WORKOUTS_FILE = path.join(DATA_DIR, "workouts.json");
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

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
}

export class FileStorage implements IStorage {
  private users: Map<string, User>;
  private workouts: Map<string, Workout>;
  private favorites: Map<string, FavoriteWorkout>;
  private messages: Map<string, ChatMessage>;

  constructor() {
    ensureDataDir();
    const usersArr: User[] = loadJson(USERS_FILE, []);
    const workoutsArr: Workout[] = loadJson(WORKOUTS_FILE, []);
    const favoritesArr: FavoriteWorkout[] = loadJson(FAVORITES_FILE, []);
    const messagesArr: ChatMessage[] = loadJson(MESSAGES_FILE, []);

    this.users = new Map(usersArr.map((u) => [u.id, u]));
    this.workouts = new Map(workoutsArr.map((w) => [w.id, w]));
    this.favorites = new Map(favoritesArr.map((f) => [f.id, f]));
    this.messages = new Map(messagesArr.map((m) => [m.id, m]));
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
}

export const storage = new FileStorage();
