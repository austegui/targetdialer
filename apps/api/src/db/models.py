"""
SQLAlchemy model stubs for TargetDialer extension tables.

These are reference models for the Python service. Drizzle ORM (TypeScript)
is the source of truth for schema migrations. These models are used for
type-safe reads/writes from the Python FastAPI service.
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class TdMeeting(Base):
    """Meeting-level metadata owned by TargetDialer."""

    __tablename__ = "td_meetings"

    id = Column(UUID(as_uuid=True), primary_key=True)
    vexa_meeting_id = Column(String, nullable=False, unique=True)
    platform = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    calendar_event_id = Column(String, nullable=True)
    meeting_title = Column(String, nullable=True)
    scheduled_start_at = Column(DateTime(timezone=True), nullable=True)
    bot_joined_at = Column(DateTime(timezone=True), nullable=True)
    first_segment_at = Column(DateTime(timezone=True), nullable=True)
    meeting_ended_at = Column(DateTime(timezone=True), nullable=True)
    bot_status = Column(String, default="requested")
    segment_count = Column(String, default="0")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TdTranscriptSegment(Base):
    """Transcript segments owned by TargetDialer."""

    __tablename__ = "td_transcript_segments"

    id = Column(UUID(as_uuid=True), primary_key=True)
    vexa_meeting_id = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    session_uid = Column(String, nullable=True)  # Vexa bug #96 workaround
    speaker = Column(String, nullable=True)
    text = Column(Text, nullable=False)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    absolute_start_time = Column(DateTime(timezone=True), nullable=True)
    absolute_end_time = Column(DateTime(timezone=True), nullable=True)
    language = Column(String, default="en")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
