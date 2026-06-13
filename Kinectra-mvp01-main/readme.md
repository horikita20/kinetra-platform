# KINETRA

Real-time computer vision sports biomechanics analysis platform for cricket technique coaching via webcam.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/kinetra run dev` — run the frontend (port 24564)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + Framer Motion + Wouter
- Pose detection: @mediapipe/tasks-vision (runs in browser via WebAssembly)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `frontend/src/pages/` — 4 app pages (home, setup, analysis, results)
- `frontend/src/hooks/use-kinetra-analysis.ts` — MediaPipe pose detection + angle calculation
- `frontend/src/contexts/SessionContext.tsx` — session state shared between setup→analysis
- `backend/src/routes/session.ts` — session CRUD + recommendation engine
- `lib/db/src/schema/sessions.ts` — DB schema for analysis sessions
- `lib/api-spec/openapi.yaml` — API contract (source of truth)

## Architecture decisions

- MediaPipe pose detection runs entirely in the browser (WebAssembly) — no video frames sent to server, sub-200ms latency
- Session metadata and final scores are persisted to PostgreSQL via Express API
- All biomechanical angles calculated from real MediaPipe landmark coordinates using vector math — no fake/random scores
- Bowling vs batting analysis modes use different angle thresholds and warning rules
- Scoring formula: overall = posture×0.30 + alignment×0.25 + stability×0.25 + efficiency×0.20

## Product

KINETRA analyzes cricket technique through a webcam using MediaPipe Pose Estimation. Athletes choose bowling or batting analysis, then KINETRA tracks 13 body landmarks in real time, calculates elbow/knee/shoulder/spine angles, scores technique, and shows live warnings when form breaks down. Sessions end with a summary of strengths, improvements, and personalized recommendations.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After schema changes, run `pnpm run typecheck:libs` before checking artifact packages
- MediaPipe WASM files loaded from CDN (cdn.jsdelivr.net) — requires network access during first load
- Model loaded from Google Cloud Storage — first analysis session requires network access to download the model

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
