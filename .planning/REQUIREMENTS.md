# Requirements: TargetDialer

**Defined:** 2026-02-23
**Core Value:** Every team meeting is automatically captured, transcribed, and summarized — so nothing falls through the cracks and the team can search across all past conversations.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign in with Google OAuth (Google Workspace accounts)
- [ ] **AUTH-02**: Admin can manage team settings; members can view meetings and transcripts (role-based access)

### Calendar Integration

- [ ] **CAL-01**: System watches Google Calendar for upcoming meetings with Google Meet links
- [ ] **CAL-02**: System auto-dispatches Vexa bot to join detected meetings
- [ ] **CAL-03**: Background job auto-renews Calendar webhook channels before 7-day expiry
- [ ] **CAL-04**: User can configure which meetings to auto-join (all, selected calendars, keyword filters)

### Recording & Transcription

- [ ] **REC-01**: Vexa bot joins Google Meet and captures audio
- [ ] **REC-02**: Real-time transcription via Whisper with timestamps and speaker diarization
- [ ] **REC-03**: Transcripts stored in TargetDialer's own database (not dependent on Vexa retention)

### AI Summaries

- [ ] **AI-01**: Auto-generated post-meeting summary with key points
- [ ] **AI-02**: Action items extraction with assignees and key decisions identified
- [ ] **AI-03**: Confidence flagging on AI-generated content to surface potential hallucinations
- [ ] **AI-04**: Configurable summary templates for different meeting types

### Search & Archive

- [ ] **SRCH-01**: Full-text search across all meeting transcripts by keyword, speaker, or topic
- [ ] **SRCH-02**: Meeting list view with filters (date, participants, duration)
- [ ] **SRCH-03**: Audio playback with timestamp navigation

### Analytics

- [ ] **ANLY-01**: Per-meeting stats (duration, participants, talk-time breakdown)
- [ ] **ANLY-02**: Speaker talk-time percentages and talk ratio analysis
- [ ] **ANLY-03**: Topic trends tracked across meetings over time
- [ ] **ANLY-04**: Org-level meeting patterns (frequency, total hours, engagement trends)

### Integrations

- [ ] **INTG-01**: Slack notification with meeting summary posted to configured channel after meeting ends

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Real-Time Features

- **RT-01**: Live transcript view during active meetings
- **RT-02**: Multi-language transcription support

### Advanced AI

- **AAI-01**: AI Q&A over meeting history (RAG-based semantic search)
- **AAI-02**: Auto-generated follow-up email drafts
- **AAI-03**: Meeting clips and highlights extraction

### Additional Integrations

- **AINT-01**: Keyword/topic trackers with alerts
- **AINT-02**: Export transcripts as PDF or text

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| CRM sync | Internal team tool, no sales pipeline integration needed |
| Video recording | Audio + transcription sufficient; video adds storage/bandwidth complexity |
| Microsoft Teams / Zoom support | Google Meet only for v1; team uses Google Workspace exclusively |
| Mobile app | Web-first; mobile deferred to post-v1 |
| External / customer-facing access | Internal tool for TargetDial team only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| CAL-01 | — | Pending |
| CAL-02 | — | Pending |
| CAL-03 | — | Pending |
| CAL-04 | — | Pending |
| REC-01 | — | Pending |
| REC-02 | — | Pending |
| REC-03 | — | Pending |
| AI-01 | — | Pending |
| AI-02 | — | Pending |
| AI-03 | — | Pending |
| AI-04 | — | Pending |
| SRCH-01 | — | Pending |
| SRCH-02 | — | Pending |
| SRCH-03 | — | Pending |
| ANLY-01 | — | Pending |
| ANLY-02 | — | Pending |
| ANLY-03 | — | Pending |
| ANLY-04 | — | Pending |
| INTG-01 | — | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after initial definition*
