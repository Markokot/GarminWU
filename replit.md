# GarminCoach AI

## Overview
GarminCoach AI is an AI-powered web application designed to act as a personal training coach. It integrates with Garmin Connect and Intervals.icu to allow users to generate and push structured workouts and multi-week training plans directly to their Garmin watches or other platforms like Zwift, Polar, Suunto, COROS, and Huawei via Intervals.icu. The core purpose is to provide personalized, AI-generated training guidance based on natural language input, aiming to enhance athletic performance and prevent overtraining.

## User Preferences
- Admin username: "Andrey" (hardcoded in server/routes.ts as ADMIN_USERNAME)
- Admin-only pages: /admin (statistics), /test-workouts (push tests), /auto-tests (automated tests), /bug-reports (bug reports), /ai-logs (AI request logs), /prompt-variants (A/B prompt testing), /debug-logs (in-memory debug logs)
- App language: Russian throughout
- The user deploys to external VPS via deploy.sh, NOT via Replit deployment

## System Architecture
The application features a modern web stack with React 18, Vite, shadcn/ui, and TanStack Query v5 for the frontend, and an Express.js v5 backend. UI styling is managed with Tailwind CSS v4, supporting both dark and light themes. All UI text is localized in Russian. AI capabilities are powered by DeepSeek API, generating structured workouts for running, cycling, and swimming, and multi-week training plans. Garmin Connect integration uses the `@gooin/garmin-connect` npm package, while Intervals.icu integration is achieved via its REST API. Sensitive information like Garmin passwords and Intervals.icu API keys are encrypted using AES-256-GCM. The AI coach persona is an "experienced triathlon coach" that analyzes user activity data, profile information, and weather forecasts to provide personalized and safe recommendations, adhering to principles like the 80/20 rule and disagreeing with unsafe requests. AI responses are streamed via SSE for a smoother user experience, and a robust parsing system extracts structured workout data from natural language outputs. Garmin watch compatibility is dynamically handled, adapting workout recommendations based on the user's specific watch model.

### Key Files
- **shared/schema.ts** — All TypeScript interfaces, Drizzle table definitions, and Zod validation schemas
- **server/routes.ts** — All Express API endpoints (auth, workouts, Garmin, Intervals, AI, admin)
- **server/storage.ts** — IStorage interface + FileStorage (JSON mode)
- **server/pg-storage.ts** — PostgresStorage (PG mode, Drizzle ORM)
- **server/garmin.ts** — Garmin Connect session management, workout push/schedule/reschedule/delete, calendar fetch, caching
- **server/intervals.ts** — Intervals.icu API integration (activities, calendar, workout push/reschedule)
- **server/ai.ts** — DeepSeek AI chat/stream, prompt construction, response parsing
- **server/debug-log.ts** — In-memory debug logging system (up to 500 entries, cleared on restart or via API)
- **server/crypto.ts** — AES-256-GCM encryption/decryption for credentials
- **client/src/App.tsx** — Frontend routing and layout
- **client/src/components/app-sidebar.tsx** — Sidebar navigation with admin section
- **client/src/pages/dashboard-page.tsx** — Main dashboard with onboarding and upcoming workouts
- **client/src/pages/coach-page.tsx** — AI chat interface with workout generation
- **client/src/pages/settings-page.tsx** — User profile, Garmin/Intervals connection settings
- **client/src/pages/debug-logs-page.tsx** — Admin debug logs viewer with clear button

### Storage
- **Switchable storage**: controlled by `STORAGE_MODE` env var (`json` or `pg`, default: `json`)
- **JSON mode**: FileStorage class in server/storage.ts — uses .data/*.json files (original approach)
- **PostgreSQL mode**: PostgresStorage class in server/pg-storage.ts — uses Drizzle ORM with pg driver
- Both implement the same `IStorage` interface — no changes needed in routes or other code
- Drizzle table definitions are in shared/schema.ts alongside existing TypeScript interfaces
- Migration script: `npx tsx scripts/migrate-json-to-pg.ts` — reads JSON files, writes to PG, uses onConflictDoNothing (safe to re-run)
- JSON files are never deleted during migration (kept as backup)
- Base prompt variant (id="base") is auto-created in both modes

### Debug Logging System
- **server/debug-log.ts** provides `debugLog(category, message, data?)` function for in-memory logging
- Logs stored in-memory (max 500 entries), auto-cleared on server restart
- API: `GET /api/admin/debug-logs` (fetch), `DELETE /api/admin/debug-logs` (clear all)
- Frontend page at `/debug-logs` with auto-refresh every 5 seconds
- Use `debugLog("Category", "message", optionalData)` anywhere in server code to add entries
- Import: `import { debugLog } from "./debug-log";`

### Dashboard — Upcoming Workouts & Onboarding
- Dashboard (`/`) is the start page with onboarding steps (profile, device, first workout)
- Onboarding block auto-hides when all steps completed; shows progress bar
- Endpoint `/api/upcoming-workouts` fetches planned workouts from Garmin calendar and/or Intervals.icu events for the next 14 days
- Returns `{ workouts: UpcomingWorkout[], sources: { garmin: boolean, intervals: boolean } }`
- `UpcomingWorkout` interface defined in shared/schema.ts (id, source, date, name, sportType, isToday, workoutId)
- Each workout card has "Перенести" button to reschedule via calendar picker dialog
- Reschedule calls `/api/garmin/reschedule-workout` or `/api/intervals/reschedule-workout` depending on source
- Both sources fetched in parallel; errors from one source don't block the other

### Activity Caching (DB-backed, Progressive Fetch + 4h Cooldown)
- Activities are cached in `cached_activities` PostgreSQL table (defined in shared/schema.ts)
- **First load** (empty cache): fetches 50 activities from Garmin/Intervals and saves to DB
- **Subsequent loads** (progressive delta): fetches in steps [3, 10, 30, 50], stops as soon as overlap with cached activityIds is found. Typical case: user trains daily, step=3 finds overlap immediately → only 1 small API call
- **4-hour cooldown**: after a successful sync, no API calls are made for 4 hours — data served entirely from DB cache. Cooldown tracked in-memory via `lastSyncTimes` Map in routes.ts
- **Manual refresh** (button "Обновить"): clears DB cache + Garmin in-memory cache + cooldown timer, triggers full re-fetch
- **Sync status on dashboard**: shows "X мин/ч назад" next to refresh button with tooltip warning about not refreshing too often
- **API failure fallback**: if Garmin/Intervals API fails but cache exists, serves cached data
- **Dashboard logic**: shows activities from last 30 days; if fewer than 10, shows at least 10 latest
- Storage methods: `getCachedActivities`, `getCachedActivityIds`, `saveCachedActivities`, `clearCachedActivities`

### Garmin API Caching (In-Memory)
- Additional server-side cache (5 min TTL) for activities and calendar data in server/garmin.ts
- Session alive check skipped if session used within last 10 minutes (avoids extra getUserProfile calls)
- Cache invalidated after workout reschedule/push operations
- Reduces Garmin API calls from ~6 per dashboard load to ~3 first time, 0 on refresh within 5 min

### VPS Deployment
- deploy.sh located on VPS at /root/GarminWU/deploy.sh (not in git repo)
- Includes `npm install --include=dev` for build tools
- Automatically runs `npm run db:push` to sync DB schema when STORAGE_MODE=pg
- Loads env vars from /home/Garmin/.env before build/migration steps

### Versioning
- Current version: **1.010** — defined in `client/src/pages/version-page.tsx` as `CURRENT_VERSION`
- Version page (`/version`) is accessible to all users, shows full feature list by category
- **For future AI agents**: When adding significant new functionality (new integrations, major features, new pages), propose incrementing the version number and updating the `features` array in `version-page.tsx`. Minor bug fixes don't require version bumps. Increment by 0.001 for small features, 0.010 for medium features, 0.100 for major features.

## Known Issues & Lessons Learned
- **Date formatting on frontend**: NEVER use `toISOString().split("T")[0]` for user-selected dates — it converts to UTC and shifts the date by -1 day in positive timezones (e.g., UTC+3 Moscow). Always use `getFullYear()`, `getMonth()`, `getDate()` for local date formatting.
- **Garmin API rate limiting**: Two-layer caching: 1) in-memory 5-min TTL in garmin.ts, 2) PostgreSQL `cached_activities` table with 4-hour cooldown and progressive delta-sync (3→10→30). Manual refresh clears both caches. `activityId` uses `bigint` (Garmin IDs exceed int32 max).
- **Garmin reschedule workflow**: 1) Find scheduleId via calendar API, 2) DELETE old schedule, 3) POST new schedule with `scheduleWorkout()`. The scheduleId is NOT the workoutId — it's the calendar item id.

## External Dependencies
- **AI Service**: DeepSeek API (model "deepseek-chat")
- **Garmin Integration**: `@gooin/garmin-connect` npm package
- **Intervals.icu Integration**: Intervals.icu REST API
- **Weather and Geocoding**: Open-Meteo API (weather forecast), Nominatim API (GPS reverse geocoding)
- **Hashing**: `bcryptjs` for password hashing
