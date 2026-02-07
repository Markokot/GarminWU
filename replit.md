# GarminCoach AI

## Overview
AI-powered training coach web application with Garmin Connect integration. Users describe workouts in natural language, AI (DeepSeek) generates structured workouts, and they can be pushed directly to Garmin watches.

## Architecture
- **Frontend**: React + Vite + shadcn/ui + TanStack Query + wouter routing
- **Backend**: Express.js with session-based auth
- **AI**: DeepSeek API (OpenAI-compatible) for workout generation
- **Garmin**: @gooin/garmin-connect npm package for Garmin Connect integration
- **Storage**: File-based JSON persistence (no database)

## Key Features
- User registration/login with session auth
- Garmin Connect account linking (email/password)
- AI coach chat - describe workouts in natural language
- Structured workout generation (running, cycling, swimming)
- Push workouts directly to Garmin Connect / watches
- Automatic workout scheduling to Garmin calendar (date extracted from conversation)
- View recent Garmin activities
- Dark/light theme toggle
- Expanded athlete profile (fitness level, age, weekly volume, experience, injuries, PRs, preferences)
- AI acts as experienced coach: analyzes Garmin data, gives recommendations, can disagree with unsafe requests

## AI Coach Behavior
- Analyzes last 10 Garmin activities for training load assessment
- Uses full athlete profile (level, age, injuries, PRs) for personalized recommendations
- Follows 80/20 rule (80% easy / 20% intense)
- Will disagree with user on: excessive volume increases, daily intensity, unrealistic goals, ignoring injuries
- Explains reasoning behind workout recommendations

## Garmin Session Management
- Sessions are health-checked before operations (getUserProfile ping)
- Auto-reconnect from cached credentials on expired sessions
- Retry logic on push/fetch failures with automatic reconnection

## Project Structure
- `client/src/pages/` - Page components (auth, dashboard, coach, workouts, settings)
- `client/src/components/` - Reusable components (app-sidebar, theme-toggle)
- `client/src/lib/` - Auth context, theme provider, query client
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - File-based storage (users, workouts, chat messages)
- `server/garmin.ts` - Garmin Connect integration (connect, activities, push workouts)
- `server/ai.ts` - DeepSeek AI integration for workout generation
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
- `GET /api/workouts` - List user workouts
- `POST /api/workouts` - Save workout
- `DELETE /api/workouts/:id` - Delete workout
- `GET /api/chat/messages` - Get chat history
- `POST /api/chat/send` - Send message to AI coach
- `DELETE /api/chat/messages` - Clear chat history

## Environment Variables
- `DEEPSEEK_API_KEY` - DeepSeek API key (secret, required)
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
Last updated: February 7, 2026
