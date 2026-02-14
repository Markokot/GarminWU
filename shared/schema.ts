import { z } from "zod";

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
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  workoutJson?: Workout;
  workoutsJson?: Workout[];
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
