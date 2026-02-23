# Pitfalls Research

**Domain:** Meeting intelligence platform (Vexa-based, Google Calendar auto-join, real-time transcription, AI summaries, searchable archive)
**Researched:** 2026-02-23
**Confidence:** MEDIUM — Vexa-specific pitfalls drawn from GitHub issues (MEDIUM), general meeting bot patterns from Recall.ai docs (MEDIUM), transcription/diarization problems from verified community sources (MEDIUM)

---

## Critical Pitfalls

### Pitfall 1: Bot Waiting Room Timeout — Silent Mission Failure

**What goes wrong:**
When Google Meet is configured with a "Trusted" or "Restricted" access type, the Vexa bot enters a waiting room and must be admitted by the meeting host. If the host doesn't admit the bot within 8 minutes of scheduled start time, the bot silently exits the waiting room. The meeting proceeds without transcription, and the system marks it as "missed" with no retry. For a team that auto-joins from Calendar, this is the most common failure mode in real deployments.

**Why it happens:**
Developers test in controlled meetings where they are the host. In production, Calendar events often belong to external organizers who don't recognize or admit the bot. The 8-minute timeout is a platform constraint, not a Vexa bug, but Vexa surfaces no notification back to the user that their meeting went unrecorded.

**How to avoid:**
- Design a clear "bot admission required" notification that fires immediately when a bot enters a waiting room — push it to the meeting organizer via email or a Slack/webhook alert
- Document in onboarding that external-hosted meetings require host cooperation
- Implement a post-meeting check: if a Calendar event had a meeting link and no transcript was created, surface a "Was this meeting missed?" alert
- For internal-only meetings (the primary TargetDial use case), confirm that the bot account is pre-trusted in the Google Workspace domain settings

**Warning signs:**
- Meetings show in Calendar sync but have no transcript records
- Users complain "the bot didn't join" — check if the meeting was externally hosted
- Bot join logs show `WAITING` state with no subsequent `ACTIVE` transition

**Phase to address:**
Phase 1 (bot integration) — implement wait-room monitoring and post-join verification before shipping to users

---

### Pitfall 2: Vexa Bot Reaches ACTIVE but Captures No Audio

**What goes wrong:**
A documented Vexa bug (GitHub issue #115) shows the bot reaching `ACTIVE` status — which looks like success — but failing to actually capture audio, resulting in an empty or zero-length transcript. The system reports "meeting joined" with no downstream error, so users assume the transcript is processing when it will never arrive.

**Why it happens:**
Browser-based bots simulate a meeting participant using a headless browser. Audio capture occurs via the browser's media capture APIs. If the browser fails to acquire the audio stream (permission race, timing issue, or platform-side change in Meet's internal DOM), the bot appears joined but is deaf. Vexa's own release notes for v0.3.2 cite "numerous bug fixes and resilience upgrades," suggesting this class of problem is known but not fully resolved.

**How to avoid:**
- Never report "meeting joined" to the user until a first transcript segment has arrived — gate the success state on actual data, not bot `ACTIVE` status
- Implement a "transcript health check": if a meeting has been ACTIVE for 3+ minutes with zero transcript segments, trigger a bot restart or escalate to an alert
- Monitor Vexa release notes and upgrade promptly; audio capture bugs have been addressed in patch releases (v0.4.1 critical bug fix)

**Warning signs:**
- Bot status = ACTIVE but `GET /transcripts/{session_uid}` returns empty array after 5 minutes
- Zero-byte audio files in storage despite "joined" status
- User reports "bot was in meeting but no transcript appeared"

**Phase to address:**
Phase 1 — implement transcript health monitoring as part of the bot lifecycle management, not as a later observability task

---

### Pitfall 3: Transcript Data Inconsistency — session_uid Mismatch

**What goes wrong:**
Vexa has a documented bug (GitHub issue #96) where transcript retrieval fails because `session_uid` mismatches between the `MeetingSession` table and the `Transcriptions` table. This is a database-level consistency failure that causes complete transcript loss for affected meetings. The failure is silent at the API level — the endpoint may return an empty transcript rather than an error.

**Why it happens:**
If a bot crashes mid-meeting and restarts, it may create a new session record while orphaned transcription rows reference the old session UID. This is a known Vexa infrastructure fragility under crash-restart scenarios.

**How to avoid:**
- Always validate that transcript retrieval returns expected data — implement an integrity check after every meeting completes
- Keep raw transcript data in your own database immediately as it streams in via WebSocket, rather than relying solely on Vexa's `GET /transcripts` endpoint as the source of truth
- Design your schema to own transcript data with your own primary keys, treating Vexa's `session_uid` as a foreign reference

**Warning signs:**
- `GET /transcripts/{session_uid}` returns HTTP 200 with empty array for meetings you know completed
- Missing transcripts in the archive that correspond to meetings where the bot was marked ACTIVE

**Phase to address:**
Phase 1 — data ownership architecture must be established before first real meeting is processed

---

### Pitfall 4: Google Calendar Webhook Channel Expiration — Missed Meetings

**What goes wrong:**
Google Calendar push notification channels expire approximately one week after creation. There is no automatic renewal — the application must proactively re-register the watch channel before it expires. If the channel expires, the system stops receiving Calendar change events. New meetings are added to users' calendars but the system never detects them and never sends bots. The failure is completely silent — no errors, no alerts, just missed meetings.

**Why it happens:**
Developers implement the initial webhook registration and test it. It works. They ship it. Six days later it silently stops. Most teams discover this only when a user asks "why wasn't my meeting recorded this week?"

**How to avoid:**
- Store the channel `expiration` timestamp in the database for every registered watch channel
- Run a background job every 24 hours that checks for channels expiring within 48 hours and pre-emptively re-registers them
- Implement a fallback polling mechanism: even with webhooks active, do a full Calendar sync once per hour as a safety net for missed events
- Log and alert when a webhook channel is re-registered (confirm the cycle is working)

**Warning signs:**
- Users report their meetings stopped being recorded after a certain date
- The `channelExpiry` field in your database is more than 7 days old with no renewal record
- Zero Calendar webhook events received in the past 24 hours (should be non-zero for active users)

**Phase to address:**
Phase 1 (Calendar integration) — the renewal job must be part of the initial implementation, not an afterthought

---

### Pitfall 5: AI Summary Hallucination — Inventing Meeting Content

**What goes wrong:**
LLMs generating meeting summaries will sometimes state things that were not said in the meeting — fabricating action items, attributing decisions to attendees who didn't make them, or inventing next steps. At a 2-5% hallucination rate on summarization tasks, a team with 20 meetings per day will see 0.4-1.0 hallucinated summaries per day. These are high-stakes errors: a fabricated "John agreed to deliver X by Friday" can cause real workplace conflict.

**Why it happens:**
LLMs trained for fluency will "complete" a summary confidently even when the transcript is sparse, ambiguous, or heavily diarized incorrectly. Short meetings, meetings with poor audio, and meetings with lots of crosstalk produce transcripts that leave gaps the LLM fills with plausible but invented content.

**How to avoid:**
- Ground summaries strictly in the transcript: use a prompt that explicitly instructs "only include information present in the transcript; if uncertain, omit"
- Use Claude's lower temperature settings (0.2-0.4) for summary generation to reduce creativity
- Add a "confidence" flag to summaries: if the transcript is shorter than 500 tokens or has more than 20% `[inaudible]` markers, label the summary as "low confidence — review recommended"
- Display the source transcript alongside the summary so users can verify claims
- For action items specifically, consider extracting them with a separate, stricter prompt that requires explicit evidence ("only list action items where a specific person is named AND a deliverable is stated")

**Warning signs:**
- Users report "the summary mentioned X but we never discussed X"
- Action items reference people not listed as meeting participants
- Summaries for short meetings (under 5 minutes) are suspiciously detailed

**Phase to address:**
Phase 2 (AI summarization) — prompt engineering and confidence flagging must be in the initial summary implementation

---

## Moderate Pitfalls

### Pitfall 6: Transcript Search Degrades at Scale Without Proper Indexing

**What goes wrong:**
Searching meeting transcripts with `ILIKE '%query%'` in PostgreSQL is a sequential scan. On a small dataset (under 500 meetings), it's fast enough to feel fine. At 5,000+ meetings with hour-long transcripts, the same query takes 5-30 seconds and the feature becomes unusable. Teams often discover this only after months of accumulation.

**Why it happens:**
Full-text search indexing is skipped during initial development because it works "fine" on dev data. PostgreSQL's GIN indexes for `tsvector` are not created by default — they require explicit schema design.

**How to avoid:**
- Create `tsvector` columns and GIN indexes from day one, before any real data is inserted
- Use PostgreSQL's built-in `to_tsvector` and `to_tsquery` for all transcript search queries
- For the TargetDial scale (5-20 users, likely 100-1,000 meetings/month), PostgreSQL FTS is sufficient — no need for Elasticsearch or dedicated search infrastructure yet
- Plan the schema: store both `content TEXT` (raw) and `content_tsv TSVECTOR` (indexed), with a trigger to keep them in sync

**Warning signs:**
- Search queries taking more than 500ms in development
- `EXPLAIN ANALYZE` shows `Seq Scan` instead of `Index Scan` on transcript content

**Phase to address:**
Phase 1 (data storage) — index design must be part of the initial schema, not a performance optimization later

---

### Pitfall 7: Speaker Diarization Accuracy Degrades with Multiple Similar Voices

**What goes wrong:**
Vexa's speaker identification (added in v0.4) uses audio embeddings to distinguish speakers. In practice, diarization error rates reach 20-40% in challenging conditions: two male speakers with similar vocal characteristics, overlapping speech, heavy background noise, or conference room echo. Misattributed quotes make the transcript confusing and undermine trust in the whole system. Overlapping speech (two people talking at once) is a known unresolved problem in the Whisper/Pyannote stack.

**Why it happens:**
Diarization is solved as a separate problem from transcription and the two are stitched together post-hoc. The stitching creates misalignment when speech boundaries are ambiguous. A team that does a lot of fast-paced brainstorming or debate will see worse diarization than a team that speaks in turns.

**How to avoid:**
- Set honest expectations in the UI: label the speaker attribution as "approximate" and make it easy for users to correct speaker names
- Build a speaker correction UI from the start, not as a post-launch feature
- Store speaker labels as editable metadata separate from the immutable transcript content
- Don't build any analytics that depend on per-speaker accuracy until you've validated accuracy against your team's actual meetings

**Warning signs:**
- Transcripts show "Speaker 1" for most of a meeting when two distinct people are speaking
- Users report "it attributed my words to someone else"
- `[inaudible]` or `[crosstalk]` markers appear frequently

**Phase to address:**
Phase 1 (transcription) — build correction capability before Phase 3 (analytics) which depends on speaker data

---

### Pitfall 8: LLM Context Window Overflow for Long Meetings

**What goes wrong:**
A 2-hour meeting transcript can easily exceed 30,000-50,000 tokens. Feeding this directly to an LLM for summarization either fails (context limit exceeded) or produces degraded quality because the model loses coherence over long contexts. Claude 3 and GPT-4 have large context windows but still have quality degradation on very long inputs, and cost scales linearly with tokens.

**Why it happens:**
Developers test with 30-minute meetings during development. Longer meetings reveal the problem. Naive approaches (`summarize this transcript`) work fine in testing and fail in production.

**How to avoid:**
- Implement chunked summarization from day one: split transcripts into 15-minute segments, summarize each, then synthesize the segment summaries into a final summary
- For the final synthesis, use a "map-reduce" prompt pattern: chunk summaries → bullet lists per chunk → final synthesis prompt
- Set token budget guardrails: estimate transcript token count before sending to LLM and choose the appropriate strategy
- Track LLM costs per meeting so runaway expenses are visible early

**Warning signs:**
- Summarization API calls fail with "context_length_exceeded" errors
- Monthly LLM costs growing faster than meeting volume
- Summary quality noticeably worse for meetings over 90 minutes

**Phase to address:**
Phase 2 (AI summarization) — implement chunking strategy before launch, not after first billing surprise

---

### Pitfall 9: OAuth Refresh Token Expiration Breaks Calendar Integration

**What goes wrong:**
Google OAuth refresh tokens expire if unused for 6 months, if the user revokes access, if the user changes their Google password, or if the application exceeds Google's per-user token limits. When the refresh token expires, the calendar integration stops silently — no new meetings are detected, no error is shown to the user, and existing meetings continue to appear in the archive creating a false sense of operation.

**Why it happens:**
OAuth token management is implemented once during onboarding and forgotten. Teams don't test the expiration scenario because it takes months to trigger naturally.

**How to avoid:**
- Wrap all Google API calls in a token refresh handler that gracefully catches `invalid_grant` errors and redirects the user to re-authenticate
- Store token expiration state in the database and surface a "reconnect your calendar" prompt in the UI before the token expires
- Test the expiration scenario explicitly: invalidate a token manually and verify the recovery flow works
- For a small team (5-20 people), token expiration will be rare but the recovery flow must be seamless — a confused user may just stop using the product

**Warning signs:**
- Google Calendar API returning 401 or `invalid_grant` errors
- User reports "my meetings stopped syncing"
- Last Calendar sync timestamp is stale (more than 1 hour for an active user)

**Phase to address:**
Phase 1 (Calendar integration) — error handling and recovery UX must be part of the initial implementation

---

### Pitfall 10: Uncontrolled Audio Storage Growth

**What goes wrong:**
Raw meeting audio at 128kbps stereo generates approximately 58MB per hour. With 5-20 users having 3-5 meetings per day, a team accumulates 1-4GB of audio per week. Without a retention policy, storage costs grow indefinitely. After one year, a 20-person team could have 50-200GB of audio files that nobody is accessing but the company is paying to store.

**Why it happens:**
Storage costs are invisible during development and the first month of operation. Teams implement recording without thinking about lifecycle, then discover the cost 6 months later when the bill arrives.

**How to avoid:**
- Decide the retention policy before writing the first audio file: "keep audio for 90 days, then delete; keep transcripts and summaries forever"
- Implement S3 lifecycle rules from day one (transition to S3-IA after 30 days, delete after 90 days)
- Separate storage of audio files (transient, expensive) from transcripts (permanent, cheap text)
- Consider not storing raw audio at all if Vexa's transcript quality is acceptable — the transcript + summary is the durable artifact, not the recording

**Warning signs:**
- S3 bucket size growing more than 5GB/month for a small team
- Monthly storage costs exceeding $50 without a matching user growth story
- Audio files from 6+ months ago that have zero access log entries

**Phase to address:**
Phase 1 (storage design) — implement lifecycle rules before any real meetings are processed

---

## Minor Pitfalls

### Pitfall 11: Whisper Transcription "Repetition Hallucination" Artifact

**What goes wrong:**
Whisper (and models based on it) has a known artifact where long silences or low-quality audio segments cause the model to repeat the last phrase it transcribed — sometimes looping "thank you thank you thank you" or similar for dozens of tokens. Vexa's GitHub issue #104 explicitly documents this as "repetitions in transcription."

**How to avoid:**
Post-process transcripts with a simple deduplication filter: if the same phrase appears more than 3 times consecutively, collapse it to one instance and flag the segment. This is a cheap fix that should be applied as a transcript normalization step before storage or display.

**Phase to address:**
Phase 1 (transcript storage pipeline) — add normalization before storing

---

### Pitfall 12: Zoom Integration Requires Marketplace Approval

**What goes wrong:**
Vexa explicitly documents that Zoom bots "typically require Marketplace approval to join other users' meetings." Before approval, the bot can only reliably join meetings created by the account owner. For a company using Zoom, this means the auto-join feature effectively doesn't work until Zoom approves the app — a process that can take weeks and may be rejected.

**How to avoid:**
For TargetDial's use case (internal team, primarily Google Meet), deprioritize Zoom support entirely. Build and test against Google Meet first. If Zoom is needed, start the Marketplace approval process in Phase 1 even if the Zoom feature is not planned until Phase 3, because the approval lead time is outside your control.

**Phase to address:**
Phase 1 — make the platform decision explicit and set expectations accordingly

---

### Pitfall 13: "Looks Done" Real-Time Transcript Display Missing Finalization

**What goes wrong:**
Vexa's WebSocket protocol streams "mutable" transcript segments — interim results that change as more audio is processed. A common mistake is displaying the WebSocket stream directly as the "final" transcript. The UI looks correct during the meeting but the stored transcript contains the raw mutable segments, which may differ from the final, finalized version returned by `GET /transcripts`.

**How to avoid:**
Use the WebSocket stream for live display only. When the meeting ends (or on a configurable delay), fetch the stable transcript from the REST API endpoint and store that as the canonical version. Document this distinction clearly in your architecture from day one.

**Phase to address:**
Phase 1 (data pipeline) — the distinction between live display and stored transcript must be designed upfront

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store mutable WebSocket transcript as final | Simpler pipeline | Incorrect stored transcripts, trust erosion | Never |
| Skip GIN index on transcript content | Faster initial setup | Search unusable at scale | Never |
| Poll Calendar instead of webhooks | Simpler implementation | Delayed meeting detection (5-15 min lag), API quota usage | Only for initial prototype/testing |
| No audio retention policy | No initial config | Unbounded storage cost growth | Never |
| Single LLM prompt for all transcript lengths | Simple code | Fails/costs explode for long meetings | Never |
| Skip bot admission monitoring | Faster MVP | Silent missed-meeting failures | Never |
| Trust Vexa session_uid as source of truth | Less code | Data loss risk on Vexa internal bug | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vexa bot status | Treat `ACTIVE` status as "transcription confirmed" | Gate success on first transcript segment arriving |
| Vexa transcripts | Rely on `GET /transcripts/{session_uid}` as source of truth | Stream via WebSocket and own the data in your DB |
| Google Calendar webhooks | Register once and forget | Store expiry, run renewal job every 24 hours, maintain fallback polling |
| Google OAuth | Assume token is valid indefinitely | Wrap all calls in refresh handler, surface re-auth UX |
| LLM summarization | Pass full transcript to LLM | Chunk at 15-minute segments, use map-reduce summarization |
| Speaker labels | Display as definitive attribution | Display as approximate, provide correction UI |
| Zoom support | Test locally with your own account and assume it works | Confirm Marketplace approval requirement before committing to Zoom |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `ILIKE '%query%'` on transcript content | Search takes 5-30 seconds | GIN index + tsvector from schema creation | 1,000+ meetings |
| Synchronous LLM summarization in request path | API timeouts during summary generation | Async queue: generate summary after meeting ends, not on demand | Any meeting over 30 min |
| No WebSocket reconnect logic | Partial transcripts when network hiccups | Implement reconnect with exponential backoff + audio buffer replay | Any network instability |
| Transcription on single server thread | Bot backlog during meeting spikes | Async task queue (Celery/Bull) for transcription jobs | 3+ concurrent meetings |
| Fetching full transcript for display | Slow page load for long meetings | Paginate transcript segments, load first N segments, lazy-load rest | Any meeting over 30 min |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Google OAuth tokens unencrypted in DB | Token theft gives full Calendar + Meet access | Encrypt tokens at rest using application-level encryption |
| Sharing transcript URLs without access control | Internal meeting content exposed to unauthorized users | All transcript/summary endpoints must require authenticated session |
| Logging full transcript content in application logs | Sensitive meeting content in log aggregators | Never log transcript content; log only session IDs and byte counts |
| No rate limiting on LLM endpoints | Cost explosion if endpoint is called in a loop | Rate limit summary generation per user per meeting |
| Vexa API key in frontend code | API key exposed, allows unauthorized bot creation | API key must only be in server-side environment variables |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "processing" indefinitely when bot failed to capture audio | Users wait for a transcript that will never arrive | Show "recording failed" with explanation after 5-minute timeout |
| No indication bot is in waiting room | Users don't know to admit the bot | Send a notification to the meeting organizer: "Your recording bot is waiting to be admitted" |
| Displaying raw transcript without speaker labels | Confusing wall of text | Always display speaker labels, even as "Speaker 1", "Speaker 2" |
| Summary with no link to transcript | Users can't verify summary claims | Always link summary back to timestamped transcript |
| No "missed meeting" recovery | Users lose faith in auto-join reliability | Surface missed meetings explicitly with "retry" or "upload audio" option |

---

## "Looks Done But Isn't" Checklist

- [ ] **Bot integration:** Bot joins meetings AND audio capture is confirmed by first transcript segment — verify with integration test against real Google Meet
- [ ] **Calendar sync:** Webhook channel renewal job runs and is tested by manually expiring a channel
- [ ] **OAuth tokens:** Token refresh flow is tested by manually revoking access and verifying the user sees a "reconnect" prompt
- [ ] **Transcript storage:** Data is stored from WebSocket stream in your DB — verify a Vexa session_uid mismatch does not cause data loss
- [ ] **Search:** `EXPLAIN ANALYZE` shows GIN index is used on transcript content queries
- [ ] **AI summaries:** Summaries for 2-hour meetings tested and verified (not just 30-minute test meetings)
- [ ] **Storage lifecycle:** S3 lifecycle rules are active and verified with an aged test object

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bot never captured audio for a meeting | MEDIUM | If meeting was recorded elsewhere (Zoom cloud, Meet recording), implement manual audio upload + transcription pipeline |
| Webhook channel expired, meetings missed | LOW | Re-register webhook channel; missed meetings cannot be auto-recovered without a Calendar poll fallback |
| session_uid mismatch caused transcript loss | HIGH | If WebSocket stream was not persisted independently, transcript is unrecoverable; recovery requires re-ingestion from external recording |
| LLM summary hallucination noticed | LOW | Re-generate summary with stricter prompt; update prompt engineering for all future summaries |
| PostgreSQL search degraded | MEDIUM | Add GIN index on existing data (blocking operation on large table); use `CREATE INDEX CONCURRENTLY` to avoid downtime |
| Storage costs out of control | LOW | Apply lifecycle rules retroactively; delete audio files older than policy threshold |
| OAuth token expired for a user | LOW | Surface re-auth prompt; user re-authenticates in under 2 minutes |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Bot waiting room timeout | Phase 1: Bot lifecycle | Integration test: bot joined external meeting, host never admitted → system sends alert |
| Bot ACTIVE but no audio | Phase 1: Bot lifecycle | Health check test: 5-minute ACTIVE meeting with zero segments triggers alert |
| Transcript session_uid mismatch | Phase 1: Data ownership | Verify transcripts retrieved from your DB, not only Vexa API |
| Calendar webhook expiration | Phase 1: Calendar integration | Manually expire channel, verify renewal job re-registers within 24 hours |
| OAuth refresh token expiration | Phase 1: Calendar integration | Revoke token, verify "reconnect calendar" prompt appears |
| AI summary hallucination | Phase 2: Summarization | Red-team test: generate summary from sparse transcript, check for invented content |
| Context window overflow | Phase 2: Summarization | Test with 2-hour meeting transcript before launch |
| Search degradation at scale | Phase 1: Schema design | `EXPLAIN ANALYZE` GIN index used on test dataset of 1,000 meetings |
| Speaker diarization errors | Phase 1: Transcription | Validate accuracy on team's real voice profiles before Phase 3 analytics |
| Storage growth | Phase 1: Infrastructure | S3 lifecycle rules verified before first production meeting |
| Whisper repetition artifact | Phase 1: Transcript pipeline | Unit test transcript normalization on known artifact samples |
| Zoom Marketplace approval | Phase 1: Planning | Decision documented: build for Google Meet first, Zoom only after approval obtained |
| Mutable vs finalized transcript | Phase 1: Data pipeline | Integration test: stored transcript matches REST API final transcript, not WebSocket stream |

---

## Sources

- Vexa GitHub issues — bot lifecycle failures, audio capture bugs, session_uid mismatch, Whisper repetition artifacts: https://github.com/Vexa-ai/vexa/issues (MEDIUM confidence)
- Vexa release notes — v0.4.1 critical bug fix, v0.3.2 resilience upgrades, v0.6 Teams support: https://github.com/Vexa-ai/vexa/releases (MEDIUM confidence)
- Google Calendar push notification documentation — channel expiration and renewal requirements: https://developers.google.com/workspace/calendar/api/guides/push (MEDIUM confidence)
- Recall.ai FAQ — bot waiting room behavior, 8-minute timeout, host admission requirement: https://docs.recall.ai/docs/google-meet-faq (MEDIUM confidence)
- Recall.ai — waiting room race conditions and Zoom SDK issues: https://www.recall.ai/blog/why-are-waiting-rooms-causing-issues-with-the-zoom-web-meeting-sdk (MEDIUM confidence)
- OpenAI Whisper GitHub discussions — speaker diarization accuracy limits, overlapping speech unresolved: https://github.com/openai/whisper/discussions/264 (MEDIUM confidence)
- WhisperX — diarization error rates 20-40% in production conditions: https://github.com/m-bain/whisperX (MEDIUM confidence)
- PostgreSQL FTS scaling — `ts_rank` on millions of rows, GIN index requirement: https://www.meilisearch.com/blog/postgres-full-text-search-limitations (MEDIUM confidence)
- LLM hallucination in summarization tasks — 1-23% rate depending on domain and task: https://www.nature.com/articles/s41598-025-31075-1 (MEDIUM confidence)
- AWS S3 lifecycle management for audio storage cost control: https://avm.io/aws-s3-lifecycle-management-2025-best-practices/ (MEDIUM confidence)
- Google OAuth token expiration and refresh failure patterns: https://github.com/freeCodeCamp/chapter/issues/1885 (MEDIUM confidence)
- WebSocket reconnection and audio buffer management for real-time transcription: https://support.voicegain.ai/hc/en-us/articles/16003114572692-Three-types-of-websockets-for-receiving-real-time-transcription-results (LOW confidence)
- Deepgram noise reduction paradox — aggressive denoising can hurt accuracy: https://deepgram.com/learn/the-noise-reduction-paradox-why-it-may-hurt-speech-to-text-accuracy (LOW confidence)

---

*Pitfalls research for: meeting intelligence platform (Vexa-based, TargetDialer)*
*Researched: 2026-02-23*
