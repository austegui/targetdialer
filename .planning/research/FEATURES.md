# Feature Research

**Domain:** Meeting intelligence / AI notetaker (internal team tool)
**Researched:** 2026-02-23
**Confidence:** MEDIUM — WebSearch across multiple sources; no official API docs available via Context7 for these products

---

## Context

This research covers the feature landscape of meeting intelligence tools (Fireflies.ai, Otter.ai, Grain, tl;dv, Fathom, and adjacent tools) to inform TargetDialer — an internal meeting intelligence tool for a team of 5-20 at TargetDial (voice automation company). The project replaces Fireflies.ai and is built on Vexa for bot + transcription infrastructure.

The user base is **internal team**, not sales/customer-facing. This matters: sales-focused features (deal intelligence, CRM sync, pipeline analytics) are anti-features for this context.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any meeting intelligence tool. Missing these = the product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auto-join from calendar | Users expect the bot to appear without manual action. Every major tool does this. | MEDIUM | Requires Google Calendar OAuth + webhook or polling. Vexa handles bot-join mechanics; calendar sync is the app's responsibility. |
| Real-time transcription | Watching words appear as they're spoken is now baseline. Delay > 3s feels broken. | LOW | Vexa handles ASR. App needs to stream the result to UI via WebSocket or SSE. |
| Speaker identification / diarization | "Alice said X, Bob said Y" — unlabeled transcripts are nearly useless. | MEDIUM | Vexa likely provides diarization. Needs display in UI with speaker names/avatars. |
| Post-meeting AI summary | Every tool produces a summary. Absence makes the tool feel half-baked. | MEDIUM | LLM call on full transcript. Flexible AI provider is already a requirement. |
| Action item extraction | Specific subset of summary. Users expect a dedicated list, not items buried in a paragraph. | MEDIUM | Structured LLM prompt. Can be done with same call as summary or separate. |
| Searchable meeting archive | Users expect to search "what did we say about pricing last month?" | MEDIUM | Full-text search over transcripts. Postgres tsvector or a dedicated search index (e.g. Meilisearch). |
| Recording storage + playback | Users want to re-watch/re-listen. Audio playback is minimum; video is expected but a higher bar. | HIGH | Storage cost and complexity is real. Start with audio. |
| Meeting list / dashboard | A home screen showing past meetings, dates, durations, participants. | LOW | Simple CRUD view. |
| Share meeting / transcript | Send a link to someone who wasn't on the call. | LOW | Generates shareable URL, optionally with access controls. |
| Google OAuth login | Expected for any internal tool in a Google Workspace org. | LOW | Standard OAuth 2.0 flow. Single sign-on is the minimum. |
| Meeting participant list | Who was on the call, with timestamps if possible. | LOW | Derived from bot observation or calendar event attendees. |
| Timestamps on transcript | Users click a timestamp to jump to that moment in audio/video. | LOW | Transcript chunks include start/end time from ASR output. |
| Key decisions extraction | Alongside action items, users expect decisions to be called out explicitly. | MEDIUM | Second structured field in the AI summary output. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not baseline expectations, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Feature-rich analytics dashboard | Speaker talk-time %, topic frequency, meeting duration trends, engagement patterns. Positions the tool as "intelligence" not just "notes." | HIGH | Requires aggregating data across meetings. Charts per meeting + org-wide trends. Speaker stats come from diarized transcript. |
| Topic trend tracking | "Pricing came up 12 times this week across 5 meetings." Org-level pattern detection. | HIGH | Keyword/topic extraction at scale. Requires storing structured metadata per meeting. |
| AI Q&A over meeting history | "What did we decide about the Q3 roadmap?" — natural language query across all past meetings. | HIGH | RAG (retrieval-augmented generation): embed transcripts, semantic search, LLM answer. High value, non-trivial to build correctly. |
| Flexible AI provider | Swap between OpenAI, Anthropic, local models. Future-proof and cost-controllable. | MEDIUM | Abstract LLM calls behind a provider interface. Config-driven. Requirement already stated. |
| Custom summary templates | Per-meeting-type prompts: "sales call", "team standup", "design review." Different structure = more useful output. | MEDIUM | UI to create/select templates. Prompt engineering per template type. |
| Keyword / topic trackers | Flag any meeting where "churn", "competitor X", or "bug" was mentioned. | MEDIUM | Simple keyword scan over transcript text, or LLM-based topic classification. Grain calls these "Trackers." |
| Automated Slack notifications | Summary + action items posted to a Slack channel after each meeting. | LOW | Slack webhook. High perceived value for small teams. |
| In-meeting live note-taking UI | Floating notes panel visible during the meeting, timestamped automatically. | MEDIUM | Useful for participants. Web app widget or Chrome extension. |
| Meeting clips / highlight reels | Cut a 30-second clip from the recording around a key moment. | HIGH | Requires video recording + time-indexed clip generation. Grain's standout feature. |
| Agenda integration | Pre-meeting: create agenda from calendar event. Post-meeting: map discussion to agenda items. | MEDIUM | Nice for structured organizations. Requires calendar event description parsing. |
| Smart follow-up email draft | After the meeting, draft a follow-up email with summary + action items pre-filled. | LOW | LLM prompt with summary context. Fathom and others do this. |
| Meeting coaching / talk-time feedback | "You talked 78% of the time in this call." Personal awareness feature. | MEDIUM | Per-user analytics derived from speaker diarization. |
| Multi-language transcription | Support non-English meetings. | MEDIUM | Depends on Vexa/ASR backend capability. If Vexa supports it, mostly a configuration flag. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but create disproportionate cost, complexity, or scope for this specific project (5-20 person internal tool).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| CRM sync (Salesforce, HubSpot) | Sales teams expect it. | This is an internal tool, not a sales tool. CRM sync adds significant integration complexity, requires field mapping UI, and creates maintenance burden. The 5-20 user team does not need CRM pipeline data inside meeting notes. | Slack post with summary is sufficient for sharing meeting outputs. |
| Video recording + storage | Users want to re-watch. | Video storage is expensive (GB per meeting). For a small internal team, audio + timestamped transcript achieves 90% of the value at a fraction of the cost. Video encoding pipeline is non-trivial. | Store audio only. Serve timestamped transcript with click-to-seek. |
| Real-time web search during meetings | Fireflies launched "Talk to Fireflies" + Perplexity integration. | Feature adds infrastructure complexity and meeting distraction risk. Internal team use case doesn't benefit from fact-checking competitor info mid-call. | Post-meeting AI Q&A over transcript archive covers the intent. |
| White-label / multi-tenant | Seems like an obvious "what if we productize this" addition. | Productization requires auth isolation, billing, support infrastructure. This is an internal tool for one org. Scope creep kills small projects. | Remain single-tenant. If productized later, treat as a new project. |
| Mobile recording app | Record in-person meetings via phone mic. | Adds mobile development complexity (iOS/Android) and degrades transcription quality (ambient noise). | Focus on video call recording via bot. In-person is out of scope for v1. |
| Enterprise SSO / SAML | Requested by teams thinking ahead. | Team of 5-20 doesn't need SAML. Google OAuth is sufficient. SAML adds cost (identity provider integration) with zero user benefit at this scale. | Google OAuth covers the use case. |
| Public sharing + embed | Share meeting clip on a website. | Requires CDN, public-facing video hosting, embed security. Internal tool — everything should be authenticated. | Shareable authenticated links within the org. |
| AI-generated meeting minutes in Word/PDF | "Can you export as a Word doc?" | Output format proliferation. LLM generates text — the format is a solved problem. Word/PDF exports are rarely re-used after the first time. | Copy-paste from web UI or Markdown export is sufficient. |
| Noise cancellation / audio enhancement | Krisp-style preprocessing. | Adds audio processing pipeline complexity. Vexa handles the audio stream; preprocessing before it reaches ASR is a separate infrastructure layer. | Rely on Vexa's ASR quality. Flag as future improvement if transcription accuracy is poor. |

---

## Feature Dependencies

```
[Google OAuth]
    └──required by──> [Calendar Auto-Join]
                          └──required by──> [Real-Time Transcription]
                                                └──required by──> [Speaker Diarization]
                                                                      └──required by──> [AI Summary]
                                                                                            └──required by──> [Action Items]
                                                                                                                  └──required by──> [Key Decisions]

[Meeting Archive / Storage]
    └──required by──> [Searchable Archive]
    └──required by──> [Audio Playback + Timestamps]
    └──required by──> [Analytics Dashboard]
    └──required by──> [Topic Trend Tracking]
    └──required by──> [AI Q&A over History]

[AI Summary]
    └──enhances──> [Custom Summary Templates]
    └──enhances──> [Smart Follow-Up Email Draft]

[Transcript + Speaker Diarization]
    └──required by──> [Speaker Stats / Talk-Time Analytics]
    └──required by──> [Keyword / Topic Trackers]
    └──required by──> [Meeting Clips] (requires timestamps)

[Analytics Dashboard]
    └──enhances──> [Topic Trend Tracking]
    └──enhances──> [Speaker Stats]
```

### Dependency Notes

- **Google OAuth is the root** — everything depends on authenticated calendar access for auto-join.
- **Vexa (bot + ASR) is the foundation** — real-time transcription, diarization, and recording are delegated to Vexa. The app builds above that interface.
- **Meeting archive must exist before analytics** — can't compute trends on data that isn't stored and structured.
- **AI summary requires a complete transcript** — real-time summaries mid-meeting are a differentiator (tl;dv does this), but post-meeting summaries are the baseline. Build post-meeting first.
- **AI Q&A over history requires embedding infrastructure** — this is the most complex feature. Depends on transcripts being stored, chunked, and embedded. Cannot be built until storage and structure are stable.

---

## MVP Definition

### Launch With (v1)

Minimum viable product that replaces Fireflies.ai for the TargetDial team.

- [ ] Google OAuth — authenticates users, establishes org context
- [ ] Google Calendar auto-join — bot appears in meetings without manual intervention
- [ ] Real-time transcription display — live transcript visible during meeting
- [ ] Speaker diarization — labeled by speaker in transcript
- [ ] Post-meeting AI summary — generated within minutes of meeting end; configurable LLM provider
- [ ] Action items extraction — structured list, not buried in summary prose
- [ ] Key decisions extraction — parallel to action items
- [ ] Meeting archive / list view — all past meetings, searchable by date/participant/title
- [ ] Full-text search — keyword search across all transcripts
- [ ] Audio playback with timestamp navigation — click transcript line, jump to that moment
- [ ] Share meeting link — authenticated link for org members who weren't on the call
- [ ] Basic analytics dashboard — per-meeting: speaker talk-time %, meeting duration, participant count

### Add After Validation (v1.x)

Features to add once the core is stable and the team is using it daily.

- [ ] Slack notification after each meeting — auto-post summary + action items to a configured channel
- [ ] Custom summary templates — per-meeting-type prompts (standup, design review, 1:1)
- [ ] Keyword / topic trackers — flag meetings where specific terms appeared
- [ ] Org-level analytics — topic trends, meeting frequency, speaker patterns across all meetings
- [ ] Smart follow-up email draft — one-click draft from summary context

### Future Consideration (v2+)

Defer until product-market fit is established within the team.

- [ ] AI Q&A over meeting history (RAG) — high value but high complexity; requires stable embedding infrastructure
- [ ] Meeting clips / video highlights — requires video recording pipeline; high storage cost
- [ ] Multi-language transcription — depends on Vexa capability; investigate before building UI
- [ ] In-meeting live notes panel — web widget or Chrome extension; adds surface area
- [ ] Agenda integration — map discussion to pre-defined agenda items

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google OAuth | HIGH | LOW | P1 |
| Calendar auto-join | HIGH | MEDIUM | P1 |
| Real-time transcription UI | HIGH | LOW (Vexa does the work) | P1 |
| Speaker diarization display | HIGH | LOW (Vexa provides data) | P1 |
| Post-meeting AI summary | HIGH | MEDIUM | P1 |
| Action items extraction | HIGH | MEDIUM | P1 |
| Key decisions extraction | HIGH | MEDIUM | P1 |
| Meeting archive / list | HIGH | LOW | P1 |
| Full-text search | HIGH | MEDIUM | P1 |
| Audio playback + timestamps | MEDIUM | MEDIUM | P1 |
| Share meeting link | MEDIUM | LOW | P1 |
| Basic per-meeting analytics | MEDIUM | MEDIUM | P1 |
| Slack notification | HIGH | LOW | P2 |
| Custom summary templates | MEDIUM | MEDIUM | P2 |
| Keyword trackers | MEDIUM | MEDIUM | P2 |
| Org-level analytics / trends | HIGH | HIGH | P2 |
| Follow-up email draft | LOW | LOW | P2 |
| AI Q&A over history (RAG) | HIGH | HIGH | P3 |
| Meeting clips / highlights | MEDIUM | HIGH | P3 |
| Multi-language support | LOW | LOW-MEDIUM | P3 |
| In-meeting live notes | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (replaces Fireflies for the team)
- P2: Should have, add when possible (makes the tool noticeably better)
- P3: Nice to have, future consideration (differentiating but complex)

---

## Competitor Feature Analysis

| Feature | Fireflies.ai | Fathom | tl;dv | Grain | Otter.ai | Our Approach |
|---------|--------------|--------|-------|-------|----------|--------------|
| Auto-join from calendar | Yes | Yes | Yes | Yes | Yes (OtterPilot) | Yes — core requirement |
| Real-time transcription | Yes (live) | Yes | Yes | Yes | Yes | Yes — via Vexa |
| Speaker diarization | Yes | Yes | Yes | Yes | Yes | Yes — via Vexa |
| AI summary | Yes | Yes (30s) | Yes | Yes | Yes | Yes — flexible LLM |
| Action items | Yes | Yes | Yes | Yes | Yes | Yes — structured |
| Key decisions | Yes | Yes | Yes | Yes | Partial | Yes — explicit field |
| Full-text search | Yes (AskFred) | Yes | Yes | Yes | Yes | Yes — Postgres or Meilisearch |
| Audio/video playback | Video | Audio | Video | Video | Audio only | Audio first |
| Analytics / speaker stats | Yes (Pro) | Basic | Yes | Yes | Basic | Yes — dashboard focus |
| Topic trend tracking | Yes | No | Yes (multi-meeting) | Yes (Trackers) | No | Yes — v1.x |
| AI Q&A over history | Yes (AskFred) | Yes (Ask Fathom) | No | No | Yes (Otter AI Chat) | v2+ |
| Slack integration | Yes (Pro) | Yes | Yes | Yes | Yes | Yes — v1.x |
| CRM sync | Yes (Pro) | Yes | Yes | Yes | No | Explicitly out of scope |
| Custom summary templates | Yes | Yes | No | Yes | No | Yes — v1.x |
| Video clips / highlights | No | No | Yes (Reels) | Yes | No | v3+ (complex) |
| Free plan | Limited | Unlimited (generous) | Generous | Limited | Yes | N/A — internal tool |
| Language support | 100+ | 30+ | 30+ | 100+ | 3 (EN/ES/FR) | Depends on Vexa |
| Bot-free recording option | No | Yes | No | No | Yes (Chrome ext) | No — bot is the architecture |

**Key observation:** Fathom's free plan is the most generous, suggesting the market commoditizes basic recording + transcription + summary. Differentiation is now in analytics depth, search quality, and workflow integrations. TargetDialer's differentiator should be the analytics dashboard (topic trends, speaker stats, org-level patterns) since Fireflies's analytics are paywalled at the Pro tier.

---

## Sources

- [Best AI Meeting Assistants 2026 — Krisp.ai](https://krisp.ai/blog/best-ai-meeting-assistant/) — MEDIUM confidence (editorial, multiple tools verified)
- [Top 10 AI notetakers 2026 — AssemblyAI](https://www.assemblyai.com/blog/top-ai-notetakers) — MEDIUM confidence (infrastructure provider, credible)
- [19 Best AI Meeting Assistants 2026 — tl;dv](https://tldv.io/blog/best-ai-meeting-assistants/) — MEDIUM confidence (vendor blog, self-interested but detailed)
- [Fathom AI Review 2026 — max-productive.ai](https://max-productive.ai/ai-tools/fathom/) — LOW confidence (third-party review)
- [Fathom for Teams — fathom.video](https://fathom.video/for/teams) — MEDIUM confidence (official product page)
- [Grain product overview — grain.com](https://grain.com) — MEDIUM confidence (official product page)
- [Fireflies.ai features — fireflies.ai](https://fireflies.ai/product/features) — MEDIUM confidence (official product page)
- [Otter.ai — otter.ai](https://otter.ai/) — MEDIUM confidence (official product page)
- [tl;dv features — tldv.io](https://tldv.io/features/meeting-recordings-transcriptions/) — MEDIUM confidence (official product page)
- [Meeting Recording Privacy 2026 — summarizemeeting.com](https://summarizemeeting.com/en/faq/meeting-recording-privacy) — LOW confidence (third-party)
- [5 Ways to Request Recording Consent — recall.ai](https://www.recall.ai/blog/5-ways-to-request-recording-consent-with-meeting-bots) — MEDIUM confidence (Recall.ai is a meeting bot infrastructure provider)
- [Conversation Intelligence 2026 — assemblyai.com](https://www.assemblyai.com/blog/conversation-intelligence) — MEDIUM confidence
- [Fathom vs Grain — tldv.io](https://tldv.io/blog/fathom-vs-grain/) — LOW confidence (competitor analysis by tl;dv, biased)
- [7 Best AI Meeting Recorders 2026 — wave.co](https://wave.co/blog/best-ai-meeting-recorders) — LOW confidence (third-party)

---

*Feature research for: Meeting intelligence / AI notetaker (internal team)*
*Researched: 2026-02-23*
