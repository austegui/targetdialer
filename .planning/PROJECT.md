# TargetDialer

## What This Is

An internal meeting intelligence tool for the TargetDial team that replaces Fireflies.ai. Built on top of Vexa (open-source meeting bot platform), it auto-joins Google Meet calls from the team's calendar, transcribes conversations in real-time, generates AI-powered summaries with action items, and provides a searchable archive with a feature-rich analytics dashboard. Accessible via Google OAuth for the team (~5-20 people).

## Core Value

Every team meeting is automatically captured, transcribed, and summarized — so nothing falls through the cracks and the team can search across all past conversations.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Auto-join Google Meet calls from Google Calendar
- [ ] Real-time meeting transcription with speaker identification
- [ ] AI-generated meeting summaries (action items, key decisions, key points)
- [ ] Searchable archive across all past meetings (by keyword, speaker, topic)
- [ ] Feature-rich web dashboard (analytics, speaker stats, topic trends, team activity)
- [ ] Google OAuth authentication for team access
- [ ] Flexible AI provider support (Claude, OpenAI, self-hosted — swappable)

### Out of Scope

- TargetDial platform integration — standalone for now, integrate later
- Microsoft Teams / Zoom support — Google Meet only for v1
- Mobile app — web-first
- External/customer-facing access — internal team tool only

## Context

- **TargetDial** is a voice automation company that uses AI agents. This tool is for their internal team meetings.
- Currently using Fireflies.ai — want to own the stack instead of paying for a SaaS.
- Foundation is **Vexa** (github.com/Vexa-ai/vexa) — open-source, Apache 2.0, self-hostable meeting bot platform with headless browser bot, Whisper-based transcription, REST API + WebSocket, Docker deployment.
- Team uses **Google Calendar** for scheduling and **Google Meet** for calls.
- Vexa already handles: bot joining meetings, audio capture, real-time transcription via Whisper, multi-platform support.
- What we build on top: AI summaries, searchable archive, analytics dashboard, calendar auto-join integration, Google OAuth.

## Constraints

- **Foundation**: Must build on Vexa — not building meeting bot infrastructure from scratch
- **Auth**: Google OAuth only — team is already on Google Workspace
- **AI Provider**: Must be provider-agnostic — support Claude, OpenAI, and self-hosted models via a common interface
- **Scope**: Full Fireflies parity before switching — bot + transcription + summaries + search + dashboard + analytics
- **Hosting**: TBD — to be decided during planning

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on Vexa rather than from scratch | Vexa already solves meeting bot + transcription; focus effort on value-add features | — Pending |
| Google Meet Media API rejected | Developer Preview, requires all participants enrolled — too restrictive for team use | — Pending |
| Standalone from TargetDial platform | Reduce scope, build independently now, integrate later when stable | — Pending |
| Flexible AI provider | Avoid vendor lock-in, allow cost optimization and model switching as landscape evolves | — Pending |

---
*Last updated: 2026-02-23 after initialization*
