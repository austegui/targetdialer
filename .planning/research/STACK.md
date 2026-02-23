# Stack Research

**Domain:** Meeting intelligence platform (internal SaaS, Fireflies.ai replacement on Vexa)
**Researched:** 2026-02-23
**Confidence:** MEDIUM-HIGH (core technologies verified via official docs and multiple current sources; Vexa-specific integration patterns are LOW due to limited third-party build-on-top documentation)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.x (LTS) | Full-stack web framework + dashboard UI | App Router gives server components for initial data load, client components for real-time updates. Single codebase handles frontend and API routes, reducing deployment complexity for a team of 5-20. Turbopack is now stable default. |
| Python / FastAPI | Python 3.12+, FastAPI 0.115+ | Backend API that wraps and extends Vexa | Vexa itself is Python/FastAPI. Building the integration layer in the same language means shared models, no serialization boundary, and direct database access without network hops. FastAPI gives async-first, auto-documented endpoints. |
| PostgreSQL | 16.x | Primary data store for meetings, transcripts, analytics | Vexa already uses PostgreSQL. Sharing one PG instance avoids sync complexity. PG 16 adds logical replication improvements and better full-text search performance. At 5-20 users with thousands of meetings, PG native FTS is sufficient — no Elasticsearch needed. |
| Redis | 7.x | Job queue backing store + session cache | Used by ARQ (Python background jobs) for AI summary generation after meetings end. Also used for rate limiting and caching expensive analytics aggregations. Vexa's architecture already expects Redis for its worker processes. |
| Vercel AI SDK | 6.x (`ai` npm package) | Provider-agnostic LLM integration layer | Unified TypeScript API across 25+ providers (Claude, OpenAI, Groq, Ollama for self-hosted). Change model in 2 lines of config. Built for Next.js with streaming-first design. v6 introduced stable agent support and v3 Language Model Specification. Best fit for this stack since frontend (Next.js) and AI calls coexist. |
| Auth.js (NextAuth v5) | v5.x (stable beta, use `next-auth@beta`) | Google OAuth 2.0 authentication | Standard for Next.js apps. Handles Google OAuth callback, session management (JWT or database sessions), and — critically — can request Google Calendar API scopes during the OAuth flow so we get calendar access without a second auth prompt. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle ORM | 0.38+ | TypeScript-safe PostgreSQL queries from Next.js | All database access from the Next.js layer. Lightweight, SQL-close API, no code generation step needed. Works on edge if needed. Use for schema definitions, migrations, and query building. Do NOT use Prisma — Prisma's binary engine is heavy and adds cold-start overhead. |
| ARQ | 0.26+ | Async Python job queue over Redis | Background AI summary generation after a meeting ends. ARQ is async-native, a natural fit for FastAPI's asyncio event loop. Use for: post-meeting summary jobs, keyword extraction, topic modeling. Do NOT use Celery — Celery is sync-first and requires extra shims for asyncio. |
| TanStack Query | v5.x | Client-side data fetching and caching for dashboard | Dashboard has multiple independent widgets (meeting list, speaker stats, topic trends). TanStack Query handles stale-while-revalidate, background refetch, and optimistic updates cleanly. Use alongside React Server Components for hybrid rendering. |
| Recharts | 2.x | Analytics charts and visualizations | Speaker stats, meeting frequency, topic trends — all standard time-series and bar chart needs. Recharts is the best balance of simplicity and customization for React. Recharts 2.x is SVG-based, small bundle, easy theming. Nivo is an alternative only if you need canvas rendering for performance with very large datasets. |
| Zod | 3.x | Schema validation end-to-end | Validate Vexa API responses, LLM structured outputs, and form data. Pairs with Drizzle for insert validation and with the AI SDK's `generateObject` for enforcing summary shapes. |
| Google APIs Node.js Client | `@googleapis/calendar` ^0.2 | Google Calendar read access | Fetch calendar events to auto-join scheduled Google Meet calls. Use the scoped OAuth token from Auth.js to call Calendar API. This is the official Google client library — no alternative warranted. |
| shadcn/ui + Tailwind CSS | shadcn latest, Tailwind 4.x | UI component system | Copy-paste component library built on Radix primitives. No dependency to install, components live in your codebase. Tailwind 4 (oxide engine) is current and faster. This combination is the dominant pattern for internal tools in 2025-2026. |
| date-fns | 4.x | Date manipulation for meeting timestamps | Lightweight, tree-shakeable. Used for formatting meeting durations, relative times ("2 hours ago"), and calendar date ranges. Do NOT use moment.js — deprecated, heavy. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker + Docker Compose | Local dev and production deployment | Run Next.js app, FastAPI backend, PostgreSQL, Redis as coordinated services. Vexa itself ships as Docker Compose. Extend it with your services rather than creating a separate compose file. |
| pnpm | Package manager for Node.js frontend | Faster installs, strict dependency isolation. Use `pnpm` over `npm` or `yarn` for the Next.js workspace. |
| uv | Python package manager | Modern, Rust-based Python package manager, much faster than pip. Use for the FastAPI service. Replaces poetry for new projects. |
| Biome | Linting + formatting (JS/TS) | Single tool replaces ESLint + Prettier. Near-instant, opinionated, zero config needed. Use for the Next.js codebase. |
| Ruff | Python linting + formatting | The Python equivalent of Biome. Rust-based, fast, replaces flake8 + black + isort for the FastAPI service. |

---

## Installation

```bash
# Next.js project (frontend + API routes)
pnpm create next-app@latest meetrec-app --typescript --tailwind --app

# Core dependencies
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai drizzle-orm @neondatabase/serverless
pnpm add next-auth@beta @auth/drizzle-adapter
pnpm add @tanstack/react-query @tanstack/react-query-devtools
pnpm add recharts
pnpm add zod
pnpm add @googleapis/calendar
pnpm add date-fns

# Dev dependencies
pnpm add -D drizzle-kit
pnpm add -D @biomejs/biome
pnpm add -D @types/node

# shadcn/ui (interactive setup — run after Next.js init)
pnpm dlx shadcn@latest init
```

```bash
# FastAPI service (Python)
# Install uv first: curl -LsSf https://astral.sh/uv/install.sh | sh
uv init meetrec-api
cd meetrec-api
uv add fastapi uvicorn sqlalchemy asyncpg psycopg2-binary arq redis
uv add anthropic openai httpx pydantic python-dotenv
uv add --dev ruff pytest pytest-asyncio
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 | Remix | Choose Remix if you want a pure fetch-based model with no server components complexity. For a data-heavy internal dashboard, Next.js App Router's server components win. |
| Next.js 16 | SvelteKit | Choose SvelteKit for smaller bundle size and less framework overhead. The trade-off is smaller ecosystem and fewer AI/analytics libraries with React bindings. |
| Drizzle ORM | Prisma | Choose Prisma if your team prefers schema-first workflow and you don't care about bundle size. Prisma is fine for server-only Next.js (no edge) but Drizzle is lighter and TypeScript-native without code generation. |
| Auth.js v5 | Clerk | Choose Clerk if you want zero-config auth as a service. Clerk costs money and adds external dependency; for a self-hosted internal tool, Auth.js is the right call. |
| ARQ + Redis | Celery + Redis | Choose Celery only if you need multi-broker support (RabbitMQ) or complex periodic task scheduling. For AI summary generation (simple async jobs), ARQ is lighter and asyncio-native. |
| Vercel AI SDK | LangChain | Choose LangChain if you need complex RAG pipelines with document indexing, multi-step agents with tool use, or LangSmith tracing. For meeting summaries (single-turn prompt + structured output), Vercel AI SDK is simpler and more appropriate. LangChain adds 100KB+ bundle and significant complexity for this use case. |
| PostgreSQL FTS + pg_trgm | Elasticsearch | Choose Elasticsearch at 10K+ users or if relevance ranking is critical. At 5-20 users with thousands of meetings, PostgreSQL FTS with `GIN` index + `pg_trgm` for fuzzy matching is operationally simpler and sufficient. Elasticsearch adds infra cost and sync complexity. |
| Recharts | Nivo | Choose Nivo if you need canvas rendering for performance with 50K+ data points per chart, or need heatmaps/sankey diagrams not in Recharts. For speaker stats and topic trends, Recharts is simpler. |
| Tailwind 4 + shadcn | Chakra UI / MUI | Choose Chakra/MUI for accessibility-first enterprise products or design system consistency across a large team. For an internal tool with a small team, shadcn/ui copy-paste components with Tailwind give more flexibility and less lock-in. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Moment.js | Deprecated, 67KB bundle, mutable API | date-fns (tree-shakeable, 2KB per function) |
| Prisma (in this project) | Binary query engine is heavy, code generation adds friction, cold-start cost if ever needed on edge | Drizzle ORM (SQL-close, TypeScript-native, no binary) |
| Celery (Python) | Sync-first, requires greenlet patches for asyncio, complex broker config | ARQ (async-native, Redis-only, simple) |
| LangChain (for summaries) | 3x bundle overhead vs Vercel AI SDK, over-engineered for single-turn LLM calls, abstract concepts that add debugging friction | Vercel AI SDK `generateObject` with Zod schema |
| Elasticsearch | Massive operational overhead, requires sync pipeline from PG, overkill at 5-20 users | PostgreSQL FTS with GIN index + `pg_trgm` |
| next-auth@4 (legacy) | Does not support App Router properly, env variables changed, not maintained | Auth.js (next-auth@beta, v5) |
| SQLite | No concurrency for multi-user, no native JSON operators, no FTS ranking | PostgreSQL 16 |
| Yarn / npm | Slower than pnpm, less strict hoisting | pnpm |

---

## Stack Patterns by Variant

**If self-hosting LLMs (Ollama, LocalAI):**
- Vercel AI SDK has `@ai-sdk/openai-compatible` provider
- Point it at your Ollama endpoint (`http://localhost:11434/v1`)
- Same `generateObject` / `generateText` calls work unchanged
- No code changes needed, just env var swap

**If deploying to Vercel (managed hosting):**
- Next.js deploys natively; FastAPI goes to a separate service (Railway, Render, Fly.io)
- Use Neon Postgres (serverless) instead of self-hosted PG
- Redis via Upstash (serverless, pay-per-request)
- Remove Docker Compose for production, keep for local dev

**If self-hosting everything (VPS/Docker):**
- Single Docker Compose with all services: Next.js, FastAPI, PostgreSQL, Redis, Vexa stack
- Nginx as reverse proxy in front of Next.js and FastAPI
- Use Let's Encrypt for TLS via Certbot or Traefik

**If adding vector search for semantic meeting search:**
- Add `pgvector` extension to existing PostgreSQL instance (no new service)
- Use Vercel AI SDK's `embed` function to generate embeddings
- Store embeddings in `meetings` table as `vector(1536)` column
- Combine with FTS for hybrid keyword + semantic search

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 16.x | React 19.x | Required. React 18 not supported in App Router in Next.js 16. |
| Auth.js (next-auth@beta) | Next.js 16.x | There are reported peer dependency conflicts with Next.js 16.0. Use `--legacy-peer-deps` flag if needed, or pin to Next.js 15.5 LTS until Auth.js publishes a stable v5 release with Next.js 16 support. |
| Drizzle ORM 0.38+ | PostgreSQL 16 | Compatible. Uses `pg` or `postgres` (postgres.js) as driver. Prefer `postgres.js` for async performance. |
| Vercel AI SDK 6.x | Node.js 18+ | Requires Node.js 18 or later. Compatible with Next.js 16. |
| TanStack Query v5 | React 19 | v5 is compatible with React 19. Do NOT use v4 — v5 was a breaking rewrite with improved TypeScript types and devtools. |
| ARQ 0.26+ | Python 3.12, Redis 7.x | Compatible. ARQ uses `aioredis` internally, works with Redis 7's new command set. |

---

## Key Architecture Decision: Separate Services or Monolith?

**Recommendation: Two-service architecture.**

- **Service 1: Next.js 16 app** — dashboard UI + API routes that query PostgreSQL directly via Drizzle. Handles auth, calendar integration, search, and analytics display.
- **Service 2: FastAPI service** — extends Vexa's existing Python ecosystem. Handles: listening to Vexa webhooks (meeting ended), triggering ARQ jobs for AI summaries, and exposing internal API for the Next.js app to call.

**Do NOT build a single Next.js app that calls Vexa's REST API directly from the browser.** Vexa's API uses `X-API-Key` authentication which must stay server-side. Route all Vexa calls through the FastAPI service or Next.js API routes.

---

## Sources

- Vexa GitHub README (https://github.com/Vexa-ai/vexa) — architecture, API endpoints, PostgreSQL + Docker stack confirmed — MEDIUM confidence (no dedicated "build on top of Vexa" guide exists)
- Next.js 16.1 release blog (https://nextjs.org/blog/next-16) — version, Turbopack stable, App Router — HIGH confidence
- Vercel AI SDK npm page (https://www.npmjs.com/package/ai) — version 6.0.97 current — HIGH confidence
- Vercel AI SDK 4.2 blog (https://vercel.com/blog/ai-sdk-4-2) — provider-agnostic architecture, OpenAI-compatible self-hosted — HIGH confidence
- Auth.js Next.js 16 compatibility issue (https://github.com/nextauthjs/next-auth/issues/13302) — peer dep conflict flagged — MEDIUM confidence (GitHub issue, may be resolved)
- Drizzle vs Prisma comparison (https://www.bytebase.com/blog/drizzle-vs-prisma/) — Drizzle recommended for edge/serverless, 2026 — MEDIUM confidence
- PostgreSQL FTS vs Elasticsearch (https://neon.com/blog/postgres-full-text-search-vs-elasticsearch) — PG FTS sufficient for small-medium — MEDIUM confidence
- ARQ vs Celery comparison (https://medium.com/@komalbaparmar007/fastapi-background-tasks-vs-celery-vs-arq) — ARQ for asyncio-native FastAPI — MEDIUM confidence (single source)
- BullMQ official site (https://bullmq.io/) — considered but not recommended (Node.js only, while backend is Python) — HIGH confidence for rejection rationale
- LangChain vs Vercel AI SDK comparison (https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide) — Vercel AI SDK for Next.js apps — MEDIUM confidence

---

*Stack research for: TargetDialer — meeting intelligence platform on Vexa*
*Researched: 2026-02-23*
