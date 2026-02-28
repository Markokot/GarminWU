# GarminCoach AI

## Overview
GarminCoach AI — AI-powered web application acting as a personal training coach. Integrates with Garmin Connect and Intervals.icu to generate and push structured workouts and multi-week training plans directly to Garmin watches or other platforms (Zwift, Polar, Suunto, COROS, Huawei via Intervals.icu). All UI is in Russian. AI coach persona is an "experienced triathlon coach" that analyzes activity data, profile, weather, and readiness to provide personalized recommendations.

## User Preferences
- Admin username: "Andrey" (hardcoded in server/routes.ts line ~1160 as `ADMIN_USERNAME`), password: "1232"
- Admin-only pages: /admin, /test-workouts, /auto-tests, /bug-reports, /ai-logs, /prompt-variants, /debug-logs
- App language: Russian throughout (all UI text, AI responses, error messages)
- The user deploys to external VPS via deploy.sh (NOT via Replit deployment)
- Current version: **1.010** — defined in `client/src/pages/version-page.tsx` as `CURRENT_VERSION`

## Tech Stack
- **Frontend**: React 18 + Vite + shadcn/ui + Tailwind CSS v4 + TanStack Query v5 + wouter (routing) + framer-motion
- **Backend**: Express.js v5 + TypeScript (tsx)
- **Database**: PostgreSQL with Drizzle ORM (`STORAGE_MODE=pg`)
- **AI**: DeepSeek API (model "deepseek-chat") via OpenAI SDK
- **Garmin**: `@gooin/garmin-connect` npm package (unofficial)
- **Intervals.icu**: REST API integration
- **Encryption**: AES-256-GCM for Garmin passwords and Intervals API keys (`server/crypto.ts`)
- **Password hashing**: bcryptjs

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `STORAGE_MODE` | `pg` for PostgreSQL (default: `json`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session secret + AES encryption key |
| `DEEPSEEK_API_KEY` | DeepSeek AI API key |
| `PORT` | Server port (default: 5000) |

## System Architecture

### File Structure (by importance and size)

**Server (server/):**
| File | Lines | Purpose |
|------|-------|---------|
| `routes.ts` | ~1515 | ALL Express API endpoints (auth, workouts, Garmin, Intervals, AI chat, admin) |
| `garmin.ts` | ~764 | Garmin Connect session management, workout CRUD, calendar, health stats, in-memory caching |
| `ai.ts` | ~679 | DeepSeek AI chat/stream, prompt construction, structured workout parsing from AI output |
| `pg-storage.ts` | ~647 | PostgresStorage class — Drizzle ORM implementation of IStorage |
| `storage.ts` | ~479 | IStorage interface + FileStorage (JSON mode fallback) |
| `tests.ts` | ~401 | Automated test scenarios for workout generation |
| `intervals.ts` | ~386 | Intervals.icu API integration (activities, calendar, workout push/reschedule) |
| `readiness.ts` | ~378 | Training readiness calculation algorithm |
| `weather.ts` | ~264 | Open-Meteo weather forecast + Nominatim geocoding |
| `index.ts` | ~117 | Express server bootstrap |
| `debug-log.ts` | ~35 | In-memory debug logging (max 500 entries) |
| `crypto.ts` | ~33 | AES-256-GCM encrypt/decrypt |
| `vite.ts` | ~58 | Vite dev server setup (DO NOT MODIFY) |

**Client (client/src/):**
| File | Lines | Purpose |
|------|-------|---------|
| `pages/coach-page.tsx` | ~1044 | AI chat interface — main feature page, workout generation with SSE streaming |
| `pages/dashboard-page.tsx` | ~792 | Main dashboard with onboarding steps, upcoming workouts, activity history |
| `pages/faq-page.tsx` | ~613 | FAQ page with accordion sections |
| `pages/settings-page.tsx` | ~571 | User profile, Garmin/Intervals connection, watch model selection |
| `pages/admin-page.tsx` | ~562 | Admin statistics dashboard |
| `components/readiness-card.tsx` | ~341 | Readiness score display with expandable factors |
| `components/app-sidebar.tsx` | ~270 | Sidebar navigation with admin section |
| `pages/auth-page.tsx` | ~238 | Login/register page |
| `lib/auth.tsx` | ~67 | Auth context provider, useUser/useAuth hooks |
| `lib/queryClient.ts` | ~57 | TanStack Query client config, apiRequest helper |
| `lib/theme-provider.tsx` | ~43 | Dark/light theme provider |

**Shared:**
| File | Lines | Purpose |
|------|-------|---------|
| `shared/schema.ts` | ~540 | ALL TypeScript interfaces, Drizzle table definitions, Zod validation schemas |

### Database Tables (PostgreSQL, Drizzle ORM)
All defined in `shared/schema.ts`:

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| `users` | `varchar` (UUID) | User accounts with profile, settings, encrypted credentials |
| `workouts` | `varchar` (UUID) | Generated workouts with structured steps |
| `favorites` | `varchar` (UUID) | Saved favorite workouts |
| `messages` | `varchar` (UUID) | AI chat message history |
| `bug_reports` | `varchar` (UUID) | User bug reports |
| `ai_logs` | `varchar` (UUID) | AI request/response logs for analysis |
| `prompt_variants` | `varchar` (UUID) | A/B testing prompt variants |
| `error_logs` | `varchar` (UUID) | System error logs |
| `cached_activities` | `varchar` (composite) | Cached Garmin/Intervals activities (`activityId` is `bigint`) |
| `cached_health_stats` | `varchar` (userId-date) | Cached daily health data (stress, body battery, steps), 6h TTL |

### Frontend Routes
| Path | Component | Access |
|------|-----------|--------|
| `/` | DashboardPage | All users |
| `/coach` | CoachPage | All users |
| `/favorites` | FavoritesPage | All users |
| `/settings` | SettingsPage | All users |
| `/faq` | FaqPage | All users |
| `/version` | VersionPage | All users |
| `/admin` | AdminPage | Admin only |
| `/test-workouts` | TestWorkoutsPage | Admin only |
| `/auto-tests` | AutoTestsPage | Admin only |
| `/bug-reports` | BugReportsPage | Admin only |
| `/ai-logs` | AiLogsPage | Admin only |
| `/prompt-variants` | PromptVariantsPage | Admin only |
| `/debug-logs` | DebugLogsPage | Admin only |

### API Endpoints Summary
**Auth:** POST `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`; GET `/api/auth/me`; PATCH `/api/auth/profile`; POST `/api/auth/onboarding-shown`

**Garmin:** POST `/api/garmin/connect`, `/api/garmin/disconnect`, `/api/garmin/push-workout`, `/api/garmin/reschedule-workout`; GET `/api/garmin/activities`, `/api/garmin/calendar`; DELETE `/api/garmin/workout/:workoutId`

**Intervals.icu:** POST `/api/intervals/connect`, `/api/intervals/disconnect`, `/api/intervals/push-workout`, `/api/intervals/reschedule-workout`

**Activities & Readiness:** GET `/api/activities`, `/api/readiness`, `/api/upcoming-workouts`; POST `/api/refresh-data`

**Workouts & Favorites:** GET/POST `/api/workouts`; DELETE `/api/workouts/:id`; GET/POST `/api/favorites`; DELETE `/api/favorites/:id`

**AI Chat:** GET `/api/chat/messages`; POST `/api/chat/send` (SSE streaming); DELETE `/api/chat/messages`

**Admin:** GET `/api/admin/stats`, `/api/admin/users/:userId/profile`, `/api/admin/users/:userId/messages`, `/api/admin/bug-reports`, `/api/admin/error-logs`, `/api/admin/debug-logs`, `/api/admin/ai-logs`, `/api/admin/prompt-variants`, `/api/admin/prompt-variants/metrics`; POST `/api/admin/prompt-variants`, `/api/admin/run-tests`; PATCH/DELETE endpoints for all admin resources

## Critical Implementation Details

### Garmin API — RATE LIMITING IS THE #1 PRIORITY
Garmin aggressively blocks accounts for too many API calls. The entire caching architecture exists to minimize calls.

**Three-layer caching:**
1. **In-memory cache** (5-min TTL) in `server/garmin.ts` — for activities, calendar data. Session alive check skipped if session used within last 10 minutes
2. **PostgreSQL `cached_activities`** table — progressive delta-sync: fetches in steps [3, 10, 30, 50], stops when overlap with cached IDs found. 4-hour cooldown between syncs (tracked in-memory via `lastSyncTimes` Map in routes.ts)
3. **PostgreSQL `cached_health_stats`** table — health data (stress, body battery, steps) cached per user per date, 6-hour TTL. Checked before any Garmin health API call

**Manual refresh** (button "Обновить"): clears ALL caches (in-memory + DB activities + DB health + cooldown timer). User warned about rate limiting via confirmation dialog.

**API failure fallback**: if Garmin API fails but DB cache exists, cached data is served.

### Readiness Score Algorithm (server/readiness.ts)
Dynamic weight system:
- **4 training factors** (20pts each = 80pts base): load, recovery time, intensity, consistency
- **Up to 3 health factors** (15pts each from Garmin): stress level, body battery, steps
- Score normalized 0-100: `round(totalRawScore / totalMaxRaw × 100)`
- If health data unavailable, factors silently omitted; score based on training factors only
- Health data: stress + body battery from single endpoint `wellness-service/wellness/dailyStress/{date}` (BB in `bodyBatteryValuesArray`); steps via `getSteps()` method

### AI Chat (server/ai.ts + pages/coach-page.tsx)
- Uses DeepSeek API with OpenAI SDK (baseURL override)
- SSE streaming for real-time response
- AI context includes: user profile (sport type, fitness level, zones), recent activities (last 30 days), readiness score with health factors, weather forecast, Garmin watch model capabilities
- AI parses structured workouts from natural language, generates Garmin-compatible `WorkoutStep[]`
- Prompt variants system for A/B testing different AI prompts
- Chat history stored in `messages` table

### Garmin Workout Format
Workouts have structured `WorkoutStep[]` with: stepType (warmup/interval/recovery/rest/cooldown/repeat), durationType (time/distance/lap.button), targetType (pace.zone/heart.rate.zone/power.zone/cadence/no.target), target values. Steps are nested for repeat blocks.

### Garmin Reschedule Workflow
1. Find `scheduleId` via calendar API (NOT the workoutId — it's the calendar item ID)
2. DELETE old schedule
3. POST new schedule with `scheduleWorkout()`

### Date Formatting
**NEVER** use `toISOString().split("T")[0]` for dates — converts to UTC, shifts by -1 day in UTC+3 (Moscow). Always use `getFullYear()`/`getMonth()`/`getDate()` for local date formatting.

### Credential Encryption
Garmin passwords and Intervals.icu API keys encrypted with AES-256-GCM using `SESSION_SECRET` as key. Functions: `encrypt(text)` / `decrypt(encrypted)` in `server/crypto.ts`.

### Debug Logging
- `debugLog(category, message, data?)` — in-memory, max 500 entries, cleared on restart
- Categories used: "Health API", "Health Data", "AI Context", "AI Chat", "Garmin", "Activities", etc.
- Viewable at `/debug-logs` (admin only), auto-refresh 5s

### Storage Architecture
- `IStorage` interface in `server/storage.ts` — all CRUD methods
- `FileStorage` (JSON mode) and `PostgresStorage` (PG mode) both implement it
- Switched by `STORAGE_MODE` env var
- `PostgresStorage` auto-creates base prompt variant on startup
- Migration script: `npx tsx scripts/migrate-json-to-pg.ts`

## Known Issues & Lessons Learned
- **`activityId` in `cached_activities` must be `bigint`** — Garmin activity IDs exceed PostgreSQL `integer` max (>2^31)
- **Date formatting**: see Date Formatting section above
- **Garmin session**: unofficial `@gooin/garmin-connect` library — sessions can expire unpredictably. Code handles re-login gracefully.
- **AI date inconsistency**: AI prompt includes explicit rule requiring verification of relative day references ("завтра"/"послезавтра") throughout entire response including `explanation.why` field

## VPS Deployment
- deploy.sh located on VPS at `/root/GarminWU/deploy.sh` (not in git repo)
- Includes `npm install --include=dev` for build tools
- Automatically runs `npm run db:push` to sync DB schema
- Loads env vars from `/home/Garmin/.env`
- Build: `npm run build` → production: `npm run start`

## Versioning
- Version in `client/src/pages/version-page.tsx` as `CURRENT_VERSION` (currently "1.010")
- `ChangelogEntry` interface: `{ version, date, changes: { category, items }[] }`
- Increment: +0.001 small, +0.010 medium, +0.100 major features
- Version page at `/version` accessible to all users

## NPM Scripts
- `npm run dev` — development (tsx, hot reload)
- `npm run build` — production build (esbuild)
- `npm run start` — production server
- `npm run db:push` — sync Drizzle schema to PostgreSQL
- `npm run check` — TypeScript type check

## DO NOT MODIFY
- `server/vite.ts` and `vite.config.ts` — Vite setup, already configured
- `drizzle.config.ts` — Drizzle config
- `package.json` — ask user before modifying scripts
