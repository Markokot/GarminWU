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
  createdAt: string;
  sentToGarmin: boolean;
  garminWorkoutId?: number;
}

export interface User {
  id: string;
  username: string;
  password: string;
  garminEmail?: string;
  garminConnected: boolean;
  sportTypes: SportType[];
  goals: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  workoutJson?: Workout;
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
});

export const garminConnectSchema = z.object({
  garminEmail: z.string().email("Введите корректный email"),
  garminPassword: z.string().min(1, "Введите пароль"),
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
  steps: z.array(workoutStepSchema).min(1, "Добавьте хотя бы один шаг"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GarminConnectInput = z.infer<typeof garminConnectSchema>;
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type InsertUser = Omit<User, "id" | "garminConnected">;
