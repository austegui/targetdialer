# Architecture Research

**Domain:** Meeting intelligence platform (built on Vexa)
**Researched:** 2026-02-23
**Confidence:** MEDIUM — Vexa internal service communication and exact API contracts are inferred from public repo structure and community sources; full schema details not publicly documented.

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                    │
│  ┌────────────────────┐   ┌─────────────────────────────────────────┐   │
│  │   Web Dashboard    │   │  Google Calendar (external push source) │   │
│  │  (React/Next.js)   │   │                                         │   │
│  └─────────┬──────────┘   └──────────────────┬──────────────────────┘   │
└────────────┼─────────────────────────────────┼────────────────────────  ┘
             │ HTTPS REST / WebSocket           │ Webhook (HTTPS POST)
┌────────────▼─────────────────────────────────▼────────────────────────  ┐
│                       APPLICATION LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    TargetDialer API (new)                         │   │
│  │   /auth  /calendar  /summaries  /search  /analytics              │   │
│  └────────┬───────────┬──────────────┬──────────────────────────────┘   │
│           │           │              │                                    │
│  ┌────────▼──┐  ┌─────▼──────┐  ┌───▼──────────┐                        │
│  │  Calendar │  │  AI Worker │  │ Search Index │                        │
│  │  Watcher  │  │  (async)   │  │   Service    │                        │
│  └────────┬──┘  └─────┬──────┘  └───▲──────────┘                        │
│           │           │              │                                    │
│           │           │ triggers index update                            │
│           │    ┌──────▼──────────────┘                                  │
│           │    │                                                         │
└───────────┼────┼─────────────────────────────────────────────────────── ┘
            │    │
            │    │ (reads completed transcripts + writes summaries)
┌───────────▼────▼─────────────────────────────────────────────────────── ┐
│                        VEXA LAYER (existing)                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    api-gateway  :8056                            │    │
│  └──────────┬────────────────────────┬────────────────────────────-┘    │
│             │                        │                                    │
│  ┌──────────▼──────────┐  ┌──────────▼──────────┐                       │
│  │    bot-manager      │  │  transcription-      │                       │
│  │  (bot lifecycle)    │  │  collector           │                       │
│  └──────────┬──────────┘  └──────────┬───────────┘                      │
│             │                        │                                    │
│  ┌──────────▼──────────┐  ┌──────────▼───────────┐                      │
│  │    vexa-bot         │  │   WhisperLive  :9090  │                      │
│  │  (joins meeting,    │  │  (real-time STT)      │                      │
│  │   streams audio)    │  │                       │                      │
│  └─────────────────────┘  └───────────────────────┘                     │
└──────────────────────────────────────────────────────────────────────── ┘
            │
┌───────────▼──────────────────────────────────────────────────────────── ┐
│                         STORAGE LAYER                                    │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────────┐     │
│  │   PostgreSQL      │  │     Redis      │  │   S3 / MinIO /       │     │
│  │  (primary store)  │  │  (cache/lock)  │  │   Local FS           │     │
│  │  :5438            │  │               │  │  (recording files)   │     │
│  └──────────────────┘  └────────────────┘  └──────────────────────┘     │
└──────────────────────────────────────────────────────────────────────── ┘
```

### Component Responsibilities

| Component | Owner | Responsibility | Communicates With |
|-----------|-------|----------------|-------------------|
| **api-gateway** | Vexa | Route inbound requests; user auth (Vexa tokens) | bot-manager, transcription-collector, PostgreSQL |
| **bot-manager** | Vexa | Spawn/kill vexa-bot Docker containers on demand | Docker daemon, vexa-bot, api-gateway |
| **vexa-bot** | Vexa | Join Google Meet / Teams / Zoom; stream audio | WhisperLive (WebSocket audio stream) |
| **WhisperLive** | Vexa | Real-time speech-to-text via Whisper; stream transcript segments | transcription-collector (WebSocket), transcription-service |
| **transcription-service** | Vexa | Backend Whisper model wrapper used by WhisperLive | WhisperLive |
| **transcription-collector** | Vexa | Receive segments from WhisperLive; persist to DB | PostgreSQL, api-gateway |
| **TargetDialer API** | Us | Google OAuth, Calendar Watcher orchestration, summary endpoints, search proxy, analytics | Vexa api-gateway, PostgreSQL, Redis, AI Worker, Search Index |
| **AI Worker** | Us | Async job processor: read completed transcript, call LLM, write summary + action items back to DB | PostgreSQL, LLM API (OpenAI/Anthropic/Gemini) |
| **Calendar Watcher** | Us | Register Google Calendar webhook channels; receive push events; trigger bot creation | Google Calendar API, Vexa api-gateway, PostgreSQL |
| **Search Index Service** | Us | Maintain full-text (and optionally vector) search index over transcripts and summaries | PostgreSQL (pgvector/pg_trgm or Elasticsearch), AI Worker |
| **Web Dashboard** | Us | SPA serving meeting list, transcript viewer, summary display, search UI, analytics charts | TargetDialer API |
| **PostgreSQL** | Both | Single shared primary data store (Vexa tables + our extension tables) | All backend services |
| **Redis** | Both | Cache, distributed locks (e.g., bot dedup), job queue if using BullMQ | TargetDialer API, AI Worker |
| **S3/MinIO** | Vexa | Audio recording storage | vexa-bot, transcription-collector |

## Recommended Project Structure

```
meetrec/
├── apps/
│   ├── api/                    # TargetDialer API (Node/FastAPI)
│   │   ├── src/
│   │   │   ├── auth/           # Google OAuth, session management
│   │   │   ├── calendar/       # Calendar Watcher, webhook handlers
│   │   │   ├── meetings/       # Meeting CRUD, transcript proxy from Vexa
│   │   │   ├── summaries/      # Summary endpoints (reads from DB)
│   │   │   ├── search/         # Search endpoint, query router
│   │   │   └── analytics/      # Aggregation endpoints for dashboard
│   │   └── Dockerfile
│   ├── worker/                 # AI Worker (separate process)
│   │   ├── src/
│   │   │   ├── jobs/
│   │   │   │   ├── summarize.ts       # LLM summary generation job
│   │   │   │   ├── extract-actions.ts # Action item extraction job
│   │   │   │   └── index-transcript.ts # Search indexing job
│   │   │   ├── prompts/        # LLM prompt templates
│   │   │   └── queue.ts        # Job queue setup (BullMQ/Celery)
│   │   └── Dockerfile
│   └── web/                    # React/Next.js dashboard
│       ├── src/
│       │   ├── pages/          # Next.js pages (meetings, meeting detail, search)
│       │   ├── components/     # UI components
│       │   └── lib/            # API client, auth hooks
│       └── Dockerfile
├── packages/
│   └── db/                     # Shared DB schema, migrations (Drizzle/Prisma)
│       ├── schema/
│       │   ├── vexa-ext.ts     # Our extension tables alongside Vexa's
│       │   └── migrations/
│       └── index.ts
├── docker-compose.yml          # Extends Vexa's services + adds ours
└── .env.example
```

### Structure Rationale

- **apps/api:** Separate from Vexa's api-gateway; we do not fork Vexa — we call it via HTTP. Our API owns all TargetDial-specific logic.
- **apps/worker:** Long-running async process kept separate from API so LLM latency (5-30s per meeting) does not block HTTP responses.
- **apps/web:** Decoupled SPA; can be deployed independently.
- **packages/db:** Schema colocated gives migrations a single home. Vexa and our code share the same Postgres instance but distinct tables.

## Architectural Patterns

### Pattern 1: Event-Triggered Async AI Processing

**What:** Meeting end event (polled or webhook) enqueues a job; AI Worker processes it asynchronously outside the request cycle.

**When to use:** Any time an operation takes more than 500ms (LLM calls, large transcript processing). Never do LLM work inline in an HTTP handler.

**Trade-offs:** Adds queue infrastructure; client needs polling or SSE to get notified when summary is ready. Worth it because LLM latency is variable (2-60s).

**Example:**
```typescript
// In API — meeting_end webhook handler
app.post('/webhook/meeting-end', async (req, res) => {
  const { meetingId } = req.body;
  await summaryQueue.add('generate-summary', { meetingId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });
  res.status(202).json({ status: 'queued' });
});

// In Worker — job processor
summaryQueue.process('generate-summary', async (job) => {
  const transcript = await db.query.transcripts.findMany({
    where: eq(transcripts.meetingId, job.data.meetingId)
  });
  const summary = await llm.complete(buildSummaryPrompt(transcript));
  await db.insert(summaries).values({ meetingId: job.data.meetingId, ...summary });
  await searchIndex.index(job.data.meetingId, transcript, summary);
});
```

### Pattern 2: Vexa as Internal Service (Not Forked)

**What:** Call Vexa's api-gateway via HTTP from our API. Never modify Vexa source code; treat it as a black-box dependency.

**When to use:** Always. This is the integration boundary.

**Trade-offs:** Slight network overhead for internal calls. Benefit: Vexa upgrades without merge conflicts.

**Example:**
```typescript
// vexaClient.ts — wrapper around Vexa API
export class VexaClient {
  private base = process.env.VEXA_API_URL; // http://api-gateway:8056
  private token = process.env.VEXA_API_TOKEN;

  async startBot(meetingUrl: string, userId: string) {
    return fetch(`${this.base}/bots`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ meeting_url: meetingUrl, user_id: userId })
    });
  }

  async getTranscript(meetingId: string) {
    return fetch(`${this.base}/transcripts/${meetingId}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
  }
}
```

### Pattern 3: Database Extension (Not Replacement)

**What:** Add TargetDial-specific tables alongside Vexa's tables in the same PostgreSQL instance. Use Vexa's meeting/transcript IDs as foreign keys.

**When to use:** This is the data architecture for all new features — summaries, action items, calendar subscriptions, user preferences.

**Trade-offs:** Tight coupling to Vexa's schema; a Vexa schema migration could break foreign keys. Mitigate by only referencing stable IDs, not volatile columns.

**Example schema additions:**
```sql
-- Our extension tables reference Vexa's meetings table by ID
CREATE TABLE td_summaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  TEXT NOT NULL,  -- foreign key to Vexa's meetings.id
  created_at  TIMESTAMPTZ DEFAULT now(),
  bullet_json JSONB,          -- { bullets: [], action_items: [], decisions: [] }
  raw_text    TEXT,
  model_used  TEXT,
  status      TEXT DEFAULT 'pending'  -- pending | complete | failed
);

CREATE TABLE td_calendar_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  google_channel_id TEXT UNIQUE,
  resource_id    TEXT,
  expires_at     TIMESTAMPTZ,
  calendar_id    TEXT NOT NULL
);
```

### Pattern 4: Google Calendar Watcher with Proactive Renewal

**What:** Register webhook channels via `calendar.events.watch`. Store expiration timestamp in DB. Background cron renews channels 24h before they expire (Google max TTL is 1 week).

**When to use:** Whenever tracking Google Calendar for automatic bot trigger.

**Trade-offs:** Requires HTTPS endpoint accessible to Google (use ngrok in dev). Cron must run reliably.

**Example:**
```typescript
// Renewal cron — runs every 6 hours
async function renewExpiringChannels() {
  const expiringSoon = await db.query.calendarSubscriptions.findMany({
    where: lt(calendarSubscriptions.expiresAt, addHours(new Date(), 24))
  });
  for (const sub of expiringSoon) {
    const newChannel = await googleCalendar.events.watch({
      calendarId: sub.calendarId,
      requestBody: {
        id: crypto.randomUUID(),
        type: 'web_hook',
        address: `${process.env.PUBLIC_URL}/webhook/calendar`,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    await db.update(calendarSubscriptions)
      .set({ googleChannelId: newChannel.id, expiresAt: new Date(+newChannel.expiration) })
      .where(eq(calendarSubscriptions.id, sub.id));
  }
}
```

## Data Flow

### Primary Flow: "Meeting Starts" to "Summary Available in Dashboard"

```
1. CALENDAR TRIGGER
   Google Calendar API
       │ push notification (X-Goog-Resource-State: exists)
       ▼
   Calendar Watcher (our service)
       │ parse event, check if meeting URL present
       │ POST /bots to Vexa api-gateway
       ▼

2. BOT JOINS
   Vexa api-gateway
       │ route to bot-manager
       ▼
   bot-manager
       │ spawn vexa-bot Docker container
       ▼
   vexa-bot
       │ joins Google Meet / Teams / Zoom
       │ captures audio
       │ streams audio frames via WebSocket
       ▼

3. REAL-TIME TRANSCRIPTION (during meeting)
   WhisperLive :9090
       │ receives audio WebSocket stream from vexa-bot
       │ runs Whisper inference (transcription-service backend)
       │ emits transcript segments via WebSocket
       ▼
   transcription-collector
       │ receives segments
       │ persists to PostgreSQL (vexa transcripts table)
       ▼
   PostgreSQL (transcripts available for real-time read)

4. DASHBOARD LIVE VIEW (optional, during meeting)
   Web Dashboard
       │ polls or subscribes via WebSocket to TargetDialer API
       ▼
   TargetDialer API
       │ proxies transcript reads from Vexa api-gateway
       ▼
   User sees live transcript in browser

5. MEETING ENDS
   vexa-bot detects meeting end
       │ signals bot-manager
       ▼
   bot-manager marks meeting complete in PostgreSQL
       │
   TargetDialer API (either polls Vexa for status, or Vexa webhook)
       │ enqueues AI Worker job
       ▼

6. AI PROCESSING (async, post-meeting)
   AI Worker job queue (BullMQ / Redis)
       │ dequeues summarize job
       ▼
   AI Worker
       │ reads full transcript from PostgreSQL via Vexa api-gateway
       │ calls LLM API (OpenAI / Gemini)
       │ receives: summary bullets, action items, decisions
       │ writes td_summaries row to PostgreSQL
       │ enqueues search indexing job
       ▼

7. SEARCH INDEXING (async, post-summary)
   Search Index Job
       │ reads transcript + summary from PostgreSQL
       │ updates tsvector / pgvector / Elasticsearch index
       ▼
   Search index ready

8. DASHBOARD VIEW (post-meeting)
   User opens meeting in Web Dashboard
       │
   Web Dashboard
       │ GET /meetings/:id/summary → TargetDialer API
       ▼
   TargetDialer API
       │ reads td_summaries from PostgreSQL
       │ returns summary JSON
       ▼
   User sees: summary bullets, action items, searchable transcript
```

### Key Data Flows Summary

1. **Calendar to Bot:** Google push notification → Calendar Watcher → Vexa bot creation API
2. **Audio to Transcript:** vexa-bot → WhisperLive → transcription-collector → PostgreSQL
3. **Transcript to Summary:** Meeting end event → AI Worker queue → LLM → td_summaries table
4. **Summary to User:** HTTP GET → TargetDialer API → PostgreSQL → Web Dashboard
5. **Search:** User query → TargetDialer API → PostgreSQL FTS or Elasticsearch → ranked results

## Suggested Build Order

Build order follows data flow dependencies. A component cannot be built until the components it depends on are in place.

```
Phase 1: Foundation
  Vexa running locally (docker-compose)
  TargetDialer API scaffold (bare Express/FastAPI)
  PostgreSQL migration tooling (Drizzle/Prisma)
  Google OAuth (needed by all user-facing features)

Phase 2: Core Meeting Flow
  VexaClient wrapper in TargetDialer API
  Calendar Watcher service (watch → bot start)
  Meeting list endpoint (proxy Vexa meetings)
  Basic Web Dashboard (login, meeting list)

Phase 3: AI Processing
  AI Worker service + job queue (Redis/BullMQ)
  LLM summarization job
  td_summaries schema + migration
  Summary display in Web Dashboard

Phase 4: Search
  Search indexing job in AI Worker
  PostgreSQL FTS indexes (tsvector) or Elasticsearch setup
  Search endpoint in TargetDialer API
  Search UI in Web Dashboard

Phase 5: Analytics
  Analytics aggregation queries
  Analytics endpoints
  Analytics dashboard views
```

**Dependency rules:**
- Google OAuth must precede any authenticated feature
- VexaClient must precede Calendar Watcher (can't start bots without it)
- Meeting transcripts in PostgreSQL must precede AI Worker (nothing to summarize yet)
- AI Worker summaries must precede Search indexing (summary content is indexed)

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-20 users (internal team) | Single docker-compose on one server; shared PostgreSQL; single AI Worker process; no CDN needed |
| 20-200 users | Add read replica for analytics queries; separate AI Worker to its own container; add Redis if not already present; add APM monitoring |
| 200-2000 users | WhisperLive needs GPU server or scale-out (multiple instances behind load balancer); AI Worker scales horizontally; search may need Elasticsearch if FTS degrades |
| 2000+ users | Separate PostgreSQL instances (Vexa vs TargetDial); Kubernetes orchestration; dedicated Whisper GPU cluster; separate search cluster |

### Scaling Priorities

1. **First bottleneck:** WhisperLive (GPU-bound; one instance per meeting in progress). At >5 concurrent meetings, need multiple WhisperLive instances or remote GPU service.
2. **Second bottleneck:** LLM summarization rate limits (API keys have TPM limits). Mitigate by distributing across multiple API keys or using a self-hosted model.
3. **Third bottleneck:** PostgreSQL read contention as meeting history grows. Mitigate with read replicas and search offloaded to dedicated index.

## Anti-Patterns

### Anti-Pattern 1: Forking Vexa

**What people do:** Modify Vexa's source code directly to add summary fields, new endpoints, or auth changes.
**Why it's wrong:** Merging upstream Vexa updates becomes a manual diff exercise. Breaking changes in Vexa internals require re-patching every custom addition.
**Do this instead:** Treat Vexa as an external service. Call it via its API. Add all custom logic in TargetDialer API and Worker. Use the extension table pattern for data.

### Anti-Pattern 2: Synchronous LLM in HTTP Request

**What people do:** POST /meetings/:id/summarize → call OpenAI inline → return summary in response.
**Why it's wrong:** LLM calls take 5-30 seconds. HTTP timeouts. User left waiting. Retries on failure are complex. Load spikes cause cascading failures.
**Do this instead:** Enqueue job on meeting end. Return 202 Accepted. Poll for status or use Server-Sent Events to notify when complete.

### Anti-Pattern 3: Polling Vexa for Transcript Instead of Reading DB

**What people do:** Hit Vexa's `/transcripts/:id` REST endpoint every time AI Worker needs a transcript.
**Why it's wrong:** Adds unnecessary latency; Vexa api-gateway is not designed for bulk internal reads; coupling to Vexa's API for internal workflows.
**Do this instead:** AI Worker reads transcript directly from the shared PostgreSQL database (same instance). Skip the HTTP round-trip for internal jobs.

### Anti-Pattern 4: One LLM Call for the Whole Transcript

**What people do:** Concatenate entire transcript into one LLM prompt. Hit context limit on long meetings. Quality degrades on 2-hour calls.
**Why it's wrong:** 90-minute meetings at 150 WPM = ~13,500 tokens of transcript. With GPT-4o's context window this fits, but quality degrades with distance. Cost is also linear with meeting length.
**Do this instead:** Chunk transcript into 15-minute segments, summarize each, then synthesize a final summary from segment summaries. Cost-effective and maintains quality.

### Anti-Pattern 5: Building a Custom Google Calendar Poller

**What people do:** Cron job that fetches `/calendar/v3/calendars/primary/events` every minute to detect new meetings.
**Why it's wrong:** Wastes API quota. Adds delay (up to 1 minute). Google can rate-limit aggressive polling.
**Do this instead:** Use Google Calendar push notifications (watch API). Near-instant delivery. Much lower quota consumption.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google OAuth 2.0 | OAuth 2.0 PKCE flow; store refresh tokens encrypted in PostgreSQL | Scope needed: `calendar.readonly`, `userinfo.email` |
| Google Calendar API | Push watch channel with HTTPS callback; renew weekly | Store channel metadata with expiration; background renewal cron |
| OpenAI / Anthropic / Gemini | REST API in AI Worker only; never from API or web layer | Use structured output (JSON mode) for summary schema |
| Vexa api-gateway | Internal HTTP from TargetDialer API only; admin token auth | `VEXA_INTERNAL_TOKEN` env var; never expose Vexa directly to browser |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web Dashboard ↔ TargetDialer API | REST + optional WebSocket for live transcript | Never call Vexa directly from browser |
| TargetDialer API ↔ Vexa api-gateway | Internal HTTP; same Docker network | Keep VexaClient as single abstraction |
| TargetDialer API ↔ AI Worker | Redis job queue (BullMQ recommended) | API enqueues, Worker processes; decoupled |
| AI Worker ↔ PostgreSQL | Direct connection (shared DB); bypass Vexa API for reads | Faster for bulk transcript reads |
| Calendar Watcher ↔ Google | HTTPS webhook; must be publicly reachable | Use tunnel (ngrok) in dev; real HTTPS in prod |

## Sources

- Vexa GitHub repository structure and README: [github.com/Vexa-ai/vexa](https://github.com/Vexa-ai/vexa) — MEDIUM confidence (inferred from public structure; not all internal contracts documented)
- Vexa service ports and communication: Community discovery via [deepwiki.com/Vexa-ai/vexa](https://deepwiki.com/Vexa-ai/vexa) — MEDIUM confidence
- Google Calendar push notifications official docs: [developers.google.com/workspace/calendar/api/guides/push](https://developers.google.com/workspace/calendar/api/guides/push) — HIGH confidence
- Google Calendar webhook renewal pattern: [lorisleiva.com/google-calendar-integration/webhook-synchronizations](https://lorisleiva.com/google-calendar-integration/webhook-synchronizations) — MEDIUM confidence (verified against official docs)
- Async LLM pipeline pattern (5 Patterns for Scalable LLM Service Integration): [latitude.so/blog/5-patterns-for-scalable-llm-service-integration](https://latitude.so/blog/5-patterns-for-scalable-llm-service-integration) — LOW confidence (single source, not cross-verified with official docs; pattern is sound)
- PostgreSQL FTS vs Elasticsearch (Instacart case study): [infoq.com/news/2025/08/instacart-elasticsearch-postgres](https://www.infoq.com/news/2025/08/instacart-elasticsearch-postgres) — MEDIUM confidence
- Real-time transcription WebSocket patterns: [assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription) — MEDIUM confidence

---
*Architecture research for: Meeting intelligence platform (TargetDialer) on Vexa*
*Researched: 2026-02-23*
