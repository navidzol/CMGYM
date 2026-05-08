# CMGYM

A workout planner and tracker that generates training sessions based on your available time, equipment, and muscle group distribution. Supports individual and family group training with leaderboards, injury management, and personal record tracking.

## What it does

- Generates weekly workout programmes that distribute six muscle families (upper front/back, core front/back, lower front/back) evenly across your sessions
- Respects your available equipment and injury settings when building workouts
- Tracks sets, reps, weight, and RPE during workouts with a built-in rest timer
- Detects personal records automatically using Epley estimated 1RM
- Family groups let multiple people share a programme, compare on leaderboards, and see each other's activity
- Nine color palettes to choose from in settings
- Installable as a PWA on phones and desktops

## Architecture

Monorepo with four main parts:

```text
apps/web          Next.js frontend (PWA)
apps/mobile       React Native / Expo (placeholder)
services/api      Fastify REST API
services/worker   Background job scheduler
packages/core     Schedule generation algorithm, shared types
```

PostgreSQL for storage, Redis for job queues. Everything runs in Docker Compose for local development.

## Running locally

**Prerequisites:** Docker, Docker Compose, Node 18+

1. Copy the environment file and fill in values:

   ```bash
   cp .env.example .env
   ```

2. Start everything:

   ```bash
   docker compose up -d --build
   ```

3. The API seeds the database schema on first boot. Seed the exercise database:

   ```bash
   curl -X POST http://localhost:3001/v1/exercises/seed \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. Open `http://localhost:3000` to use the app.

## API

All endpoints live under `/v1`. Auth uses JWT tokens in the `Authorization: Bearer` header.

| Area       | Endpoints                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------- |
| Auth       | POST /auth/register, /auth/login, /auth/refresh                                             |
| Users      | GET/PATCH /users/me, GET/PATCH /users/me/settings                                           |
| Equipment  | GET/PUT /users/me/equipment                                                                  |
| Injuries   | GET/POST/DELETE /users/me/injuries                                                           |
| Exercises  | GET /exercises, POST /exercises/fetch-external, POST /exercises/seed                         |
| Pool       | GET/POST/DELETE /pools                                                                       |
| Programmes | GET/POST/DELETE /programmes, POST /programmes/:id/generate                                   |
| Sessions   | GET/POST/PATCH/DELETE /sessions, POST/GET /sessions/:id/sets                                 |
| Custom     | POST /custom-sessions/generate, POST /custom-sessions/start                                  |
| Records    | GET /records                                                                                 |
| Reports    | GET /reports, POST /reports/custom                                                           |
| Families   | POST /families, GET /families/:id, POST /families/:id/join, GET /families/:id/leaderboard    |

## Tests

```bash
npm test          # run all tests
npm run test:api  # API integration tests only
npm run test:e2e  # end-to-end workflow test
```

Tests require the Docker services to be running. A pre-push git hook runs the test suite before pushing.

## Schedule generation

The algorithm in `packages/core/src/schedule.ts` works like this:

1. Distributes six muscle families across the configured number of sessions per week
2. For each session, allocates a time budget per family based on session duration minus cardio time
3. Fills the time budget with exercises from the user's pool, respecting equipment availability and injury settings
4. Exercises targeting an injured region marked "avoid" are excluded; those marked "warn" are included but flagged
5. Adds a cardio exercise at the end if configured

## Installing on your phone

This is a Progressive Web App. On Android, open the URL in Chrome and tap "Add to Home Screen" from the menu. On iOS, open in Safari, tap the Share button, then "Add to Home Screen."

## Credits and attribution

Exercise data is provided by [ExerciseDB](https://exercisedb.io), powered by [AscendAPI](https://ascendapi.com). Credit to AscendAPI is required when using the ExerciseDB dataset.

## License

MIT License. See [LICENSE](LICENSE) for details.
