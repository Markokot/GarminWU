# GarminCoach AI

## Overview
AI-powered training coach web application with Garmin Connect and Intervals.icu integration. Users describe workouts in natural language, AI (DeepSeek) generates structured workouts, and they can be pushed directly to Garmin watches or via Intervals.icu to Zwift, Polar, Suunto, COROS, Huawei.

## Architecture
- **Frontend**: React + Vite + shadcn/ui + TanStack Query + wouter routing
- **Backend**: Express.js with session-based auth
- **AI**: DeepSeek API (OpenAI-compatible) for workout generation
- **Garmin**: @gooin/garmin-connect npm package for Garmin Connect integration
- **Intervals.icu**: REST API integration for Zwift/Polar/Suunto/COROS/Huawei (experimental)
- **Storage**: File-based JSON persistence (no database)
- **Security**: AES-256-GCM encryption for Garmin passwords and Intervals.icu API keys

## Key Features
- User registration/login with session auth
- Garmin Connect account linking (email/password)
- Intervals.icu integration (experimental) — for Zwift, Polar, Suunto, COROS, Huawei users
- AI coach chat - describe workouts in natural language
- Structured workout generation (running, cycling, swimming)
- Push workouts to Garmin Connect / watches OR Intervals.icu (→ Zwift)
- Favorites system — explicitly save workouts from AI chat for quick re-push
- Training plan generation — multi-week plans (up to 12 weeks) with bulk push to devices
- Automatic workout scheduling to Garmin calendar (date extracted from conversation)
- View recent Garmin activities with city/location names (GPS reverse geocoding via Nominatim)
- Weather-aware AI coach — analyzes forecast for user's training city, recommends clothing/gear
- Dark/light theme toggle
- Expanded athlete profile (fitness level, age, weekly volume, experience, injuries, PRs, preferences, Garmin watch model)
- Garmin watch model in profile — AI adapts swimming workouts for incompatible watches
- AI acts as experienced coach: analyzes Garmin data, gives recommendations, can disagree with unsafe requests
- Onboarding guide — 5-step walkthrough shown on first login (connect Garmin, fill profile, describe workout, push to watch, request plan); "don't show again" checkbox persists to localStorage
- Garmin guide — 4-step visual guide "How to find workout on watch?" accessible from workout cards and training plans

## Training Plan Generation
- User asks for multi-week plan (e.g., "план на 4 недели для полумарафона")
- AI generates all workouts with scheduled dates in a single `training_plan_json` block
- Plans stored in ChatMessage.workoutsJson array
- Max plan duration: 12 weeks (enforced in AI prompt)
- Bulk push: all workouts sent sequentially to Garmin/Intervals.icu
- Bulk save: all workouts saved to favorites at once
- UI groups workouts by week with collapsible view

## Workout Rescheduling
- User asks AI to reschedule a workout (e.g., "перенеси тренировку на завтра")
- AI outputs `reschedule_json` block with workoutId, currentDate, newDate, reason
- Calendar context (scheduled workouts with workoutIds) injected into AI prompt via buildCalendarContext
- Frontend shows ReschedulePreview card with "Перенести" button
- Button calls POST /api/garmin/reschedule-workout or /api/intervals/reschedule-workout
- RescheduleData stored in ChatMessage.rescheduleData for persistence
- Garmin reschedule uses findScheduleIdFromCalendar() to locate the scheduleId (calendarItem.id) and DELETE /workout-service/schedule/{scheduleId} before creating new schedule
- FAQ has section on rescheduling with example prompts
- Garmin guide dialog includes reschedule step (step 4 of 5)

## AI Coach Behavior
- Analyzes last 10 Garmin activities for training load assessment
- Uses full athlete profile (level, age, injuries, PRs) for personalized recommendations
- Uses last 30 messages for conversation continuity
- Follows 80/20 rule (80% easy / 20% intense)
- Will disagree with user on: excessive volume increases, daily intensity, unrealistic goals, ignoring injuries
- Explains reasoning behind workout recommendations

## Garmin Watch Compatibility
- User can specify their Garmin watch model in profile settings
- Watch model list defined in shared/schema.ts (garminWatchModels, garminWatchLabels)
- swimStructuredWatchModels — list of watches that support structured swimming workouts
- nativeRunningPowerWatchModels — list of watches with built-in running power sensor
- If user's watch doesn't support structured swimming, AI prompt instructs to create simple format
- If user's watch lacks native running power, AI uses pace/HR zones instead of power zones
- Coach page shows warning on swimming workouts for incompatible watches
- FAQ has detailed compatibility list

## AI Streaming
- Chat endpoint uses SSE (Server-Sent Events) to stream AI responses
- Prevents 504 Gateway Timeout on long responses (training plans)
- Heartbeat every 15 seconds keeps connection alive
- Client uses XMLHttpRequest for Safari compatibility (ReadableStream not supported in Safari)
- Content-Type: text/plain (not text/event-stream) for Safari XHR compatibility

## Garmin Session Management
- Lazy connection pattern — connects only when data is needed (activities, push, AI chat)
- Sessions are health-checked before operations (getUserProfile ping)
- Auto-reconnect from cached credentials on expired sessions
- Retry logic on push/fetch failures with automatic reconnection

## Intervals.icu Integration (Experimental)
- User provides Athlete ID and API key from Intervals.icu Developer Settings
- API key encrypted with AES-256-GCM before storage
- Workouts pushed as calendar events via POST /api/v1/athlete/{id}/events
- Activities fetched via GET /api/v1/athlete/{id}/activities (last 90 days)
- Supports running (Run), cycling (Ride), swimming (Swim) sport types
- Workout description includes structured step details
- Scheduled date extracted from workout or defaults to tomorrow

## Activities Fetch Logic
- Unified `/api/activities` endpoint with source priority: Garmin (primary) → Intervals.icu (fallback)
- If Garmin connected → fetch from Garmin; if Garmin fails → try Intervals.icu
- If only Intervals.icu connected → fetch from Intervals.icu
- AI coach uses same fallback logic for training load analysis
- Dashboard shows source badge (Garmin / Intervals.icu)
- Per-user push counters (garminPushCount, intervalsPushCount) track successful pushes

## Project Structure
- `client/src/pages/` - Page components (auth, dashboard, coach, workouts, settings)
- `client/src/components/` - Reusable components (app-sidebar, theme-toggle)
- `client/src/lib/` - Auth context, theme provider, query client
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - File-based storage (users, favorites, workouts, chat messages)
- `server/garmin.ts` - Garmin Connect integration (connect, activities, push workouts)
- `server/intervals.ts` - Intervals.icu API integration (connect, activities, push workouts)
- `server/ai.ts` - DeepSeek AI integration for workout generation
- `server/weather.ts` - Weather forecast (Open-Meteo) and reverse geocoding (Nominatim) for city detection
- `server/crypto.ts` - AES-256-GCM encryption for credentials
- `server/tests.ts` - Auto-test runner (AI parsing, dates, encryption, calendar context, live DeepSeek)
- `shared/schema.ts` - Shared TypeScript types and Zod schemas
- `.data/` - JSON data files for persistence

## API Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `PATCH /api/auth/profile` - Update profile (sports, goals, fitness level, age, weekly hours, injuries, PRs, preferences)
- `POST /api/garmin/connect` - Connect Garmin account
- `POST /api/garmin/disconnect` - Disconnect Garmin
- `GET /api/garmin/activities` - Get recent Garmin activities
- `POST /api/garmin/push-workout` - Push workout to Garmin Connect
- `POST /api/intervals/connect` - Connect Intervals.icu account (athlete ID + API key)
- `POST /api/intervals/disconnect` - Disconnect Intervals.icu
- `POST /api/intervals/push-workout` - Push workout to Intervals.icu calendar
- `GET /api/favorites` - List user's favorite workouts
- `POST /api/favorites` - Save workout to favorites
- `DELETE /api/favorites/:id` - Remove from favorites
- `GET /api/workouts` - List user workouts (legacy)
- `POST /api/workouts` - Save workout (legacy)
- `DELETE /api/workouts/:id` - Delete workout (legacy)
- `GET /api/chat/messages` - Get chat history
- `POST /api/chat/send` - Send message to AI coach
- `DELETE /api/chat/messages` - Clear chat history
- `POST /api/admin/run-tests` - Run auto-tests (admin only)

## Environment Variables
- `DEEPSEEK_API_KEY` - DeepSeek API key (secret, optional — AI features disabled without it)
- `SESSION_SECRET` - Express session secret (secret, required)
- `DATA_DIR` - Path to JSON data directory (default: `.data/` in dev, `/home/Garmin/data` on server)
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - `development` or `production`

## Deployment (External VPS)
- `deploy.sh` - Deployment script (git pull, build, systemd restart)
- `GarminCoach.service` - Systemd unit file (EnvironmentFile=/home/Garmin/.env)
- `.env.example` - Template for required env vars
- Secrets stored in `/home/Garmin/.env` (not in git)
- User data stored in `/home/Garmin/data/` (not in git)
- Startup validates required env vars, exits with clear error if missing

## Sports Supported
- Running (primary)
- Cycling
- Swimming
- Ironman preparation (triathlon)

## Date
Last updated: February 20, 2026
