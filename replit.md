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
- View recent Garmin activities
- Dark/light theme toggle

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
- `PATCH /api/auth/profile` - Update profile (sports, goals)
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
- `DEEPSEEK_API_KEY` - DeepSeek API key (secret)
- `SESSION_SECRET` - Express session secret (secret)

## Sports Supported
- Running (primary)
- Cycling
- Swimming
- Ironman preparation (triathlon)

## Date
Last updated: February 7, 2026
