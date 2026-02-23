# Project Research Summary

**Project:** TargetDialer (MeetRec) — internal meeting intelligence platform
**Domain:** Meeting intelligence / AI notetaker built on Vexa infrastructure
**Researched:** 2026-02-23
**Confidence:** MEDIUM

## Executive Summary

TargetDialer is an internal meeting intelligence platform for a team of 5-20 at TargetDial, replacing Fireflies.ai by building on top of Vexa — an open-source meeting bot and real-time transcription stack. Vexa handles the hardest infrastructure problems (bot joining, audio capture, speech-to-text via WhisperLive, speaker diarization), which means the application layer's job is to wire calendar auto-join, own the transcript data, generate AI summaries, provide search, and surface analytics. The recommended architecture is a two-service system: a Next.js 16 app for the dashboard and API routes, and a Python FastAPI service that extends Vexa's existing Python/PostgreSQL ecosystem. A Redis-backed async job queue (ARQ) handles LLM summary generation outside the HTTP request path.

The primary differentiator for this product is the analytics dashboard and flexible AI provider support — features that Fireflies.ai places behind a paywall. The market has commoditized basic recording + transcription + summarization, so TargetDialer's strategic emphasis should be on analytics depth (speaker talk-time, topic trends, org-level patterns) and a clean, well-integrated internal tool experience. The feature scope for v1 is deliberately tight: full-featured analytics and AI Q&A over meeting history (RAG) belong in v2 once the core pipeline is stable and trusted by the team.

The critical risk cluster is reliability: Vexa has documented bugs around bot audio capture failure appearing as success, transcript data inconsistency from session_uid mismatches, and calendar webhook channels silently expiring after one week. Every one of these manifests as a silent failure that erodes user trust. The mitigation pattern is consistent across all of them: own your data early, implement health checks that gate on actual data arrival (not status flags), and build proactive renewal/alert mechanisms into Phase 1 — not as follow-up hardening.

---

## Key Findings

### Recommended Stack

The stack is a deliberate two-service architecture. The Next.js 16 frontend handles the dashboard, auth, and API routes via Drizzle ORM directly to the shared PostgreSQL instance. The Python FastAPI service extends Vexa's native ecosystem, consumes Vexa webhooks, and drives async AI processing via ARQ over Redis. This co-location with Vexa's Python/PostgreSQL stack eliminates a serialization boundary and enables direct DB reads in the AI Worker — critical for avoiding the Vexa API polling anti-pattern. Vercel AI SDK v6 provides provider-agnostic LLM access from the Next.js layer, handling the flexible AI provider requirement with a two-line config swap. See `STACK.md` for full details.

**Core technologies:**
- Next.js 16 (App Router): Full-stack framework for dashboard UI and BFF API routes — server components for initial data load, client components for real-time updates
- Python 3.12 / FastAPI 0.115+: Integration layer for Vexa — same language/ecosystem means shared models and direct DB access; ARQ for async AI job processing
- PostgreSQL 16: Single shared instance with Vexa; extension tables use Vexa meeting IDs as foreign keys; GIN indexes for full-text search from day one
- Redis 7: ARQ job queue backing store for post-meeting AI summary jobs; also used for rate limiting and analytics cache
- Vercel AI SDK v6: Provider-agnostic LLM calls (Claude, OpenAI, Groq, Ollama) with a single unified API; `generateObject` + Zod enforces structured summary output
- Auth.js v5 (NextAuth beta): Google OAuth with Calendar API scope requested in a single flow — no second auth prompt for calendar access
- Drizzle ORM 0.38+: TypeScript-safe PostgreSQL access from Next.js; lightweight, no binary engine, SQL-close API

**Watch:** Auth.js v5 has reported peer dependency conflicts with Next.js 16.0 — use `--legacy-peer-deps` or pin to Next.js 15.5 LTS if unresolved at project start.

### Expected Features

The feature landscape research confirmed that basic transcription + summary is now table stakes. The differentiation window is analytics and search quality — exactly what TargetDialer is positioned to exploit since Fireflies.ai paywalls those features.

**Must have (table stakes for v1 — replaces Fireflies):**
- Google OAuth login — root dependency for everything
- Google Calendar auto-join — bot appears without manual action; core value proposition
- Real-time transcription display — live transcript streamed to browser via WebSocket/SSE
- Speaker diarization — labeled transcript with speaker attribution
- Post-meeting AI summary — generated async after meeting ends; flexible LLM provider
- Action items extraction — structured list, not buried in prose; separate LLM prompt
- Key decisions extraction — explicit field parallel to action items
- Meeting archive / list view — browsable history with date, participants, duration
- Full-text search over transcripts — keyword search with PostgreSQL GIN indexes
- Audio playback with timestamp navigation — click transcript line, seek to that moment
- Share meeting link — authenticated URL for org members who missed the call
- Basic per-meeting analytics — speaker talk-time %, meeting duration, participant count

**Should have (v1.x — after team validates daily use):**
- Slack notification after each meeting — post summary + action items to a channel
- Custom summary templates — per-meeting-type prompts (standup, design review, 1:1)
- Keyword / topic trackers — flag meetings where specific terms appeared
- Org-level analytics / trends — topic frequency, speaker patterns across all meetings
- Smart follow-up email draft — one-click draft from summary context

**Defer (v2+):**
- AI Q&A over meeting history (RAG) — requires stable embedding infrastructure; high complexity
- Meeting clips / video highlights — requires video recording pipeline and storage
- Multi-language transcription — investigate Vexa capability first before building UI
- In-meeting live notes panel — adds a new UI surface; defer until core is stable
- Agenda integration — map discussion to pre-defined agenda items

**Explicit anti-features (do not build):** CRM sync, video recording storage, mobile recording app, enterprise SSO/SAML, white-labeling.

### Architecture Approach

The architecture is a layered extension model: Vexa runs as an internal black-box service (never forked), and TargetDialer adds three components on top — an API service, an AI Worker, and a Web Dashboard — all sharing the same PostgreSQL instance via extension tables. The Calendar Watcher lives inside the API service and drives Vexa bot creation through Vexa's api-gateway. The AI Worker is a separate long-running process that reads from the shared DB directly (bypassing Vexa's REST API), calls the LLM, writes results to extension tables, and triggers search indexing. This separation keeps LLM latency (5-30s) entirely out of the HTTP request path. See `ARCHITECTURE.md` for full diagrams and data flow.

**Major components:**
1. **Web Dashboard (Next.js 16)** — meeting list, transcript viewer, summary display, search UI, analytics charts; never calls Vexa directly
2. **TargetDialer API (FastAPI)** — Google OAuth, Calendar Watcher orchestration, summary/search/analytics endpoints; single point of contact with Vexa api-gateway
3. **AI Worker (ARQ + FastAPI)** — async job processor: reads transcript from shared DB, calls LLM (summary + action items + decisions), writes to `td_summaries`, enqueues search indexing
4. **Calendar Watcher (inside API)** — registers Google Calendar webhook channels, receives push events, triggers Vexa bot creation; maintains renewal cron for weekly channel re-registration
5. **Vexa (existing)** — api-gateway, bot-manager, vexa-bot, WhisperLive, transcription-collector; treated as an external service
6. **PostgreSQL (shared)** — Vexa tables plus TargetDialer extension tables (`td_summaries`, `td_calendar_subscriptions`, etc.); GIN indexes on transcript content

### Critical Pitfalls

1. **Bot reaches ACTIVE but captures no audio** — Gate the "meeting joined" success state on the first transcript segment arriving, not on bot status. Implement a 3-minute health check: if ACTIVE with zero segments, trigger a restart and alert. (Phase 1)

2. **Transcript data loss from session_uid mismatch** — Own transcript data by streaming it to your own DB via WebSocket as it arrives. Never treat Vexa's `GET /transcripts/{session_uid}` as the sole source of truth. Use your own primary keys; treat `session_uid` as a foreign reference only. (Phase 1)

3. **Google Calendar webhook channel expiration — silent missed meetings** — Store channel expiration timestamp in the DB. Run a renewal job every 24 hours that re-registers channels expiring within 48 hours. Maintain a fallback hourly Calendar poll as a safety net. (Phase 1)

4. **AI summary hallucination** — Prompt explicitly: "only include information present in the transcript." Use temperature 0.2-0.4. Flag summaries from transcripts shorter than 500 tokens or with >20% `[inaudible]` markers as "low confidence." Extract action items with a separate stricter prompt requiring an explicit person + deliverable. (Phase 2)

5. **LLM context window overflow for long meetings** — Chunk transcripts at 15-minute segments, summarize each, then synthesize via map-reduce prompt. Implement this before launch — do not test only with 30-minute meetings. (Phase 2)

---

## Implications for Roadmap

Architecture research directly suggests a 5-phase build order that follows data flow dependencies. No phase can be built until the components it depends on are complete.

### Phase 1: Foundation and Bot Integration

**Rationale:** Google OAuth is the root dependency for everything. Vexa must run locally before any meeting data exists. Schema design — especially GIN indexes and the extension table structure — must be established before any real meetings are processed, because retrofitting indexes onto large tables is operationally painful. All the "never" shortcuts in the technical debt table belong here: no deferred indexing, no later-added retention policies, no afterthought transcript ownership.

**Delivers:** A working system where a team member logs in with Google, their calendar is monitored, a Vexa bot auto-joins scheduled Google Meet calls, transcripts are streamed and stored in the TargetDialer DB, and the basic meeting list is visible in the dashboard.

**Addresses (from FEATURES.md):** Google OAuth, Calendar auto-join, real-time transcription display, speaker diarization display, meeting archive/list, meeting participant list

**Avoids (from PITFALLS.md):**
- Bot audio capture failure (health check on first transcript segment)
- Transcript session_uid mismatch (own data via WebSocket stream)
- Calendar webhook expiration (renewal job + fallback polling)
- OAuth refresh token expiration (graceful refresh handler + re-auth UX)
- Transcript normalization for Whisper repetition artifact
- Mutable vs finalized transcript distinction (WebSocket for live display, REST API for stored canonical)
- Storage lifecycle (S3/MinIO retention rules before first real meeting)
- Search schema (GIN indexes created before any data is inserted)
- Zoom deprioritization decision documented (Google Meet only for v1)

**Research flag:** NEEDS RESEARCH — Vexa's exact webhook/event mechanism for meeting-end detection is not fully documented publicly. Research the specific endpoint or polling strategy before implementation.

### Phase 2: AI Processing Pipeline

**Rationale:** Meeting transcripts must exist in the DB before the AI Worker has anything to process. The async job queue must be implemented before any LLM calls, because synchronous LLM in HTTP is an explicit anti-pattern. Prompt engineering and confidence flagging must be in the initial summary implementation — hallucination mitigation is not a post-launch refinement.

**Delivers:** Post-meeting AI summaries, action items, and key decisions available in the dashboard within minutes of meeting end. Configurable LLM provider via environment variable.

**Addresses (from FEATURES.md):** Post-meeting AI summary, action items extraction, key decisions extraction, flexible AI provider, audio playback with timestamp navigation

**Uses (from STACK.md):** ARQ job queue, Vercel AI SDK `generateObject` with Zod schema, Redis for job queue backing store

**Implements (from ARCHITECTURE.md):** AI Worker service, `td_summaries` extension table, async event-triggered processing pattern

**Avoids (from PITFALLS.md):**
- AI summary hallucination (grounded prompt, low temperature, confidence flags)
- LLM context window overflow (chunked 15-minute segment summarization with map-reduce)
- LLM cost monitoring (token tracking per meeting from day one)

**Research flag:** STANDARD PATTERNS — async LLM processing with job queues is well-documented. Prompt engineering for meeting summarization has established patterns. No deep research phase needed; validate prompt quality empirically against team's real meetings.

### Phase 3: Search

**Rationale:** Search depends on summaries being complete (the indexed content includes summary bullets and action items, not just raw transcript). The GIN index infrastructure was set up in Phase 1; this phase wires the search endpoint and UI to it.

**Delivers:** Full-text keyword search across all meeting transcripts and summaries. Users can answer "what did we say about pricing last month?" in under one second.

**Addresses (from FEATURES.md):** Full-text search over transcripts, searchable meeting archive

**Implements (from ARCHITECTURE.md):** Search indexing job in AI Worker (triggered after summary is written), search endpoint in TargetDialer API, search UI in Web Dashboard

**Avoids (from PITFALLS.md):** Search degradation at scale (GIN index already in place; this phase validates `EXPLAIN ANALYZE` shows index usage)

**Research flag:** STANDARD PATTERNS — PostgreSQL FTS with `tsvector` / `GIN` is well-documented. No research phase needed.

### Phase 4: Analytics Dashboard

**Rationale:** Analytics requires a populated meeting archive with structured metadata — speaker labels, action items, decisions, and topic data. All of that becomes available only after Phase 2 is running and the team has accumulated real meetings. Building analytics before data exists creates a demo-only feature with no validation signal.

**Delivers:** Per-meeting speaker talk-time %, meeting duration trends, participant counts. Basic analytics visible for each meeting; foundation for org-level trends in v1.x.

**Addresses (from FEATURES.md):** Basic per-meeting analytics, speaker stats, meeting coaching / talk-time feedback (per-meeting), share meeting link

**Avoids (from PITFALLS.md):** Speaker diarization accuracy — display as "approximate," provide correction UI before analytics depend on it; analytics built on corrected speaker data, not raw labels

**Research flag:** STANDARD PATTERNS — aggregation queries and charting with Recharts are well-documented. No research phase needed.

### Phase 5: v1.x Enhancements

**Rationale:** After the team is using the tool daily and trust in the core pipeline is established, add the workflow integrations and org-level analytics that increase stickiness and surface the most value from accumulated meeting history.

**Delivers:** Slack notifications after meetings, custom summary templates per meeting type, keyword/topic trackers, org-level trend analytics across all meetings, follow-up email drafts.

**Addresses (from FEATURES.md):** All "Should have (v1.x)" features

**Avoids (from PITFALLS.md):** Anti-features scope creep — CRM sync, video recording, SAML remain explicitly out of scope

**Research flag:** NEEDS RESEARCH for Slack webhook integration patterns and keyword/topic extraction approach (keyword scan vs. LLM classification tradeoffs at small scale).

### Phase Ordering Rationale

- Google OAuth precedes every authenticated feature — it is the literal root node in the feature dependency graph
- Vexa integration must come before calendar watcher (can't start bots without VexaClient)
- Transcript storage must precede AI Worker (nothing to summarize without data)
- AI Worker summaries must precede search indexing (summary content is indexed alongside transcripts)
- Populated meeting archive must precede analytics (trends require accumulated historical data)
- All Phase 1 pitfall mitigations must be in place before real team meetings are processed — recovery from silent failures (missed meetings, lost transcripts) requires re-ingestion from external recordings, which may not be available

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Vexa's exact meeting-end detection mechanism (webhook vs. polling). The Vexa API contract for this event is not fully documented publicly — confirm before coding the AI Worker trigger.
- **Phase 5:** Keyword/topic extraction strategy for topic trackers. LLM classification vs. keyword scan has meaningful tradeoffs at 100-1,000 meetings/month scale that need a concrete recommendation.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Async LLM processing, ARQ job queue, Vercel AI SDK structured output — established patterns, extensive documentation
- **Phase 3:** PostgreSQL FTS with GIN indexes — well-documented, confirmed sufficient at TargetDial scale
- **Phase 4:** Analytics aggregation queries and Recharts visualization — standard React/PG patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core technologies (Next.js, FastAPI, PostgreSQL, Redis, Vercel AI SDK) verified via official docs and current sources. Auth.js v5 + Next.js 16 peer dependency conflict is a live issue — verify at project start. Vexa-specific integration patterns are MEDIUM (no dedicated "build on top" guide exists). |
| Features | MEDIUM | Feature landscape derived from editorial and vendor sources, not usage data. The prioritization (v1 / v1.x / v2+) is well-reasoned from the dependency graph and competitive analysis. The decision to skip CRM sync, video storage, and SAML is high-confidence given the stated use case. |
| Architecture | MEDIUM | Vexa's internal service contracts inferred from public repo structure and community sources. The extension table pattern and "never fork Vexa" rule are high-confidence design decisions. Exact meeting-end event mechanism needs confirmation against Vexa's actual API. |
| Pitfalls | MEDIUM | Pitfalls sourced from Vexa GitHub issues (MEDIUM), Google Calendar official docs (HIGH for webhook behavior), and community sources (MEDIUM). The bot reliability pitfalls (audio capture failure, session_uid mismatch) are documented Vexa bugs — these are concrete, not speculative. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Vexa meeting-end event mechanism:** Confirm whether Vexa emits a webhook/callback when a meeting ends or if the AI Worker must poll for meeting status changes. This determines the exact trigger architecture in Phase 1-2. Address in Phase 1 planning or during Vexa environment setup.

- **Auth.js v5 + Next.js 16 compatibility:** A reported GitHub issue documents peer dependency conflicts. Confirm resolution status at project start. Fallback: pin to Next.js 15.5 LTS until Auth.js publishes stable v5 support.

- **Vexa diarization API contract:** Speaker diarization was added in Vexa v0.4. The exact format of speaker labels in the transcript output is inferred, not confirmed from docs. Verify format during Phase 1 implementation before building any speaker-dependent UI or analytics.

- **Audio storage architecture:** Vexa stores audio in S3/MinIO. Whether TargetDialer needs independent audio access (for playback) or can proxy through Vexa's endpoints needs to be resolved in Phase 1. This affects whether a direct S3 lifecycle policy is TargetDialer's responsibility or Vexa's.

- **Vexa version to deploy:** Research references v0.4.1 (critical bug fix for audio capture) and v0.6 (Teams support). Deploy v0.4.1 or later as the minimum; validate that the specific audio capture and session_uid bugs are resolved in the chosen version.

---

## Sources

### Primary (HIGH confidence)
- Next.js 16.1 release blog (https://nextjs.org/blog/next-16) — App Router, Turbopack stable, version confirmed
- Google Calendar push notifications official docs (https://developers.google.com/workspace/calendar/api/guides/push) — webhook channel expiration, renewal behavior
- Vercel AI SDK npm page (https://www.npmjs.com/package/ai) — v6.0.97 current version confirmed

### Secondary (MEDIUM confidence)
- Vexa GitHub repository (https://github.com/Vexa-ai/vexa) — architecture, API endpoints, PostgreSQL + Docker stack
- Vexa GitHub issues (https://github.com/Vexa-ai/vexa/issues) — bot lifecycle failures (#115), session_uid mismatch (#96), Whisper repetition (#104)
- Vexa release notes (https://github.com/Vexa-ai/vexa/releases) — v0.3.2 resilience upgrades, v0.4.1 critical bug fix, v0.6 Teams support
- Deepwiki Vexa community docs (https://deepwiki.com/Vexa-ai/vexa) — service ports and communication patterns
- Recall.ai FAQ (https://docs.recall.ai/docs/google-meet-faq) — bot waiting room 8-minute timeout, host admission requirement
- WhisperX diarization accuracy (https://github.com/m-bain/whisperX) — 20-40% error rates in challenging conditions
- Krisp.ai / AssemblyAI feature roundups — meeting intelligence tool feature landscape
- Fireflies.ai, Fathom, Grain, tl;dv, Otter.ai official product pages — competitor feature analysis
- Auth.js Next.js 16 compatibility issue (https://github.com/nextauthjs/next-auth/issues/13302) — peer dependency conflict flagged
- Drizzle vs Prisma comparison (https://www.bytebase.com/blog/drizzle-vs-prisma/) — Drizzle recommended for this architecture
- LLM hallucination in summarization (https://www.nature.com/articles/s41598-025-31075-1) — 1-23% rate depending on domain

### Tertiary (LOW confidence)
- ARQ vs Celery comparison (https://medium.com/@komalbaparmar007/fastapi-background-tasks-vs-celery-vs-arq) — single source; recommendation is sound but verify against ARQ current docs
- LangChain vs Vercel AI SDK comparison (https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide) — Vercel AI SDK preferred for Next.js; LangChain rejection rationale is strong
- Async LLM pipeline patterns (https://latitude.so/blog/5-patterns-for-scalable-llm-service-integration) — pattern is sound, single source

---

*Research completed: 2026-02-23*
*Ready for roadmap: yes*
