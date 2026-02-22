import { z } from "zod";
import { pgTable, text, varchar, boolean, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";

export const sportTypes = ["running", "cycling", "swimming"] as const;
export type SportType = (typeof sportTypes)[number];

export const sportTypeLabels: Record<SportType, string> = {
  running: "Бег",
  cycling: "Велосипед",
  swimming: "Плавание",
};

export const stepTypes = ["warmup", "interval", "recovery", "rest", "cooldown", "repeat"] as const;
export type StepType = (typeof stepTypes)[number];

export const stepTypeLabels: Record<StepType, string> = {
  warmup: "Разминка",
  interval: "Интервал",
  recovery: "Восстановление",
  rest: "Отдых",
  cooldown: "Заминка",
  repeat: "Повтор",
};

export const durationTypes = ["time", "distance", "lap.button"] as const;
export type DurationType = (typeof durationTypes)[number];

export const targetTypes = ["no.target", "pace.zone", "heart.rate.zone", "power.zone", "cadence"] as const;
export type TargetType = (typeof targetTypes)[number];

export const targetTypeLabels: Record<TargetType, string> = {
  "no.target": "Без цели",
  "pace.zone": "Темп",
  "heart.rate.zone": "Пульсовая зона",
  "power.zone": "Мощность",
  "cadence": "Каденс",
};

export const intensityTypes = ["active", "resting"] as const;
export type IntensityType = (typeof intensityTypes)[number];

export interface WorkoutStep {
  stepId: number;
  stepOrder: number;
  stepType: StepType;
  durationType: DurationType;
  durationValue: number | null;
  targetType: TargetType;
  targetValueLow: number | null;
  targetValueHigh: number | null;
  intensity: IntensityType;
  repeatCount?: number;
  childSteps?: WorkoutStep[];
}

export interface WorkoutExplanation {
  why: string;
  adaptation: string;
  successSignal: string;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  description: string;
  sportType: SportType;
  steps: WorkoutStep[];
  scheduledDate?: string | null;
  createdAt: string;
  sentToGarmin: boolean;
  garminWorkoutId?: number;
  sentToIntervals: boolean;
  intervalsEventId?: string;
  explanation?: WorkoutExplanation | null;
}

export interface FavoriteWorkout {
  id: string;
  userId: string;
  name: string;
  description: string;
  sportType: SportType;
  steps: WorkoutStep[];
  savedAt: string;
}

export const garminWatchModels = [
  "forerunner_55",
  "forerunner_165",
  "forerunner_245",
  "forerunner_255",
  "forerunner_265",
  "forerunner_645",
  "forerunner_745",
  "forerunner_945",
  "forerunner_955",
  "forerunner_965",
  "venu",
  "venu_2",
  "venu_2s",
  "venu_3",
  "venu_3s",
  "venu_sq",
  "fenix_5",
  "fenix_6",
  "fenix_7",
  "fenix_8",
  "fenix_e",
  "enduro",
  "enduro_2",
  "enduro_3",
  "epix_2",
  "epix_pro",
  "marq",
  "instinct",
  "instinct_2",
  "instinct_3",
  "vivoactive_4",
  "vivoactive_5",
  "swim_2",
  "other",
] as const;

export type GarminWatchModel = (typeof garminWatchModels)[number];

export const garminWatchLabels: Record<GarminWatchModel, string> = {
  forerunner_55: "Forerunner 55",
  forerunner_165: "Forerunner 165",
  forerunner_245: "Forerunner 245",
  forerunner_255: "Forerunner 255",
  forerunner_265: "Forerunner 265",
  forerunner_645: "Forerunner 645",
  forerunner_745: "Forerunner 745",
  forerunner_945: "Forerunner 945",
  forerunner_955: "Forerunner 955",
  forerunner_965: "Forerunner 965",
  venu: "Venu",
  venu_2: "Venu 2",
  venu_2s: "Venu 2S",
  venu_3: "Venu 3",
  venu_3s: "Venu 3S",
  venu_sq: "Venu Sq",
  fenix_5: "Fenix 5 серия",
  fenix_6: "Fenix 6 серия",
  fenix_7: "Fenix 7 серия",
  fenix_8: "Fenix 8 серия",
  fenix_e: "Fenix E",
  enduro: "Enduro",
  enduro_2: "Enduro 2",
  enduro_3: "Enduro 3",
  epix_2: "Epix (Gen 2)",
  epix_pro: "Epix Pro",
  marq: "MARQ серия",
  instinct: "Instinct",
  instinct_2: "Instinct 2",
  instinct_3: "Instinct 3",
  vivoactive_4: "Vivoactive 4",
  vivoactive_5: "Vivoactive 5",
  swim_2: "Swim 2",
  other: "Другие / не знаю",
};

export const swimStructuredWatchModels: GarminWatchModel[] = [
  "forerunner_245",
  "forerunner_255",
  "forerunner_265",
  "forerunner_745",
  "forerunner_945",
  "forerunner_955",
  "forerunner_965",
  "fenix_5",
  "fenix_6",
  "fenix_7",
  "fenix_8",
  "enduro",
  "enduro_2",
  "enduro_3",
  "epix_2",
  "epix_pro",
  "marq",
  "swim_2",
  "instinct_3",
];

export const nativeRunningPowerWatchModels: GarminWatchModel[] = [
  "forerunner_255",
  "forerunner_265",
  "forerunner_955",
  "forerunner_965",
  "fenix_7",
  "fenix_8",
  "enduro_2",
  "enduro_3",
  "epix_2",
  "epix_pro",
  "marq",
  "instinct_3",
  "venu_3",
  "venu_3s",
];

export const fitnessLevels = ["beginner", "intermediate", "advanced", "elite"] as const;
export type FitnessLevel = (typeof fitnessLevels)[number];

export const fitnessLevelLabels: Record<FitnessLevel, string> = {
  beginner: "Начинающий",
  intermediate: "Средний",
  advanced: "Продвинутый",
  elite: "Элита",
};

export interface User {
  id: string;
  username: string;
  password: string;
  garminEmail?: string;
  garminPassword?: string;
  garminConnected: boolean;
  intervalsAthleteId?: string;
  intervalsApiKey?: string;
  intervalsConnected: boolean;
  sportTypes: SportType[];
  goals: string;
  fitnessLevel?: FitnessLevel;
  age?: number;
  weeklyHours?: number;
  experienceYears?: number;
  injuries?: string;
  personalRecords?: string;
  preferences?: string;
  garminWatch?: GarminWatchModel;
  garminPushCount?: number;
  intervalsPushCount?: number;
  favoritesCount?: number;
  onboardingShown?: boolean;
  lastLogin?: string;
}

export interface BugReport {
  id: string;
  userId: string;
  username: string;
  message: string;
  page: string;
  timestamp: string;
  status: "new" | "read" | "resolved";
}

export interface AiPromptVariant {
  id: string;
  name: string;
  instructions: string;
  weight: number;
  isActive: boolean;
  createdAt: string;
}

export interface AiRequestLog {
  id: string;
  userId: string;
  username: string;
  timestamp: string;
  userMessage: string;
  aiResponse?: string;
  responseLength: number;
  hadWorkout: boolean;
  hadPlan: boolean;
  responseTimeMs: number;
  promptVariantId: string;
  promptVariantName: string;
  rating?: number;
  notes?: string;
  isError?: boolean;
  errorMessage?: string;
}

export interface ErrorLog {
  id: string;
  source: "ai" | "garmin" | "intervals";
  userId: string;
  username: string;
  timestamp: string;
  errorMessage: string;
  context?: string;
  status: "new" | "resolved";
}

export interface RescheduleData {
  workoutId: string;
  currentDate: string;
  newDate: string;
  reason?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  workoutJson?: Workout;
  workoutsJson?: Workout[];
  rescheduleData?: RescheduleData;
}

export interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: string;
  distance: number;
  duration: number;
  startTimeLocal: string;
  averageHR?: number;
  maxHR?: number;
  averagePace?: number;
  startLatitude?: number;
  startLongitude?: number;
  locationName?: string;
}

export const loginSchema = z.object({
  username: z.string().min(2, "Минимум 2 символа"),
  password: z.string().min(4, "Минимум 4 символа"),
});

export const registerSchema = z.object({
  username: z.string().min(2, "Минимум 2 символа"),
  password: z.string().min(4, "Минимум 4 символа"),
  sportTypes: z.array(z.enum(sportTypes)).min(1, "Выберите хотя бы один вид спорта"),
  goals: z.string().optional(),
  fitnessLevel: z.enum(fitnessLevels).optional(),
});

export const profileSchema = z.object({
  sportTypes: z.array(z.enum(sportTypes)).min(1, "Выберите хотя бы один вид спорта"),
  goals: z.string().optional(),
  fitnessLevel: z.enum(fitnessLevels).optional(),
  age: z.number().min(10).max(100).optional().nullable(),
  weeklyHours: z.number().min(0).max(40).optional().nullable(),
  experienceYears: z.number().min(0).max(50).optional().nullable(),
  injuries: z.string().optional(),
  personalRecords: z.string().optional(),
  preferences: z.string().optional(),
  garminWatch: z.enum(garminWatchModels).optional(),
});

export const garminConnectSchema = z.object({
  garminEmail: z.string().email("Введите корректный email"),
  garminPassword: z.string().min(1, "Введите пароль"),
});

export const intervalsConnectSchema = z.object({
  athleteId: z.string().min(1, "Введите Athlete ID"),
  apiKey: z.string().min(1, "Введите API ключ"),
});

export const workoutStepSchema: z.ZodType<WorkoutStep> = z.lazy(() =>
  z.object({
    stepId: z.number(),
    stepOrder: z.number(),
    stepType: z.enum(stepTypes),
    durationType: z.enum(durationTypes),
    durationValue: z.number().nullable(),
    targetType: z.enum(targetTypes),
    targetValueLow: z.number().nullable(),
    targetValueHigh: z.number().nullable(),
    intensity: z.enum(intensityTypes),
    repeatCount: z.number().optional(),
    childSteps: z.array(workoutStepSchema).optional(),
  })
);

export const createWorkoutSchema = z.object({
  name: z.string().min(1, "Введите название тренировки"),
  description: z.string().optional(),
  sportType: z.enum(sportTypes),
  scheduledDate: z.string().nullable().optional(),
  steps: z.array(workoutStepSchema).min(1, "Добавьте хотя бы один шаг"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GarminConnectInput = z.infer<typeof garminConnectSchema>;
export type IntervalsConnectInput = z.infer<typeof intervalsConnectSchema>;
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type InsertUser = Omit<User, "id" | "garminConnected" | "intervalsConnected">;

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: varchar("username").notNull().unique(),
  password: text("password").notNull(),
  garminEmail: text("garmin_email"),
  garminPassword: text("garmin_password"),
  garminConnected: boolean("garmin_connected").notNull().default(false),
  intervalsAthleteId: text("intervals_athlete_id"),
  intervalsApiKey: text("intervals_api_key"),
  intervalsConnected: boolean("intervals_connected").notNull().default(false),
  sportTypes: jsonb("sport_types").notNull().default([]),
  goals: text("goals").notNull().default(""),
  fitnessLevel: varchar("fitness_level"),
  age: integer("age"),
  weeklyHours: real("weekly_hours"),
  experienceYears: real("experience_years"),
  injuries: text("injuries"),
  personalRecords: text("personal_records"),
  preferences: text("preferences"),
  garminWatch: varchar("garmin_watch"),
  garminPushCount: integer("garmin_push_count"),
  intervalsPushCount: integer("intervals_push_count"),
  favoritesCount: integer("favorites_count"),
  onboardingShown: boolean("onboarding_shown"),
  lastLogin: text("last_login"),
});

export const workoutsTable = pgTable("workouts", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sportType: varchar("sport_type").notNull(),
  steps: jsonb("steps").notNull().default([]),
  scheduledDate: text("scheduled_date"),
  createdAt: text("created_at").notNull(),
  sentToGarmin: boolean("sent_to_garmin").notNull().default(false),
  garminWorkoutId: integer("garmin_workout_id"),
  sentToIntervals: boolean("sent_to_intervals").notNull().default(false),
  intervalsEventId: text("intervals_event_id"),
  explanation: jsonb("explanation"),
});

export const favoritesTable = pgTable("favorites", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sportType: varchar("sport_type").notNull(),
  steps: jsonb("steps").notNull().default([]),
  savedAt: text("saved_at").notNull(),
});

export const messagesTable = pgTable("messages", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  role: varchar("role").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
  workoutJson: jsonb("workout_json"),
  workoutsJson: jsonb("workouts_json"),
  rescheduleData: jsonb("reschedule_data"),
});

export const bugReportsTable = pgTable("bug_reports", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  username: varchar("username").notNull(),
  message: text("message").notNull(),
  page: text("page").notNull(),
  timestamp: text("timestamp").notNull(),
  status: varchar("status").notNull().default("new"),
});

export const aiLogsTable = pgTable("ai_logs", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  username: varchar("username").notNull(),
  timestamp: text("timestamp").notNull(),
  userMessage: text("user_message").notNull(),
  aiResponse: text("ai_response"),
  responseLength: integer("response_length").notNull(),
  hadWorkout: boolean("had_workout").notNull().default(false),
  hadPlan: boolean("had_plan").notNull().default(false),
  responseTimeMs: integer("response_time_ms").notNull(),
  promptVariantId: varchar("prompt_variant_id").notNull(),
  promptVariantName: varchar("prompt_variant_name").notNull(),
  rating: integer("rating"),
  notes: text("notes"),
  isError: boolean("is_error"),
  errorMessage: text("error_message"),
});

export const promptVariantsTable = pgTable("prompt_variants", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  instructions: text("instructions").notNull().default(""),
  weight: integer("weight").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const errorLogsTable = pgTable("error_logs", {
  id: varchar("id").primaryKey(),
  source: varchar("source").notNull(),
  userId: varchar("user_id").notNull(),
  username: varchar("username").notNull(),
  timestamp: text("timestamp").notNull(),
  errorMessage: text("error_message").notNull(),
  context: text("context"),
  status: varchar("status").notNull().default("new"),
});
