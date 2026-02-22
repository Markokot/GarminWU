import * as fs from "fs";
import * as path from "path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  usersTable, workoutsTable, favoritesTable, messagesTable,
  bugReportsTable, aiLogsTable, promptVariantsTable, errorLogsTable,
} from "../shared/schema";

const { Pool } = pg;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");

function loadJson<T>(filename: string, defaultVal: T): T {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return defaultVal;
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Starting migration from JSON to PostgreSQL...\n");

  const users = loadJson<any[]>("users.json", []);
  const workouts = loadJson<any[]>("workouts.json", []);
  const favorites = loadJson<any[]>("favorites.json", []);
  const messages = loadJson<any[]>("messages.json", []);
  const bugReports = loadJson<any[]>("bug-reports.json", []);
  const aiLogs = loadJson<any[]>("ai-logs.json", []);
  const promptVariants = loadJson<any[]>("prompt-variants.json", []);
  const errorLogs = loadJson<any[]>("error-logs.json", []);

  console.log(`Found: ${users.length} users, ${workouts.length} workouts, ${favorites.length} favorites`);
  console.log(`       ${messages.length} messages, ${bugReports.length} bug reports, ${aiLogs.length} AI logs`);
  console.log(`       ${promptVariants.length} prompt variants, ${errorLogs.length} error logs\n`);

  if (users.length) {
    console.log("Migrating users...");
    for (const u of users) {
      try {
        await db.insert(usersTable).values({
          id: u.id,
          username: u.username,
          password: u.password,
          garminEmail: u.garminEmail ?? null,
          garminPassword: u.garminPassword ?? null,
          garminConnected: u.garminConnected ?? false,
          intervalsAthleteId: u.intervalsAthleteId ?? null,
          intervalsApiKey: u.intervalsApiKey ?? null,
          intervalsConnected: u.intervalsConnected ?? false,
          sportTypes: u.sportTypes ?? [],
          goals: u.goals ?? "",
          fitnessLevel: u.fitnessLevel ?? null,
          age: u.age ?? null,
          weeklyHours: u.weeklyHours ?? null,
          experienceYears: u.experienceYears ?? null,
          injuries: u.injuries ?? null,
          personalRecords: u.personalRecords ?? null,
          preferences: u.preferences ?? null,
          garminWatch: u.garminWatch ?? null,
          garminPushCount: u.garminPushCount ?? null,
          intervalsPushCount: u.intervalsPushCount ?? null,
          favoritesCount: u.favoritesCount ?? null,
          onboardingShown: u.onboardingShown ?? null,
          lastLogin: u.lastLogin ?? null,
        }).onConflictDoNothing();
      } catch (e: any) {
        console.error(`  Failed to insert user ${u.username}: ${e.message}`);
      }
    }
    console.log(`  Done: ${users.length} users`);
  }

  if (workouts.length) {
    console.log("Migrating workouts...");
    for (const w of workouts) {
      try {
        await db.insert(workoutsTable).values({
          id: w.id,
          userId: w.userId,
          name: w.name,
          description: w.description ?? "",
          sportType: w.sportType,
          steps: w.steps ?? [],
          scheduledDate: w.scheduledDate ?? null,
          createdAt: w.createdAt,
          sentToGarmin: w.sentToGarmin ?? false,
          garminWorkoutId: w.garminWorkoutId ?? null,
          sentToIntervals: w.sentToIntervals ?? false,
          intervalsEventId: w.intervalsEventId ?? null,
          explanation: w.explanation ?? null,
        }).onConflictDoNothing();
      } catch (e: any) {
        console.error(`  Failed to insert workout ${w.name}: ${e.message}`);
      }
    }
    console.log(`  Done: ${workouts.length} workouts`);
  }

  if (favorites.length) {
    console.log("Migrating favorites...");
    for (const f of favorites) {
      try {
        await db.insert(favoritesTable).values({
          id: f.id,
          userId: f.userId,
          name: f.name,
          description: f.description ?? "",
          sportType: f.sportType,
          steps: f.steps ?? [],
          savedAt: f.savedAt,
        }).onConflictDoNothing();
      } catch (e: any) {
        console.error(`  Failed to insert favorite ${f.name}: ${e.message}`);
      }
    }
    console.log(`  Done: ${favorites.length} favorites`);
  }

  if (messages.length) {
    console.log("Migrating messages...");
    for (const m of messages) {
      try {
        await db.insert(messagesTable).values({
          id: m.id,
          userId: m.userId,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          workoutJson: m.workoutJson ?? null,
          workoutsJson: m.workoutsJson ?? null,
          rescheduleData: m.rescheduleData ?? null,
        }).onConflictDoNothing();
      } catch (e: any) {
        console.error(`  Failed to insert message: ${e.message}`);
      }
    }
    console.log(`  Done: ${messages.length} messages`);
  }

  if (bugReports.length) {
    console.log("Migrating bug reports...");
    for (const b of bugReports) {
      try {
        await db.insert(bugReportsTable).values({
          id: b.id,
          userId: b.userId,
          username: b.username,
          message: b.message,
          page: b.page,
          timestamp: b.timestamp,
          status: b.status ?? "new",
        }).onConflictDoNothing();
      } catch (e: any) {
        console.error(`  Failed to insert bug report: ${e.message}`);
      }
    }
    console.log(`  Done: ${bugReports.length} bug reports`);
  }

  if (aiLogs.length) {
    console.log("Migrating AI logs...");
    for (const l of aiLogs) {
      try {
        await db.insert(aiLogsTable).values({
          id: l.id,
          userId: l.userId,
          username: l.username,
          timestamp: l.timestamp,
          userMessage: l.userMessage,
          aiResponse: l.aiResponse ?? null,
          responseLength: l.responseLength,
          hadWorkout: l.hadWorkout ?? false,
          hadPlan: l.hadPlan ?? false,
          responseTimeMs: l.responseTimeMs,
          promptVariantId: l.promptVariantId,
          promptVariantName: l.promptVariantName,
          rating: l.rating ?? null,
          notes: l.notes ?? null,
          isError: l.isError ?? null,
          errorMessage: l.errorMessage ?? null,
        }).onConflictDoNothing();
      } catch (e: any) {
        console.error(`  Failed to insert AI log: ${e.message}`);
      }
    }
    console.log(`  Done: ${aiLogs.length} AI logs`);
  }

  if (promptVariants.length) {
    console.log("Migrating prompt variants...");
    for (const v of promptVariants) {
      try {
        await db.insert(promptVariantsTable).values({
          id: v.id,
          name: v.name,
          instructions: v.instructions ?? "",
          weight: v.weight ?? 1,
          isActive: v.isActive ?? true,
          createdAt: v.createdAt,
        }).onConflictDoNothing();
      } catch (e: any) {
        console.error(`  Failed to insert prompt variant ${v.name}: ${e.message}`);
      }
    }
    console.log(`  Done: ${promptVariants.length} prompt variants`);
  }

  if (errorLogs.length) {
    console.log("Migrating error logs...");
    for (const e of errorLogs) {
      try {
        await db.insert(errorLogsTable).values({
          id: e.id,
          source: e.source,
          userId: e.userId,
          username: e.username,
          timestamp: e.timestamp,
          errorMessage: e.errorMessage,
          context: e.context ?? null,
          status: e.status ?? "new",
        }).onConflictDoNothing();
      } catch (err: any) {
        console.error(`  Failed to insert error log: ${err.message}`);
      }
    }
    console.log(`  Done: ${errorLogs.length} error logs`);
  }

  console.log("\nMigration complete! JSON files were NOT deleted (kept as backup).");
  await pool.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
