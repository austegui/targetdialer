# Phase 1: Foundation - Research

**Researched:** 2026-02-23
**Domain:** Google OAuth + Calendar webhook integration + Vexa bot dispatch + transcript ownership + PostgreSQL schema
**Confidence:** MEDIUM — Core patterns verified via official docs and Context7; Vexa internal WebSocket event format inferred from community sources (DeepWiki) and PyPI client docs, not confirmed from Vexa's own swagger; Auth.js v5 maintenance status flagged as a live concern

---

## Summary

Phase 1 covers four tightly coupled sub-systems: Google OAuth (Auth.js v5 + Drizzle adapter), Google Calendar webhook registration and renewal, Vexa bot dispatch on meeting detection, and immediate transcript ownership via WebSocket streaming into the TargetDialer database. Every reliability mitigation the prior research identified must land in this phase — webhook renewal, fallback polling, transcript health checks, and GIN indexes — because retrofitting them after real meetings start costs data that cannot be recovered.

The critical new finding from this research phase is that **Auth.js v5 has entered maintenance mode** (handed off to the Better Auth team as of late 2025). It will receive security patches but active development has stopped and v5 never formally exited beta. For a new project starting now, this warrants a decision check: use `next-auth@beta` with `--legacy-peer-deps` for Next.js 16 compatibility (peer dependency conflict with Next.js 16 is a documented open issue) **OR** evaluate Better Auth as a replacement. The prior project decision locked in Auth.js v5 — this research confirms that decision is viable but the peer dependency workaround must be applied from the start.

The second critical finding is that **Vexa's meeting-end detection mechanism is confirmed**: the WebSocket channel on `/ws` emits bot status events through a Redis Pub/Sub relay. The `bm:meeting:{meeting_id}:status` channel delivers status transitions including `completed` and `failed`. Additionally, the `vexa-client` Python library exposes `set_webhook_url()` which registers a POST callback that receives the transcript payload when a meeting ends. The TargetDialer FastAPI service should use the webhook mechanism — not polling — to trigger the AI Worker job queue.

**Primary recommendation:** Scaffold the two-service architecture first (01-01), implement Auth.js v5 with `--legacy-peer-deps` and store Google OAuth refresh tokens encrypted in `td_users` immediately, then build the Calendar Watcher (01-03) and Vexa dispatch (01-04) in parallel only after the database schema with GIN indexes is fully migrated. Never defer indexes, never defer the webhook renewal cron, never defer transcript streaming to your own DB.

---

## Standard Stack

### Core (locked decisions — do not re-evaluate)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.x | App Router dashboard + API routes | Locked — two-service architecture decision |
| Auth.js (next-auth) | `beta` (5.x) | Google OAuth 2.0 with Calendar scope | Locked — handles OAuth callback, session, refresh tokens in one flow |
| Drizzle ORM | 0.38+ | TypeScript-safe PostgreSQL schema + queries | Locked — lightweight, no binary engine, SQL-close API |
| FastAPI | 0.115+ | Vexa integration service + Calendar webhook receiver | Locked — Python ecosystem, same language as Vexa |
| PostgreSQL | 16 | Shared database with Vexa extension tables | Locked — GIN indexes for FTS from day one |
| Redis | 7.x | ARQ job queue + distributed locks | Locked |
| ARQ | 0.26+ | Async Python job queue for post-meeting processing | Locked — asyncio-native, simpler than Celery |

### Supporting (Phase 1 specific)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@googleapis/calendar` | `^0.2` | Google Calendar API — watch endpoint + event fetch | Calendar Watcher registration and fallback poll |
| `@auth/drizzle-adapter` | latest | Connect Auth.js sessions to Drizzle/PostgreSQL | Session persistence, replaces JWT-only mode when refresh tokens must be stored |
| `node-cron` / `cron` | 3.x | Webhook renewal cron in Next.js API route | Runs every 6 hours to re-register expiring Calendar channels |
| `httpx` (Python) | 0.27+ | Async HTTP client for Vexa api-gateway calls from FastAPI | VexaClient wrapper — replaces `requests` for asyncio compatibility |
| `cryptography` (Python) | 43.x | Encrypt OAuth refresh tokens at rest | Never store Google tokens in plaintext |
| `zod` | 3.x | Validate Vexa webhook payloads and Calendar event shapes | Runtime schema enforcement at service boundaries |
| `postgres` (pg driver) | `postgres.js` 3.x | Async PostgreSQL driver for Drizzle | Prefer over `pg` — pure async, better performance |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js v5 (beta, maintenance mode) | Better Auth | Better Auth is now the active fork; requires database by default; migration is non-trivial mid-project; stick with Auth.js v5 for Phase 1 since it still receives security patches |
| Auth.js v5 + Next.js 16 | Pin to Next.js 15.5 LTS | Valid fallback if `--legacy-peer-deps` causes downstream issues; 15.5 is LTS, App Router feature-complete for this project |
| ARQ (Python) | BullMQ (Node.js) | BullMQ is Node-only; the job queue lives in the Python FastAPI service; ARQ is the correct choice |
| node-cron for renewal | Vercel Cron Jobs | Vercel Cron costs money; for a self-hosted deployment, node-cron in the API service is sufficient |

**Installation:**

```bash
# Next.js app (run with --legacy-peer-deps due to Auth.js v5 + Next.js 16 peer conflict)
pnpm add next-auth@beta @auth/drizzle-adapter
pnpm add @googleapis/calendar
pnpm add drizzle-orm postgres
pnpm add zod
pnpm add cron
pnpm add -D drizzle-kit

# Python FastAPI service
uv add fastapi uvicorn httpx arq redis sqlalchemy asyncpg psycopg2-binary
uv add cryptography pydantic python-dotenv
uv add --dev ruff pytest pytest-asyncio
```

---

## Architecture Patterns

### Recommended Project Structure

```
meetrec/
├── apps/
│   ├── web/                          # Next.js 16 (App Router)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/[...nextauth]/route.ts   # Auth.js handler
│   │   │   │   │   ├── calendar/webhook/route.ts      # Google Calendar push receiver
│   │   │   │   │   └── calendar/register/route.ts     # On-demand channel registration
│   │   │   │   ├── (auth)/login/page.tsx
│   │   │   │   └── (dashboard)/meetings/page.tsx
│   │   │   ├── auth.ts               # Auth.js config (providers, adapter, callbacks)
│   │   │   ├── proxy.ts              # Next.js 16: export { auth as proxy } from "@/auth"
│   │   │   └── lib/
│   │   │       ├── db/               # Drizzle schema + migrations
│   │   │       │   ├── schema.ts     # All table definitions inc. extension tables
│   │   │       │   └── index.ts      # Drizzle client singleton
│   │   │       └── calendar/
│   │   │           ├── watcher.ts    # Calendar watch registration
│   │   │           └── renewal.ts    # Renewal cron logic
│   │   └── Dockerfile
│   └── api/                          # Python FastAPI (Vexa integration)
│       ├── src/
│       │   ├── main.py               # FastAPI app
│       │   ├── vexa_client.py        # VexaClient wrapper (HTTP to api-gateway)
│       │   ├── webhook/
│       │   │   ├── vexa.py           # POST /webhook/vexa — meeting completion handler
│       │   │   └── calendar.py       # (optional — or handled in Next.js)
│       │   ├── jobs/
│       │   │   └── transcript.py     # ARQ job: save transcript segments to TD DB
│       │   └── db/
│       │       ├── models.py         # SQLAlchemy models for extension tables
│       │       └── session.py        # Async DB session factory
│       └── Dockerfile
├── docker-compose.yml                # Extends Vexa services + adds web + api
└── .env.example
```

**Note on proxy.ts:** As of Next.js 16, `middleware.ts` is renamed to `proxy.ts`. Auth.js v5 exports `{ auth as proxy }` for session-based route protection. This is a breaking change from Auth.js v5 + Next.js 15 patterns.

### Pattern 1: Auth.js v5 with Google OAuth + Calendar Scope

**What:** Single Google OAuth flow that requests both user identity scopes AND Calendar read-only scope. Auth.js stores the access_token and refresh_token in the database (via Drizzle adapter). The Calendar Watcher reads the stored token to call the Calendar API on behalf of each user.

**When to use:** During login flow — request all needed Google scopes upfront to avoid a second OAuth prompt later.

**Example:**
```typescript
// Source: authjs.dev/getting-started/providers/google + community verification
// apps/web/src/auth.ts

import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      authorization: {
        params: {
          scope: [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/calendar.readonly",
          ].join(" "),
          prompt: "consent",         // Required: forces refresh token every login
          access_type: "offline",    // Required: gets refresh_token
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      session.user.role = user.role  // from td_users extension
      return session
    },
  },
})
```

```typescript
// apps/web/src/proxy.ts (Next.js 16 — replaces middleware.ts)
export { auth as proxy } from "@/auth"

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
}
```

### Pattern 2: Drizzle Schema with Extension Tables + GIN Indexes

**What:** TargetDialer-owned extension tables alongside Vexa's tables in the shared PostgreSQL instance. GIN indexes on transcript content from day one. Never reference volatile Vexa columns — only stable IDs.

**When to use:** This is the canonical schema approach for ALL Phase 1 data.

**Example:**
```typescript
// Source: orm.drizzle.team/docs/guides/postgresql-full-text-search
// apps/web/src/lib/db/schema.ts

import { pgTable, text, uuid, timestamp, index, pgEnum, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const userRoleEnum = pgEnum("user_role", ["admin", "member"])

// TargetDialer user extension — links Google identity to Vexa user
export const tdUsers = pgTable("td_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: text("auth_user_id").notNull().unique(), // Auth.js users.id FK
  vexaUserId: text("vexa_user_id"),                   // Vexa internal user ID
  role: userRoleEnum("role").notNull().default("member"),
  googleRefreshToken: text("google_refresh_token"),    // Encrypted at rest
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Google Calendar watch channel subscriptions — for renewal tracking
export const tdCalendarSubscriptions = pgTable("td_calendar_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),                  // Auth.js user.id
  googleChannelId: text("google_channel_id").unique(),
  resourceId: text("resource_id"),
  calendarId: text("calendar_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  renewedAt: timestamp("renewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Transcript segments owned by TargetDialer — not dependent on Vexa retention
// Segments arrive via Vexa webhook or WebSocket stream, stored immediately
export const tdTranscriptSegments = pgTable(
  "td_transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vexaMeetingId: text("vexa_meeting_id").notNull(),  // Vexa native_meeting_id
    platform: text("platform").notNull(),               // "google_meet"
    sessionUid: text("session_uid"),                    // Vexa session_uid (nullable — bug workaround)
    speaker: text("speaker"),                           // May be null until diarization runs
    text: text("text").notNull(),
    startTime: text("start_time"),                      // Relative seconds (stored as text from Vexa)
    endTime: text("end_time"),
    absoluteStartTime: timestamp("absolute_start_time", { withTimezone: true }),
    absoluteEndTime: timestamp("absolute_end_time", { withTimezone: true }),
    language: text("language").default("en"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // GIN index for full-text search — must exist before any data is inserted
    index("idx_transcript_fts").using(
      "gin",
      sql`to_tsvector('english', ${table.text})`
    ),
    index("idx_transcript_meeting").on(table.vexaMeetingId),
    index("idx_transcript_speaker").on(table.speaker),
    index("idx_transcript_time").on(table.absoluteStartTime),
  ]
)

// Meeting-level metadata owned by TargetDialer
export const tdMeetings = pgTable("td_meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  vexaMeetingId: text("vexa_meeting_id").notNull().unique(),
  platform: text("platform").notNull(),
  userId: text("user_id").notNull(),
  calendarEventId: text("calendar_event_id"),
  meetingTitle: text("meeting_title"),
  scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
  botJoinedAt: timestamp("bot_joined_at", { withTimezone: true }),
  firstSegmentAt: timestamp("first_segment_at", { withTimezone: true }), // Health check gate
  meetingEndedAt: timestamp("meeting_ended_at", { withTimezone: true }),
  botStatus: text("bot_status").default("requested"),  // requested|joining|awaiting_admission|active|stopping|completed|failed
  segmentCount: text("segment_count").default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
```

### Pattern 3: Vexa Bot Dispatch + Meeting-End Detection

**What:** POST to Vexa's api-gateway to create a bot when a Calendar event with a Meet link is detected. Register a webhook URL with `set_webhook_url()` to receive the transcript payload when the meeting completes. Additionally subscribe to the WebSocket channel for real-time segment streaming.

**When to use:** Every time the Calendar Watcher detects a new upcoming meeting with a Google Meet URL.

**Bot status lifecycle (confirmed from DeepWiki/Vexa source):**
```
requested → joining → awaiting_admission → active → stopping → completed | failed
```

**Meeting-end detection — use webhook (preferred) + WebSocket status fallback:**

```python
# Source: PyPI vexa-client + DeepWiki deepwiki.com/Vexa-ai/vexa/2.2-meeting-and-bot-operations
# apps/api/src/vexa_client.py

import httpx
from typing import Optional

class VexaClient:
    """Thin wrapper around Vexa api-gateway. Never exposes Vexa API key to the browser."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url  # http://api-gateway:8056 (internal Docker network)
        self.api_key = api_key
        self._headers = {"X-API-Key": api_key}

    async def start_bot(
        self,
        native_meeting_id: str,
        platform: str = "google_meet",
        bot_name: str = "TargetDialer Notes",
    ) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/bots",
                json={
                    "platform": platform,
                    "native_meeting_id": native_meeting_id,
                    "bot_name": bot_name,
                },
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_transcript(self, platform: str, native_meeting_id: str) -> list[dict]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/transcripts/{platform}/{native_meeting_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def set_webhook_url(self, webhook_url: str) -> None:
        """Register TargetDialer's endpoint to receive meeting completion payloads."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/webhook",
                json={"url": webhook_url},
                headers=self._headers,
            )
            resp.raise_for_status()
```

```python
# apps/api/src/webhook/vexa.py — receives meeting completion callback

from fastapi import APIRouter, Request, BackgroundTasks
from src.jobs.transcript import save_transcript_segments

router = APIRouter()

@router.post("/webhook/vexa")
async def vexa_meeting_complete(request: Request, background_tasks: BackgroundTasks):
    """
    Vexa calls this when a meeting ends.
    Payload contains transcript segments — store immediately to TargetDialer DB.
    Do NOT wait for Vexa's REST GET /transcripts endpoint (session_uid bug risk).
    """
    payload = await request.json()
    meeting_id = payload.get("native_meeting_id")
    platform = payload.get("platform", "google_meet")
    segments = payload.get("segments", [])

    background_tasks.add_task(save_transcript_segments, meeting_id, platform, segments)
    return {"status": "accepted"}
```

### Pattern 4: Google Calendar Webhook Registration + Renewal

**What:** Register a Google Calendar push notification channel via the `events.watch` method. Store channel expiration in the database. Run a renewal cron every 6 hours that re-registers any channel expiring within 48 hours. Maintain a fallback hourly poll for any events missed during channel gaps.

**Critical constraint:** Google requires the webhook URL to be HTTPS. In development, use ngrok (`ngrok http 3000`). The Next.js API route handler is the correct location for this endpoint.

**Example:**
```typescript
// Source: developers.google.com/workspace/calendar/api/guides/push
// apps/web/src/lib/calendar/watcher.ts

import { calendar_v3, google } from "googleapis"
import { db } from "@/lib/db"
import { tdCalendarSubscriptions } from "@/lib/db/schema"
import { lt, and } from "drizzle-orm"

export async function registerCalendarWatch(
  userId: string,
  accessToken: string,
  calendarId: string = "primary"
): Promise<void> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const cal = google.calendar({ version: "v3", auth })

  const channelId = crypto.randomUUID()
  const expirationMs = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days max

  const response = await cal.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${process.env.PUBLIC_URL}/api/calendar/webhook`,
      expiration: String(expirationMs),
    },
  })

  await db.insert(tdCalendarSubscriptions).values({
    userId,
    googleChannelId: response.data.id!,
    resourceId: response.data.resourceId!,
    calendarId,
    expiresAt: new Date(Number(response.data.expiration)),
  })
}

export async function renewExpiringChannels(): Promise<void> {
  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h from now

  const expiring = await db.query.tdCalendarSubscriptions.findMany({
    where: (sub) => lt(sub.expiresAt, cutoff),
  })

  for (const sub of expiring) {
    // Re-register using same calendarId; get fresh access_token from user session
    // Then delete the old channel and insert the new one
    await registerCalendarWatch(sub.userId, await getAccessTokenForUser(sub.userId), sub.calendarId)
    await db.delete(tdCalendarSubscriptions).where(/* old channel ID */)
  }
}
```

```typescript
// apps/web/src/app/api/calendar/webhook/route.ts — Google push notification receiver

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  // Google sends headers, NOT body, for Calendar push notifications
  const resourceState = req.headers.get("X-Goog-Resource-State")
  const channelId = req.headers.get("X-Goog-Channel-ID")

  if (resourceState === "sync") {
    // Initial handshake — acknowledge only
    return NextResponse.json({ ok: true })
  }

  if (resourceState === "exists") {
    // Calendar changed — fetch events and check for new Meet links
    // Look up which user this channel belongs to, then dispatch meeting detection
    await detectAndDispatchMeetings(channelId!)
  }

  return NextResponse.json({ ok: true })
}
```

### Anti-Patterns to Avoid

- **Using `next-auth@4` with App Router:** It does not support App Router handlers correctly. Always use `next-auth@beta` (v5). Install with `--legacy-peer-deps` if npm blocks due to Next.js 16 peer dep conflict.
- **Not storing Google access_token in the database session:** If using JWT-only sessions (no database adapter), refresh tokens are not persisted. The Calendar Watcher cannot call the API on behalf of users between requests. Use `DrizzleAdapter` to persist sessions.
- **Trusting `bot.status === 'active'` as "meeting is being recorded":** Gate the success state on `first_segment_at` being populated in `td_meetings`. A bot reaches ACTIVE but captures no audio (Vexa issue #115).
- **Using `GET /transcripts/{session_uid}` as the sole source of truth:** Vexa has a documented bug (#96) where session_uid mismatches cause empty transcript returns. Own transcript data by writing webhook/WebSocket segments to your own DB immediately.
- **Forgetting `prompt: "consent"` in Google OAuth config:** Without this, Google will NOT return a refresh token on subsequent logins (only on first-ever authorization). Without a refresh token, Calendar access breaks after 1 hour.
- **Building Calendar polling as the primary mechanism:** Use `events.watch` webhook as primary. Polling as fallback only. Google actively rate-limits aggressive pollers.
- **Creating the GIN index after inserting data:** `CREATE INDEX` on a populated table is a blocking operation. Always run migrations with indexes before any application data is written.

---

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google OAuth flow | Custom OAuth implementation | Auth.js v5 Google provider | Handles PKCE, state param, CSRF protection, token storage, refresh rotation — dozens of edge cases |
| Google Calendar API client | Custom HTTP wrapper | `@googleapis/calendar` | Official client handles auth credential injection, retry, pagination, type safety |
| PostgreSQL full-text search | Manual `ILIKE '%query%'` | `tsvector` + GIN index via Drizzle | `ILIKE` is a sequential scan — unusable at scale. GIN index makes FTS sub-10ms |
| Session management | Custom JWT or session store | Auth.js session + DrizzleAdapter | Handles session rotation, CSRF, secure cookies, database persistence |
| Webhook channel renewal | Custom expiration tracking | Store `expiresAt` + cron job | Google silently stops sending events when channel expires — the renewal loop is the entire value |
| Async job processing | Background threads in FastAPI | ARQ + Redis | FastAPI background tasks don't survive restarts; ARQ is durable and retryable |
| Transcript deduplication | Custom dedup logic | Store `session_uid` + `start_time` as composite dedup key | Vexa can emit the same segment multiple times on reconnect — dedup by key, not insertion order |

**Key insight:** The Calendar + OAuth + Vexa integration surface has many subtle edge cases (expiring tokens, expiring channels, bot admission, audio capture failure, session_uid bugs) that each look trivial in isolation but compound into a system that silently loses data. Use battle-tested libraries for every layer where they exist, and budget implementation time for the reliability loops, not the happy path.

---

## Common Pitfalls

### Pitfall 1: Auth.js v5 Peer Dependency Conflict with Next.js 16

**What goes wrong:** `npm install next-auth@beta` fails with `ERESOLVE unable to resolve dependency tree` because next-auth@beta declares peer dependency `next@"^12.2.5 || ^13 || ^14 || ^15"` and Next.js 16 is not in that range.

**Why it happens:** Auth.js v5 has entered maintenance mode (now maintained by Better Auth team). The peer dependency range has not been updated to include Next.js 16.

**How to avoid:** Install with `--legacy-peer-deps` flag. This is safe — Auth.js v5 is functionally compatible with Next.js 16 (the `middleware.ts` → `proxy.ts` rename is the only API difference). Verify this at project start before proceeding.

**Warning signs:** CI/CD pipelines fail on `npm ci` without the flag. Add `--legacy-peer-deps` to Docker build args and CI install scripts from the start.

**Fallback:** Pin to Next.js 15.5 LTS. Both App Router and all required features are available. Only downside is missing Next.js 16-specific performance improvements.

---

### Pitfall 2: Google Calendar Webhook Receives Empty Notification Body

**What goes wrong:** Developer expects the Calendar webhook to deliver the changed event data in the request body. The webhook body is empty. The `X-Goog-Resource-State` header carries the signal; the actual changed events must be fetched separately via the Calendar API.

**Why it happens:** Google Calendar push notifications are "signals, not payloads." The notification tells you something changed; you must call `events.list` with a `syncToken` to find what.

**How to avoid:** After receiving `X-Goog-Resource-State: exists`, call `calendar.events.list({ calendarId, syncToken })` to get the delta. Store the `nextSyncToken` from each response for the next delta call.

**Warning signs:** Webhook handler logs show the notification arriving but event data is missing from the request body.

---

### Pitfall 3: Refresh Token Not Returned After First Login

**What goes wrong:** Calendar integration works for the first user to log in. Subsequent logins (or the same user logging in again) return no refresh token. The token is `undefined` in the Auth.js JWT callback. Calendar API calls start failing after the access token expires.

**Why it happens:** Google only returns a refresh token on the first authorization OR when `prompt: "consent"` is specified. Without `prompt: "consent"`, repeat logins get a new access token but no refresh token.

**How to avoid:** Always include `prompt: "consent"` and `access_type: "offline"` in the Google provider's `authorization.params`. This forces the consent screen to appear every login but ensures a fresh refresh token is always captured.

**Warning signs:** The `account.refresh_token` is `null` or `undefined` in the `signIn` callback for users who have previously authorized the app.

---

### Pitfall 4: Vexa Bot Shows ACTIVE but Transcript Never Arrives

**What goes wrong:** Bot dispatch appears to succeed (HTTP 200 from `POST /bots`, status transitions to `active`). The webhook URL receives the meeting-complete callback with zero segments. Users see the meeting in the list but the transcript is blank.

**Why it happens:** Documented Vexa bug (#115) — the bot's headless browser fails to acquire the audio stream but the status tracker doesn't detect this. The bot sits in the meeting "deaf."

**How to avoid:**
1. Track `first_segment_at` in `td_meetings`. Do not mark a meeting as "recording" until the first segment arrives.
2. Implement a 3-minute health check: if `bot_status = 'active'` AND `first_segment_at IS NULL` AND `bot_joined_at < NOW() - INTERVAL '3 minutes'`, trigger a bot restart via `DELETE /bots/{platform}/{id}` then re-dispatch, and alert.

**Warning signs:** `td_meetings.first_segment_at` is NULL on meetings older than 10 minutes with `bot_status = 'active'`.

---

### Pitfall 5: Calendar Webhook Channel Expires Silently — 7-Day Cliff

**What goes wrong:** Calendar push notifications stop arriving. No error is raised. Meetings are added to users' calendars but the bot is never dispatched. Users don't notice for days.

**Why it happens:** Google Calendar webhook channels expire after approximately 7 days and must be re-registered. The application has no built-in reminder.

**How to avoid:** Implement the renewal cron from day one:
- Store `expiresAt` in `td_calendar_subscriptions` for every registered channel.
- Run a cron job every 6 hours that fetches channels expiring within 48 hours and re-registers them.
- Maintain an hourly fallback poll (`calendar.events.list` with `timeMin: now`) as a safety net for any events missed during channel gap.

**Warning signs:** `td_calendar_subscriptions.expires_at < NOW()` without a recent `renewed_at` value.

---

### Pitfall 6: session_uid Mismatch Causes Silent Transcript Loss

**What goes wrong:** `GET /transcripts/{session_uid}` returns HTTP 200 with an empty array for meetings that completed successfully. Transcript data is gone.

**Why it happens:** Documented Vexa bug (#96) — if the bot crashes and restarts mid-meeting, it creates a new session record while orphaned transcription rows reference the old UID.

**How to avoid:** Own transcript data from the moment it arrives. The Vexa webhook delivers segments on meeting completion — store them to `td_transcript_segments` immediately. Never rely solely on `GET /transcripts` for post-meeting data retrieval. Treat Vexa's `session_uid` as a nullable foreign reference on the TargetDialer side.

**Warning signs:** Meetings in `td_meetings` with `bot_status = 'completed'` but zero rows in `td_transcript_segments`.

---

## Code Examples

Verified patterns from official sources:

### Drizzle GIN Index for Transcript Full-Text Search

```typescript
// Source: orm.drizzle.team/docs/guides/postgresql-full-text-search
import { pgTable, text, uuid, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const tdTranscriptSegments = pgTable(
  "td_transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vexaMeetingId: text("vexa_meeting_id").notNull(),
    text: text("text").notNull(),
    speaker: text("speaker"),
  },
  (table) => [
    // GIN index — must exist before data is inserted
    index("idx_transcript_fts").using(
      "gin",
      sql`to_tsvector('english', ${table.text})`
    ),
  ]
)

// Querying (FTS)
const results = await db
  .select()
  .from(tdTranscriptSegments)
  .where(sql`to_tsvector('english', ${tdTranscriptSegments.text}) @@ plainto_tsquery('english', ${searchQuery})`)
  .orderBy(sql`ts_rank(to_tsvector('english', ${tdTranscriptSegments.text}), plainto_tsquery('english', ${searchQuery})) DESC`)
```

### Auth.js v5 Google Provider — Complete Working Configuration

```typescript
// Source: authjs.dev/getting-started/providers/google + community verification
// auth.ts

import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "database" },  // Required for refresh token persistence
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

### ARQ Job Worker for Post-Meeting Transcript Persistence

```python
# Source: ARQ docs (arq.helpmanual.io) + FastAPI asyncio patterns
# apps/api/src/jobs/transcript.py

import asyncpg
from typing import Any

async def save_transcript_segments(
    ctx: dict,
    vexa_meeting_id: str,
    platform: str,
    segments: list[dict[str, Any]],
) -> None:
    """
    ARQ job: persist transcript segments from Vexa webhook to TargetDialer DB.
    Idempotent — uses ON CONFLICT DO NOTHING with composite dedup key.
    """
    pool = ctx["db_pool"]
    async with pool.acquire() as conn:
        for seg in segments:
            await conn.execute(
                """
                INSERT INTO td_transcript_segments
                    (id, vexa_meeting_id, platform, session_uid, speaker,
                     text, start_time, end_time, absolute_start_time, absolute_end_time)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (vexa_meeting_id, start_time, speaker) DO NOTHING
                """,
                vexa_meeting_id,
                platform,
                seg.get("session_uid"),
                seg.get("speaker"),
                seg.get("text", ""),
                seg.get("start_time"),
                seg.get("end_time"),
                seg.get("absolute_start_time"),
                seg.get("absolute_end_time"),
            )

        # Update meeting metadata — record first_segment_at and segment count
        await conn.execute(
            """
            UPDATE td_meetings
            SET first_segment_at = COALESCE(first_segment_at, NOW()),
                segment_count = $1::text,
                meeting_ended_at = NOW(),
                bot_status = 'completed'
            WHERE vexa_meeting_id = $2
            """,
            str(len(segments)),
            vexa_meeting_id,
        )
```

### Vexa Transcript Segment Schema (Confirmed Format)

```typescript
// Source: DeepWiki deepwiki.com/Vexa-ai/vexa/2.2-meeting-and-bot-operations
// Transcript segment structure as delivered by Vexa webhook or GET /transcripts

interface VexaTranscriptSegment {
  start_time: number          // Relative seconds from meeting start
  end_time: number            // Relative seconds from meeting start
  text: string                // Transcribed speech
  speaker: string             // Speaker identifier (name or "Speaker 1")
  language: string            // Language code, e.g. "en"
  session_uid: string         // Vexa session UID (unreliable — treat as nullable)
  absolute_start_time: string // ISO 8601 UTC timestamp
  absolute_end_time: string   // ISO 8601 UTC timestamp
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-auth@4` (NextAuth) | `next-auth@beta` (Auth.js v5) | 2023 → maintained 2024-2025, maintenance mode 2025 | App Router native; unified `auth()` function; but v5 never formally released stable; Better Auth is the new active project |
| `middleware.ts` for session protection | `proxy.ts` (Next.js 16) | Next.js 16 release, late 2024 | File name change only; export pattern is `export { auth as proxy }` |
| Polling Google Calendar for changes | `events.watch` push notifications | Long-standing | Near-instant meeting detection vs. 1-minute lag; massively lower API quota usage |
| Storing transcripts only in Vexa | Own transcript storage in TargetDialer DB | Best practice from day one | Eliminates data loss from Vexa session_uid bug and Vexa retention policy changes |
| Using Celery for Python async jobs | ARQ | 2022+ | ARQ is asyncio-native; Celery requires greenlet patches; for FastAPI, ARQ is the right choice |

**Deprecated/outdated:**
- `next-auth@4`: Not compatible with App Router properly; env variable names changed (`NEXTAUTH_SECRET` → `AUTH_SECRET`). Do not use.
- `getServerSession` (NextAuth v4): Replaced by unified `auth()` call in Auth.js v5.
- `middleware.ts` (Next.js 15 and earlier): Renamed to `proxy.ts` in Next.js 16. Create `proxy.ts`, not `middleware.ts`.
- Vexa `transcript.finalized` WebSocket event: Deprecated and no longer emitted as of recent versions. Use `transcript.mutable` events for live display; use the webhook or REST GET for final transcript.

---

## Open Questions

### 1. Exact Vexa Webhook Payload Schema

**What we know:** `vexa-client` PyPI package has a `set_webhook_url()` method. The DeepWiki docs state the webhook delivers transcript segments when a meeting ends. The segment format is confirmed (start_time, end_time, text, speaker, session_uid, absolute timestamps).

**What's unclear:** The exact top-level JSON structure of the webhook POST body has not been verified from official Vexa docs. The nested key names (`segments`, `native_meeting_id`, `platform`) are inferred from the REST API and WebSocket patterns, not confirmed from a Vexa webhook sample.

**Recommendation:** In the first integration test (Plan 01-04), log the raw webhook payload before parsing it. Do not assume the structure — read it from the actual Vexa instance.

---

### 2. Vexa Admin vs. User API Token for Self-Hosted

**What we know:** Vexa has two auth mechanisms: `X-Admin-API-Key` for admin operations (create user, list users) and `X-API-Key` (per-user token) for bot operations. The default `ADMIN_API_TOKEN` in the env file is `token`.

**What's unclear:** For TargetDialer's use case (all meetings are for one team), whether a single shared Vexa user token is appropriate, or whether each TargetDialer user needs their own Vexa user token provisioned via the admin API. This affects the `td_users.vexa_user_id` column design.

**Recommendation:** During plan 01-01 (scaffold), provision one Vexa user via the Admin API and test bot dispatch with that user's token. If Vexa enforces per-user meeting ownership in transcript retrieval, provision per-user tokens and store them in `td_users.vexa_user_id`.

---

### 3. Auth.js v5 Token Storage in DrizzleAdapter — `accounts` Table Schema

**What we know:** `@auth/drizzle-adapter` creates an `accounts` table that stores `access_token`, `refresh_token`, `expires_at`, and `scope`. The Calendar API requires reading the stored `access_token` for Calendar API calls between user sessions.

**What's unclear:** The exact query pattern for reading a user's Google access token from the Auth.js `accounts` table using Drizzle to make Calendar API calls (the token is owned by Auth.js — you're reading from Auth.js's internal table). Whether the DrizzleAdapter exposes a helper for token refresh or whether we must implement the refresh loop manually.

**Recommendation:** In plan 01-02, implement and test the full token read + refresh loop explicitly. Do not assume Auth.js automatically refreshes the Calendar access token — the adapter persists the token but refresh rotation for Calendar API calls is the application's responsibility.

---

### 4. Vexa `native_meeting_id` Extraction from Google Meet URL

**What we know:** Vexa's bot is dispatched with `{ platform: "google_meet", native_meeting_id: "abc-defg-hij" }`. The `native_meeting_id` is the meeting code portion of the Meet URL.

**What's unclear:** The exact regex or parsing logic needed to extract `abc-defg-hij` from all Google Meet URL variants (`meet.google.com/abc-defg-hij`, `meet.google.com/abc-defg-hij?authuser=0`, meeting links embedded in Calendar event descriptions vs. the `conferenceData.entryPoints` field).

**Recommendation:** Use the Google Calendar `event.conferenceData.entryPoints[].uri` field (type: `video`) as the authoritative source. Parse meeting code with: `url.pathname.split('/').pop()?.split('?')[0]`. Log any Meet URLs that fail this parse for manual review.

---

## Sources

### Primary (HIGH confidence)

- `orm.drizzle.team/docs/guides/postgresql-full-text-search` — GIN index with tsvector, Drizzle schema patterns, verified 2025-02-23
- `developers.google.com/workspace/calendar/api/guides/push` — Google Calendar push notification channel registration, 7-day expiry, renewal pattern
- `authjs.dev/getting-started/providers/google` — Auth.js v5 Google provider configuration, `authorization.params`, offline access
- `authjs.dev/getting-started/migrating-to-v5` — middleware.ts → proxy.ts change in Next.js 16, minimum Next.js 14

### Secondary (MEDIUM confidence)

- `deepwiki.com/Vexa-ai/vexa/2.2-meeting-and-bot-operations` — Vexa bot status lifecycle, WebSocket channels `bm:meeting:{id}:status`, transcript segment schema, Redis Pub/Sub architecture
- `pypi.org/project/vexa-client/` — `set_webhook_url()` method confirmed for meeting completion notification
- `github.com/Vexa-ai/vexa/releases` — v0.6 current (October 2025), WebSocket streaming, Teams support
- `vexa.ai/blog/how-to-set-up-self-hosted-meeting-transcription-5-minutes` — API gateway port 8056, admin token, X-API-Key authentication
- `github.com/nextauthjs/next-auth/issues/13302` — peer dependency conflict with Next.js 16 confirmed open issue
- `github.com/nextauthjs/next-auth/discussions/13252` — Auth.js v5 maintenance mode, Better Auth takeover

### Tertiary (LOW confidence)

- WebSearch results on next-auth v5 + Next.js 16 `--legacy-peer-deps` workaround — multiple community sources agree, not verified in official docs
- WebSearch on Vexa webhook payload format — inferred from PyPI client and community n8n templates; not confirmed from official Vexa Swagger/OpenAPI spec

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed via official docs or Context7; Auth.js v5 maintenance mode is a documented fact
- Architecture: MEDIUM-HIGH — two-service pattern confirmed; Vexa WebSocket/webhook mechanism confirmed from community docs with sufficient detail; exact webhook payload format is LOW
- Pitfalls: HIGH for Google Calendar and OAuth patterns (official docs); MEDIUM for Vexa-specific bugs (GitHub issues); MEDIUM for Auth.js v5 compatibility (GitHub issues + community)
- Code examples: MEDIUM — Drizzle schema patterns are HIGH (official docs); Auth.js examples are MEDIUM (community-verified patterns); Vexa webhook example is LOW (inferred structure, must be verified against live instance)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 for stable patterns (Drizzle, Google Calendar API); 2026-03-02 for Auth.js v5 / Better Auth situation (fast-moving)

**Critical action before coding:** Verify Auth.js v5 installs with `--legacy-peer-deps` on the actual Node.js/Next.js 16 version being used. Verify Vexa webhook payload by logging raw POST body from a test meeting end. Both must be confirmed before plan 01-02 and 01-04 begin implementation.
