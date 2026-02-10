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
- Automatic workout scheduling to Garmin calendar (date extracted from conversation)
- View recent Garmin activities
- Dark/light theme toggle
- Expanded athlete profile (fitness level, age, weekly volume, experience, injuries, PRs, preferences)
- AI acts as experienced coach: analyzes Garmin data, gives recommendations, can disagree with unsafe requests

## AI Coach Behavior
- Analyzes last 10 Garmin activities for training load assessment
- Uses full athlete profile (level, age, injuries, PRs) for personalized recommendations
- Uses last 30 messages for conversation continuity
- Follows 80/20 rule (80% easy / 20% intense)
- Will disagree with user on: excessive volume increases, daily intensity, unrealistic goals, ignoring injuries
- Explains reasoning behind workout recommendations

## Garmin Session Management
- Lazy connection pattern — connects only when data is needed (activities, push, AI chat)
- Sessions are health-checked before operations (getUserProfile ping)
- Auto-reconnect from cached credentials on expired sessions
- Retry logic on push/fetch failures with automatic reconnection

## Intervals.icu Integration (Experimental)
- User provides Athlete ID and API key from Intervals.icu Developer Settings
- API key encrypted with AES-256-GCM before storage
- Workouts pushed as calendar events via POST /api/v1/athlete/{id}/events
- Supports running (Run), cycling (Ride), swimming (Swim) sport types
- Workout description includes structured step details
- Scheduled date extracted from workout or defaults to tomorrow

## Project Structure
- `client/src/pages/` - Page components (auth, dashboard, coach, workouts, settings)
- `client/src/components/` - Reusable components (app-sidebar, theme-toggle)
- `client/src/lib/` - Auth context, theme provider, query client
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - File-based storage (users, workouts, chat messages)
- `server/garmin.ts` - Garmin Connect integration (connect, activities, push workouts)
- `server/intervals.ts` - Intervals.icu API integration (connect, push workouts)
- `server/ai.ts` - DeepSeek AI integration for workout generation
- `server/crypto.ts` - AES-256-GCM encryption for credentials
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
- `GET /api/workouts` - List user workouts
- `POST /api/workouts` - Save workout
- `DELETE /api/workouts/:id` - Delete workout
- `GET /api/chat/messages` - Get chat history
- `POST /api/chat/send` - Send message to AI coach
- `DELETE /api/chat/messages` - Clear chat history

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
Last updated: February 10, 2026
