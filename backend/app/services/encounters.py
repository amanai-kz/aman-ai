from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Encounter
from app.schemas.encounter import EncounterStatus

DEFAULT_STATE: dict[str, Any] = {
    "flow_step": None,
    "conversation_history_ref": None,
    "messages": [],
    "context": {},
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _merge_state(
    current: dict[str, Any] | None,
    update: dict[str, Any] | None,
) -> dict[str, Any]:
    state = {**DEFAULT_STATE, **(current or {})}
    if update:
        # Merge shallow keys; keep existing messages unless explicitly provided
        for key, value in update.items():
            if key == "messages" and isinstance(value, list):
                state["messages"] = value
            elif value is not None:
                state[key] = value
    return state


async def create_encounter(
    session: AsyncSession,
    *,
    user_id: str,
    initial_state: dict[str, Any] | None = None,
) -> Encounter:
    now = _utcnow()
    encounter = Encounter(
        id=str(uuid4()),
        user_id=user_id,
        status=EncounterStatus.active.value,
        state_json=_merge_state(None, initial_state),
        created_at=now,
        updated_at=now,
        last_activity_at=now,
    )
    session.add(encounter)
    await session.commit()
    await session.refresh(encounter)
    return encounter


async def _get_owned_encounter(
    session: AsyncSession,
    encounter_id: str,
    user_id: str,
) -> Encounter:
    encounter = await session.get(Encounter, encounter_id)
    if encounter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")
    if encounter.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Encounter does not belong to this user")
    return encounter


def _ensure_can_pause(encounter: Encounter) -> None:
    if encounter.status != EncounterStatus.active.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only active encounters can be paused",
        )


def _ensure_can_resume(encounter: Encounter) -> None:
    if encounter.status != EncounterStatus.paused.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only paused encounters can be resumed",
        )


async def pause_encounter(
    session: AsyncSession,
    *,
    encounter_id: str,
    user_id: str,
    state_update: dict[str, Any] | None = None,
) -> Encounter:
    encounter = await _get_owned_encounter(session, encounter_id, user_id)
    _ensure_can_pause(encounter)

    encounter.status = EncounterStatus.paused.value
    encounter.paused_at = _utcnow()
    encounter.last_activity_at = encounter.paused_at
    encounter.state_json = _merge_state(encounter.state_json, state_update)

    await session.commit()
    await session.refresh(encounter)
    return encounter


async def resume_encounter(
    session: AsyncSession,
    *,
    encounter_id: str,
    user_id: str,
) -> Encounter:
    encounter = await _get_owned_encounter(session, encounter_id, user_id)
    _ensure_can_resume(encounter)

    now = _utcnow()
    encounter.status = EncounterStatus.active.value
    encounter.resumed_at = now
    encounter.last_activity_at = now

    await session.commit()
    await session.refresh(encounter)
    return encounter


async def complete_encounter(
    session: AsyncSession,
    *,
    encounter_id: str,
    user_id: str,
) -> Encounter:
    encounter = await _get_owned_encounter(session, encounter_id, user_id)
    if encounter.status in {EncounterStatus.completed.value, EncounterStatus.cancelled.value}:
        return encounter

    now = _utcnow()
    encounter.status = EncounterStatus.completed.value
    encounter.last_activity_at = now

    await session.commit()
    await session.refresh(encounter)
    return encounter


async def append_message(
    session: AsyncSession,
    *,
    encounter_id: str,
    user_id: str,
    content: str,
    role: str,
    flow_step: str | None = None,
    context: dict[str, Any] | None = None,
) -> Encounter:
    encounter = await _get_owned_encounter(session, encounter_id, user_id)
    if encounter.status != EncounterStatus.active.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot add messages unless encounter is active",
        )

    state = _merge_state(encounter.state_json, None)
    messages: list[dict[str, Any]] = list(state.get("messages", []))
    messages.append(
        {
            "role": role,
            "content": content,
            "timestamp": _utcnow().isoformat(),
        }
    )
    state["messages"] = messages
    if flow_step is not None:
        state["flow_step"] = flow_step
    if context:
        merged_context = {**state.get("context", {}), **context}
        state["context"] = merged_context

    encounter.state_json = state
    encounter.last_activity_at = _utcnow()

    await session.commit()
    await session.refresh(encounter)
    return encounter


async def get_encounter(
    session: AsyncSession,
    *,
    encounter_id: str,
    user_id: str,
) -> Encounter:
    return await _get_owned_encounter(session, encounter_id, user_id)


async def list_encounters(
    session: AsyncSession,
    *,
    user_id: str,
    statuses: Iterable[str] | None = None,
) -> list[Encounter]:
    stmt = select(Encounter).where(Encounter.user_id == user_id)
    if statuses:
        stmt = stmt.where(Encounter.status.in_(list(statuses)))
    stmt = stmt.order_by(desc(Encounter.last_activity_at), desc(Encounter.created_at))

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def latest_active_or_paused(
    session: AsyncSession,
    *,
    user_id: str,
) -> Encounter | None:
    stmt = (
        select(Encounter)
        .where(
            Encounter.user_id == user_id,
            Encounter.status.in_(
                [
                    EncounterStatus.active.value,
                    EncounterStatus.paused.value,
                ]
            ),
        )
        .order_by(desc(Encounter.last_activity_at), desc(Encounter.created_at))
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalars().first()
