from __future__ import annotations

from typing import Iterable

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Encounter
from app.schemas.encounter import (
    EncounterCreateRequest,
    EncounterMessageRequest,
    EncounterPauseRequest,
    EncounterResponse,
    EncounterStatus,
)
from app.services.encounters import (
    append_message,
    complete_encounter,
    create_encounter,
    get_encounter,
    latest_active_or_paused,
    list_encounters,
    pause_encounter,
    resume_encounter,
)

router = APIRouter()


async def _resolve_user_id(
    x_user_id: str | None = Header(default=None),
    user_id: str | None = Query(default=None),
) -> str:
    """
    Temporary user resolution until real auth is wired.
    Prefers X-User-Id header, falls back to ?user_id= query param.
    """
    resolved = x_user_id or user_id
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User identity required (X-User-Id header)",
        )
    return resolved


def _status_values(values: Iterable[EncounterStatus]) -> list[str]:
    return [item.value for item in values]


def _to_response(encounter: Encounter) -> EncounterResponse:
    return EncounterResponse.model_validate(
        {
            "id": encounter.id,
            "user_id": encounter.user_id,
            "status": encounter.status,
            "state": encounter.state_json,
            "created_at": encounter.created_at,
            "updated_at": encounter.updated_at,
            "paused_at": encounter.paused_at,
            "resumed_at": encounter.resumed_at,
            "last_activity_at": encounter.last_activity_at,
        }
    )


@router.post("", response_model=EncounterResponse, status_code=status.HTTP_201_CREATED)
async def start_encounter(
    payload: EncounterCreateRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    Start a new encounter for the current user.
    """
    encounter = await create_encounter(
        session,
        user_id=user_id,
        initial_state=payload.state,
    )
    return _to_response(encounter)


@router.get("", response_model=list[EncounterResponse])
async def get_encounters(
    status_filter: list[EncounterStatus] | None = Query(default=None, alias="status"),
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    List encounters for the current user, optionally filtered by status.
    Results are ordered by last activity descending.
    """
    encounters = await list_encounters(
        session,
        user_id=user_id,
        statuses=_status_values(status_filter) if status_filter else None,
    )
    return [_to_response(item) for item in encounters]


@router.get("/active", response_model=EncounterResponse)
async def get_active_encounter(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    Return the most recently active or paused encounter for the user.
    """
    encounter = await latest_active_or_paused(session, user_id=user_id)
    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active or paused encounters found",
        )
    return _to_response(encounter)


@router.get("/{encounter_id}", response_model=EncounterResponse)
async def get_encounter_by_id(
    encounter_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    Get a specific encounter with its saved state.
    """
    encounter = await get_encounter(session, encounter_id=encounter_id, user_id=user_id)
    return _to_response(encounter)


@router.post("/{encounter_id}/pause", response_model=EncounterResponse)
async def pause(
    encounter_id: str,
    payload: EncounterPauseRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    Pause an active encounter and persist its state.
    """
    encounter = await pause_encounter(
        session,
        encounter_id=encounter_id,
        user_id=user_id,
        state_update=payload.state,
    )
    return _to_response(encounter)


@router.post("/{encounter_id}/resume", response_model=EncounterResponse)
async def resume(
    encounter_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    Resume a paused encounter and return its state.
    """
    encounter = await resume_encounter(
        session,
        encounter_id=encounter_id,
        user_id=user_id,
    )
    return _to_response(encounter)


@router.post("/{encounter_id}/complete", response_model=EncounterResponse)
async def complete(
    encounter_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    Mark an encounter as completed (no further pause/resume allowed).
    """
    encounter = await complete_encounter(
        session,
        encounter_id=encounter_id,
        user_id=user_id,
    )
    return _to_response(encounter)


@router.post("/{encounter_id}/messages", response_model=EncounterResponse)
async def add_message(
    encounter_id: str,
    payload: EncounterMessageRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(_resolve_user_id),
):
    """
    Append a message to the encounter history and persist the current step/context.
    """
    encounter = await append_message(
        session,
        encounter_id=encounter_id,
        user_id=user_id,
        content=payload.content,
        role=payload.role,
        flow_step=payload.flow_step,
        context=payload.context,
    )
    return _to_response(encounter)
