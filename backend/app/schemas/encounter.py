from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class EncounterStatus(str, Enum):
    active = "active"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"


class EncounterCreateRequest(BaseModel):
    state: dict[str, Any] | None = None


class EncounterPauseRequest(BaseModel):
    state: dict[str, Any] | None = None


class EncounterMessageRequest(BaseModel):
    content: str
    role: Literal["user", "assistant", "system"] = "user"
    flow_step: str | None = None
    context: dict[str, Any] | None = None


class EncounterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    user_id: str
    status: EncounterStatus
    state: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
    paused_at: datetime | None = None
    resumed_at: datetime | None = None
    last_activity_at: datetime | None = None
