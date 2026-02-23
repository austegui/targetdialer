import { pgTable, text, uuid, timestamp, index, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const userRoleEnum = pgEnum("user_role", ["admin", "member"])

// TargetDialer user extension — links Google identity to Vexa user
export const tdUsers = pgTable("td_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: text("auth_user_id").notNull().unique(), // Auth.js users.id FK
  vexaUserId: text("vexa_user_id"), // Vexa internal user ID (nullable)
  role: userRoleEnum("role").notNull().default("member"),
  googleRefreshToken: text("google_refresh_token"), // Encrypted at rest
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Google Calendar watch channel subscriptions — for renewal tracking
export const tdCalendarSubscriptions = pgTable("td_calendar_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(), // Auth.js user.id
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
    vexaMeetingId: text("vexa_meeting_id").notNull(), // Vexa native_meeting_id
    platform: text("platform").notNull(), // "google_meet"
    sessionUid: text("session_uid"), // Vexa session_uid (nullable — bug workaround #96)
    speaker: text("speaker"), // May be null until diarization runs
    text: text("text").notNull(),
    startTime: text("start_time"), // Relative seconds (stored as text from Vexa)
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
  botStatus: text("bot_status").default("requested"), // requested|joining|awaiting_admission|active|stopping|completed|failed
  segmentCount: text("segment_count").default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
