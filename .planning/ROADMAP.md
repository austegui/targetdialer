# Roadmap: TargetDialer

## Overview

TargetDialer replaces Fireflies.ai by building a meeting intelligence layer on top of Vexa. The build follows strict data-flow dependencies: authentication and transcript ownership must exist before anything can be summarized, summaries must exist before search can index them, and a populated archive with validated speaker data must exist before analytics become meaningful. Five phases deliver a complete internal tool — bot joins, transcribes, summarizes, is searchable, and surfaces usage patterns.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Google OAuth, Vexa integration, calendar auto-join, transcript ownership, and all reliability mitigations
- [ ] **Phase 2: AI Processing Pipeline** - Async post-meeting summaries with action items, key decisions, confidence flagging, and configurable LLM provider
- [ ] **Phase 3: Search & Archive** - Full-text search across transcripts and summaries, meeting list with filters, and audio playback
- [ ] **Phase 4: Analytics Dashboard** - Per-meeting and org-level stats including speaker talk-time, topic trends, and engagement patterns
- [ ] **Phase 5: Integrations** - Slack notifications after meetings, completing v1 feature parity with Fireflies.ai

## Phase Details

### Phase 1: Foundation
**Goal**: The team can log in with Google, the system watches their calendar, a Vexa bot auto-joins every scheduled Google Meet, and transcripts are owned and stored in TargetDialer's database — with all silent-failure mitigations in place before the first real meeting is processed.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, CAL-01, CAL-02, CAL-03, CAL-04, REC-01, REC-02, REC-03
**Success Criteria** (what must be TRUE):
  1. A team member can sign in with their Google Workspace account and see the meeting dashboard; an admin can access team settings that a regular member cannot.
  2. The system detects a new Google Meet event on the team calendar within minutes of creation and automatically dispatches a Vexa bot to join at the scheduled time — without any manual action.
  3. A background job renews Google Calendar webhook channels every 24 hours, so channels expiring within 48 hours are re-registered before they lapse — confirmed by a log entry after each renewal run.
  4. After a meeting ends, the full transcript (with timestamps and speaker labels) is stored in TargetDialer's own database, not dependent on Vexa's retention.
  5. If a Vexa bot reports ACTIVE status but no transcript segments arrive within 3 minutes, an automatic health check triggers a restart and logs an alert.
**Plans**: TBD

Plans:
- [ ] 01-01: Project scaffold, Docker Compose for Vexa + TargetDialer services, PostgreSQL schema with GIN indexes and extension tables
- [ ] 01-02: Google OAuth via Auth.js v5 with Calendar API scope, role-based access (admin / member)
- [ ] 01-03: Calendar Watcher — Google Calendar webhook registration, meeting detection, webhook renewal cron, fallback hourly poll
- [ ] 01-04: Vexa bot integration — dispatch bot on meeting detection, WebSocket transcript stream to TargetDialer DB, bot health check

### Phase 2: AI Processing Pipeline
**Goal**: Within minutes of a meeting ending, team members can read an AI-generated summary with key points, action items (each with an assignee), and key decisions — sourced from any configured LLM provider, with confidence flags on low-quality output.
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. After a meeting ends, a summary with key points, action items, and key decisions appears in the dashboard within 5 minutes — triggered automatically, not manually.
  2. Action items each show an assignee and deliverable derived from the transcript; key decisions are a separate field, not buried in prose.
  3. A summary generated from a transcript shorter than 500 tokens or with more than 20% [inaudible] markers is visibly flagged as "low confidence" in the dashboard.
  4. The LLM provider (Claude, OpenAI, or self-hosted) is swappable via a single environment variable change with no code changes required.
  5. The meeting type template (standup, design review, 1:1, general) can be configured per calendar event pattern, producing a tailored summary structure.
**Plans**: TBD

Plans:
- [ ] 02-01: ARQ job queue setup, Redis, AI Worker service skeleton, meeting-end trigger (Vexa webhook or polling — confirm during Phase 1)
- [ ] 02-02: Vercel AI SDK integration with generateObject + Zod schema for structured summary output; grounded prompt with hallucination mitigations; map-reduce chunking for long meetings
- [ ] 02-03: Confidence flagging, configurable summary templates per meeting type, token cost tracking per meeting

### Phase 3: Search & Archive
**Goal**: A team member can find any past meeting or conversation by searching a keyword, speaker name, or topic — and navigate directly to the relevant moment in the audio.
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. A keyword search returns relevant meetings with matching transcript excerpts highlighted, with results appearing in under one second.
  2. The meeting list can be filtered by date range, participant name, and duration — and the resulting list is sortable.
  3. On a meeting detail page, clicking any transcript line seeks the audio player to that timestamp.
**Plans**: TBD

Plans:
- [ ] 03-01: Search indexing job in AI Worker (triggered after summary is written), PostgreSQL FTS endpoint in TargetDialer API, search UI with highlighted excerpts
- [ ] 03-02: Meeting list view with filter/sort controls, meeting detail page with transcript viewer and audio playback with timestamp navigation

### Phase 4: Analytics Dashboard
**Goal**: The team can see how meetings are being run — who talks how much, how often the team meets, and what topics appear repeatedly — giving visibility into patterns that were invisible before.
**Depends on**: Phase 3 (requires populated archive with validated speaker data)
**Requirements**: ANLY-01, ANLY-02, ANLY-03, ANLY-04
**Success Criteria** (what must be TRUE):
  1. Each meeting detail page shows a talk-time breakdown chart by speaker, displayed as approximate percentages with a visible "approximate" label acknowledging diarization limitations.
  2. The analytics overview shows total meeting hours, average meeting duration, and participant count trends across a selectable date range.
  3. Topic trends surface which subjects appeared most frequently across meetings over the past 30 / 90 days, viewable as a ranked list.
  4. Org-level patterns (meeting frequency, total time in meetings per person) are visible on a team dashboard accessible to all members.
**Plans**: TBD

Plans:
- [ ] 04-01: Per-meeting stats aggregation (duration, participants, talk-time from diarization data), speaker talk-time chart component
- [ ] 04-02: Org-level analytics — meeting frequency trends, total hours, topic frequency aggregation across all meetings, team dashboard view

### Phase 5: Integrations
**Goal**: After every meeting, the team automatically receives a Slack message with the summary and action items — closing the loop without anyone needing to open the dashboard.
**Depends on**: Phase 2 (requires summaries to exist before they can be posted)
**Requirements**: INTG-01
**Success Criteria** (what must be TRUE):
  1. Within 5 minutes of an AI summary being generated, a Slack message is posted to the configured channel containing the meeting title, key points, and action items list.
  2. The Slack destination channel is configurable by an admin in the team settings page without a code deployment.
**Plans**: TBD

Plans:
- [ ] 05-01: Slack webhook integration, post-summary trigger in AI Worker, channel configuration in admin settings

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/4 | Not started | - |
| 2. AI Processing Pipeline | 0/3 | Not started | - |
| 3. Search & Archive | 0/2 | Not started | - |
| 4. Analytics Dashboard | 0/2 | Not started | - |
| 5. Integrations | 0/1 | Not started | - |
