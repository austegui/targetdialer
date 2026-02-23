# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Every team meeting is automatically captured, transcribed, and summarized — so nothing falls through the cracks and the team can search across all past conversations.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 2 of 4 in current phase
Status: In progress — awaiting checkpoint approval
Last activity: 2026-02-23 — Completed Task 1 of 01-02-PLAN.md (Auth.js v5 + OAuth); at checkpoint

Progress: [█░░░░░░░░░] 5% (1/20 plans complete; 01-02 in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 12 min
- Total execution time: 12 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1 | 12 min | 12 min |

**Recent Trend:**
- Last 5 plans: 01-01 (12 min)
- Trend: Baseline set

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Build on Vexa (not from scratch) — focus effort on calendar watcher, transcript ownership, AI summaries, search, analytics
- [Pre-Phase 1]: Two-service architecture — Next.js 16 (dashboard + API routes) + Python FastAPI (Vexa integration + AI Worker)
- [Pre-Phase 1]: AI provider-agnostic via Vercel AI SDK v6 — single env var swap, no code changes
- [Pre-Phase 1]: PostgreSQL FTS with GIN indexes sufficient at 5-20 user scale — no Elasticsearch needed
- [Pre-Phase 1]: Analytics deferred to Phase 4 — requires validated diarization data from real meetings
- [01-01]: Next.js resolved to 15.5.12 LTS (not 16) — pnpm honored ^15.1.0 range; 15.5 is the documented fallback for Auth.js v5 peer dep conflict with Next.js 16
- [01-01]: pnpm v10 --strict-peer-dependencies=false replaces npm's --legacy-peer-deps — update Dockerfiles and CI scripts accordingly
- [01-01]: Drizzle ORM (TypeScript) is schema source of truth; Python SQLAlchemy models are reference-only stubs
- [01-01]: Docker Desktop WSL integration not active — schema validation done with PGLite (WASM postgres); Docker must be enabled before docker compose up
- [01-02]: proxy.ts (Next.js 16 pattern) co-exists with middleware.ts (Next.js 15.5 active middleware) — middleware.ts does the actual route protection; proxy.ts kept for forward-compatibility documentation

### Pending Todos

- Enable Docker Desktop WSL integration before running `docker compose up` (see 01-01 SUMMARY User Setup)
- Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (required for OAuth flow to work)
- Run `pnpm db:push` after Docker is up to create Auth.js tables in database
- Approve checkpoint for 01-02 once OAuth sign-in is verified working

### Blockers/Concerns

- [Phase 1 — RESOLVED]: Auth.js v5 + Next.js 16 peer dependency conflict — using Next.js 15.5 LTS as documented fallback
- [Phase 1 — ACTIVE]: Docker Desktop WSL integration not active — `docker compose up` cannot run until enabled in Docker Desktop Settings > Resources > WSL Integration
- [Phase 1 — ACTIVE]: 01-02 checkpoint pending — OAuth flow cannot be verified without Docker + Google credentials configured
- [Phase 1]: Vexa meeting-end event mechanism unconfirmed — need to verify whether Vexa emits a webhook/callback or requires polling for meeting status changes before implementing the AI Worker trigger
- [Phase 1]: Vexa diarization API contract (exact format of speaker labels in transcript output) not confirmed from docs — must verify during Phase 1 before building any speaker-dependent UI

## Session Continuity

Last session: 2026-02-23T21:07:54Z
Stopped at: 01-02 Task 1 complete (commit 64334a3); at checkpoint:human-verify — awaiting Google OAuth flow verification
Resume file: None
