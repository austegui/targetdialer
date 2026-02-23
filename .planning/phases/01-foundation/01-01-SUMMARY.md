---
phase: 01-foundation
plan: "01"
subsystem: infra
tags: [next.js, fastapi, drizzle, postgresql, docker, asyncpg, pglite, typescript, python]

# Dependency graph
requires: []
provides:
  - Two-service monorepo scaffold (apps/web Next.js 15.5, apps/api Python FastAPI)
  - docker-compose.yml with postgres/redis/web/api services and healthchecks
  - Drizzle schema with all 4 TD extension tables and GIN FTS index
  - FastAPI /health endpoint with asyncpg DB connectivity
  - Placeholder Next.js app (tsc clean, page renders)
  - .env.example with all required environment variables documented
affects:
  - "01-02-auth: needs td_users table and schema module path"
  - "01-03-calendar: needs td_calendar_subscriptions table"
  - "01-04-vexa: needs td_meetings and td_transcript_segments tables, FastAPI service"
  - "all future plans: all depend on monorepo structure established here"

# Tech tracking
tech-stack:
  added:
    - "next@15.5.12 (App Router, turbopack dev)"
    - "drizzle-orm@0.38.4 + drizzle-kit@0.30.6"
    - "postgres@3.4.8 (postgres.js driver)"
    - "zod@3.25.76"
    - "fastapi@0.132.0"
    - "asyncpg@0.31.0"
    - "uvicorn@0.41.0"
    - "arq@0.27.0"
    - "cryptography@46.0.5"
    - "@electric-sql/pglite@0.3.15 (local schema validation)"
  patterns:
    - "Drizzle GIN index: index().using('gin', sql`to_tsvector(...)`) — must be created before first data insert"
    - "Drizzle client singleton with globalThis to prevent duplicate connections in Next.js hot reload"
    - "FastAPI lifespan pattern for asyncpg pool creation/cleanup"
    - "All services on shared 'meetrec' Docker network with healthcheck-based depends_on"
    - "pnpm --strict-peer-dependencies=false for Next.js ecosystem peer dep conflicts"

key-files:
  created:
    - "docker-compose.yml"
    - ".env.example"
    - ".gitignore"
    - "apps/web/package.json"
    - "apps/web/tsconfig.json"
    - "apps/web/next.config.ts"
    - "apps/web/Dockerfile"
    - "apps/web/drizzle.config.ts"
    - "apps/web/src/lib/db/schema.ts"
    - "apps/web/src/lib/db/index.ts"
    - "apps/web/src/app/layout.tsx"
    - "apps/web/src/app/page.tsx"
    - "apps/api/pyproject.toml"
    - "apps/api/Dockerfile"
    - "apps/api/src/__init__.py"
    - "apps/api/src/main.py"
    - "apps/api/src/db/__init__.py"
    - "apps/api/src/db/session.py"
    - "apps/api/src/db/models.py"
  modified: []

key-decisions:
  - "Used Next.js 15.5.12 (LTS) instead of 16.x — pnpm resolved ^15.1.0 to 15.5.12; this is the documented fallback from research since Auth.js v5 peer dep conflict affects v16"
  - "Used pnpm with --strict-peer-dependencies=false instead of --legacy-peer-deps (pnpm v10 flag name change)"
  - "Fixed pyproject.toml: changed tool.uv.dev-dependencies to [dependency-groups] dev (uv deprecation) and added hatch build packages config"
  - "Used PGLite (@electric-sql/pglite) for local schema validation without Docker since Docker Desktop WSL integration not active"
  - "docker-compose uses 'version: 3.9' with target: dev in build config to support development volume mounts"

patterns-established:
  - "Schema-as-truth: Drizzle ORM (TypeScript) owns all migrations; Python SQLAlchemy models are reference-only stubs"
  - "Vexa session_uid is nullable by design (Vexa bug #96 workaround) in td_transcript_segments"
  - "All timestamps use TIMESTAMPTZ (withTimezone: true) for correctness across timezones"
  - "All td_* tables use UUID primary keys with defaultRandom() for non-guessable IDs"

# Metrics
duration: 12min
completed: 2026-02-23
---

# Phase 1 Plan 01: Monorepo Scaffold and Schema Summary

**Two-service monorepo (Next.js 15.5 + Python FastAPI) with Drizzle schema defining 4 PostgreSQL extension tables, GIN full-text search index, and Docker Compose orchestration**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-23T20:51:57Z
- **Completed:** 2026-02-23T21:03:33Z
- **Tasks:** 2
- **Files modified:** 19 created

## Accomplishments

- Two-service monorepo scaffolded: apps/web (Next.js 15.5, TypeScript, Drizzle ORM) and apps/api (Python FastAPI, asyncpg, ARQ)
- All 4 TargetDialer extension tables defined: td_users, td_meetings, td_transcript_segments, td_calendar_subscriptions — with correct columns, types, and constraints
- GIN index `idx_transcript_fts` on `to_tsvector('english', text)` confirmed working: FTS query returns results after first insert (validated with PGLite)
- FastAPI service imports cleanly with /health endpoint and asyncpg pool lifespan pattern
- Next.js app passes `tsc --noEmit` cleanly; drizzle-kit reports "Everything's fine" on schema check
- Docker Compose YAML validates syntactically with all 4 services and healthchecks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monorepo structure, Docker Compose, and environment config** - `eb4bbaa` (chore)
2. **Task 2: Create Drizzle schema, FastAPI service, and placeholder Next.js app** - `357dac9` (feat)

**Plan metadata:** *(docs commit — see below)*

## Files Created/Modified

- `docker-compose.yml` - Full service orchestration: postgres (healthcheck), redis (healthcheck), web, api on shared network
- `.env.example` - All required env variables documented (DATABASE_URL, REDIS_URL, AUTH_SECRET, Google OAuth, Vexa)
- `.gitignore` - Node/Next.js, Python/.venv, Docker volumes, Drizzle migrations
- `apps/web/package.json` - Next.js 15.5, Drizzle ORM + postgres.js, zod, PGLite; pnpm scripts for db:push and db:studio
- `apps/web/tsconfig.json` - TypeScript strict mode with @/* path alias to ./src/*
- `apps/web/next.config.ts` - Minimal config with standalone output for Docker
- `apps/web/Dockerfile` - Multi-stage: deps/build/runner/dev targets; node:22-alpine base
- `apps/web/drizzle.config.ts` - drizzle-kit config pointing to schema.ts
- `apps/web/src/lib/db/schema.ts` - All 4 TD extension tables: td_users, td_calendar_subscriptions, td_transcript_segments (GIN+3 btree indexes), td_meetings
- `apps/web/src/lib/db/index.ts` - Drizzle client singleton with globalThis hot-reload protection
- `apps/web/src/app/layout.tsx` - Minimal root layout with metadata
- `apps/web/src/app/page.tsx` - Placeholder "TargetDialer — Meeting Intelligence" page
- `apps/api/pyproject.toml` - FastAPI, asyncpg, ARQ, cryptography, SQLAlchemy; uv dependency groups
- `apps/api/Dockerfile` - python:3.12-slim with uv; dev/production targets
- `apps/api/src/__init__.py` - Package init (empty)
- `apps/api/src/main.py` - FastAPI app with CORS, lifespan pool management, GET /health
- `apps/api/src/db/__init__.py` - DB subpackage init
- `apps/api/src/db/session.py` - asyncpg pool factory with set_pool/get_pool pattern
- `apps/api/src/db/models.py` - SQLAlchemy reference models for TdMeeting and TdTranscriptSegment

## Decisions Made

- **Next.js 15.5.12 instead of 16**: pnpm resolved `^15.1.0` to 15.5.12 (LTS). Research confirmed this is the valid fallback when Auth.js v5 peer conflicts arise with Next.js 16. The App Router and all required features are available.
- **pnpm --strict-peer-dependencies=false**: pnpm v10 renamed --legacy-peer-deps; this flag is equivalent.
- **pyproject.toml fix**: `tool.uv.dev-dependencies` is deprecated; changed to `[dependency-groups] dev`. Added `[tool.hatch.build.targets.wheel] packages = ["src"]` for hatchling to locate package files.
- **PGLite for schema validation**: Docker Desktop WSL integration not active. Used @electric-sql/pglite (WASM PostgreSQL) to validate schema, GIN index creation, and FTS query in-memory — same result as running against real PostgreSQL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pyproject.toml hatchling build config**
- **Found during:** Task 1 (uv sync)
- **Issue:** `uv sync` failed — hatchling couldn't determine package files because project name `meetrec-api` didn't match directory name `src`
- **Fix:** Added `[tool.hatch.build.targets.wheel] packages = ["src"]` to pyproject.toml
- **Files modified:** `apps/api/pyproject.toml`
- **Verification:** `uv sync` succeeded, 41 packages installed
- **Committed in:** eb4bbaa (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed deprecated uv dev-dependencies syntax**
- **Found during:** Task 1 (uv sync)
- **Issue:** `tool.uv.dev-dependencies` deprecated in uv; warning shown during sync
- **Fix:** Changed to `[dependency-groups] dev = [...]` (PEP 735 standard)
- **Files modified:** `apps/api/pyproject.toml`
- **Verification:** `uv sync` runs without deprecation warning
- **Committed in:** eb4bbaa (Task 1 commit)

**3. [Rule 3 - Blocking] Used PGLite instead of Docker for schema validation**
- **Found during:** Task 2 (schema push verification)
- **Issue:** Docker Desktop WSL integration not active; `/mnt/wsl/docker-desktop/` mount missing; `docker` command unavailable
- **Fix:** Installed `@electric-sql/pglite` (WASM PostgreSQL); wrote validation script that creates all 4 tables, GIN index, inserts test row, and confirms FTS query returns results
- **Files modified:** `apps/web/package.json` (added pglite dep)
- **Verification:** PGLite script output confirms all 4 tables, idx_transcript_fts index, and FTS result count = 1
- **Committed in:** 357dac9 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All fixes required for installation and validation to work. No scope creep. Docker validation deferred to human-verify checkpoint when Docker Desktop is running.

## Issues Encountered

- **Docker Desktop WSL integration**: `/mnt/wsl/docker-desktop/` not mounted. The `docker compose config` validation and `docker compose up` startup checks from the plan's verify steps cannot run until Docker Desktop is active. All schema and code validations were completed with alternative tooling (PGLite, tsc, drizzle-kit check, Python imports).
- **pnpm --legacy-peer-deps**: Not valid in pnpm v10 — flag was renamed to `--strict-peer-dependencies=false`. Dockerfile uses the old flag in comments; updated to correct flag.

## User Setup Required

**Docker Desktop needs WSL integration enabled** before running `docker compose up`:
1. Open Docker Desktop on Windows
2. Settings > Resources > WSL Integration > Enable for your distro
3. Then: `docker compose up -d` from `/mnt/c/Users/Gustavo/desktop/meetrec/`
4. Verify: `docker compose exec postgres psql -U meetrec -c "\dt td_*"` (after running `pnpm db:push`)

After Docker is running, the full verification suite from the plan can be executed:
```bash
cd apps/web && DATABASE_URL=postgresql://meetrec:meetrec@localhost:5432/meetrec pnpm db:push
docker compose exec postgres psql -U meetrec -c "\dt td_*"
curl http://localhost:3000
curl http://localhost:8000/health
```

## Next Phase Readiness

- Schema is ready for 01-02 (Auth.js + Drizzle adapter): `td_users.auth_user_id` links to Auth.js `users.id`
- Schema is ready for 01-03 (Calendar Watcher): `td_calendar_subscriptions` table defined
- Schema is ready for 01-04 (Vexa integration): `td_meetings` and `td_transcript_segments` defined with Vexa bug workarounds (nullable session_uid)
- FastAPI service structure ready for Vexa webhook endpoints in 01-04
- Concern: Docker Desktop WSL integration must be active for `docker compose up` — the web and API services need to be verified live before 01-02 proceeds

---
*Phase: 01-foundation*
*Completed: 2026-02-23*
