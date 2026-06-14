"""Model registry & lifecycle controller (SCRUM-27, §7.4).

Public API used by training jobs, the eval harness, and ops:

    reg = ModelRegistry()
    card = reg.register(name="mr-encoder", version="0.1.0", stage="encoder", ...)
    reg.attach_eval(card.model_id, eval_report)     # checks promotion gates
    reg.promote(card.model_id)                       # -> staging (gate must pass)
    reg.sign_off(card.model_id)                      # reader-study sign-off
    reg.promote(card.model_id)                       # -> production (locks model)
    reg.rollback(prod_id, reason="drift")            # -> rejected, audited

Every state change is recorded in an append-only audit log (NFR-07).
"""
from __future__ import annotations

import datetime as _dt
from typing import Any, Optional

from ..config import EvalGates, MLEngineSettings, settings as default_settings
from .gates import GateResult, check_gates
from .models import (
    ALLOWED_TRANSITIONS, DataProvenance, EvalReport, IntendedUse, Lifecycle, ModelCard,
)
from .storage import RegistryStore


def _now() -> str:
    # timezone-aware UTC; avoids the deprecated utcnow().
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


class RegistryError(RuntimeError):
    pass


class ModelRegistry:
    def __init__(
        self,
        settings: MLEngineSettings | None = None,
        gate_cfg: EvalGates | None = None,
    ):
        self.settings = settings or default_settings
        self.settings.ensure_dirs()
        self.gate_cfg = gate_cfg
        self.store = RegistryStore(self.settings.registry_db)

    # ---- registration ------------------------------------------------------
    def register(
        self,
        *,
        name: str,
        version: str,
        stage: str = "encoder",
        artifact_uri: str = "",
        code_commit: str = "",
        config: Optional[dict[str, Any]] = None,
        data: Optional[DataProvenance] = None,
        intended_use: Optional[IntendedUse] = None,
    ) -> ModelCard:
        model_id = f"{name}:{version}"
        if self.store.get(model_id) is not None:
            raise RegistryError(f"{model_id} already registered (versions are immutable)")
        now = _now()
        card = ModelCard(
            name=name, version=version, stage=stage, artifact_uri=artifact_uri,
            code_commit=code_commit, config=config or {},
            data=data or DataProvenance(), intended_use=intended_use or IntendedUse(),
            created_at=now, updated_at=now,
        )
        card.history.append({"action": "register", "at": now, "fingerprint": card.fingerprint()})
        self.store.upsert(card)
        self.store.audit(model_id, "register", f"stage={stage} commit={code_commit}", now)
        return card

    def get(self, model_id: str) -> ModelCard:
        card = self.store.get(model_id)
        if card is None:
            raise RegistryError(f"unknown model {model_id}")
        return card

    def list(self, **filters: Any) -> list[ModelCard]:
        return self.store.list(**filters)

    # ---- evaluation + gates ------------------------------------------------
    def attach_eval(self, model_id: str, report: EvalReport) -> GateResult:
        """Attach an evaluation report and run the promotion gates against it."""
        card = self.get(model_id)
        result = check_gates(report, self.gate_cfg)
        report.gate_passed = result.passed
        report.gate_failures = result.failures
        if not report.created_at:
            report.created_at = _now()
        card.eval_report = report
        self._transition(card, Lifecycle.EVALUATED,
                         detail=f"gate_passed={result.passed} failures={result.failures}")
        return result

    # ---- promotion / sign-off / rollback -----------------------------------
    def sign_off(self, model_id: str, reviewer: str = "") -> ModelCard:
        """Record reader-study sign-off, required before PRODUCTION (§7.4)."""
        card = self.get(model_id)
        card.reader_study_signoff = True
        card.updated_at = _now()
        card.history.append({"action": "reader_study_signoff", "by": reviewer, "at": card.updated_at})
        self.store.upsert(card)
        self.store.audit(model_id, "reader_study_signoff", f"by={reviewer}", card.updated_at)
        return card

    def promote(self, model_id: str) -> ModelCard:
        """Advance one lifecycle step, enforcing gates & sign-off.

        EVALUATED -> STAGING requires a passing eval gate.
        STAGING   -> PRODUCTION requires reader-study sign-off; locks the model
                     and archives any other production model with the same name.
        """
        card = self.get(model_id)
        if card.lifecycle == Lifecycle.EVALUATED:
            if not (card.eval_report and card.eval_report.gate_passed):
                fails = card.eval_report.gate_failures if card.eval_report else ["no eval report"]
                raise RegistryError(f"cannot promote {model_id}: eval gate not passed: {fails}")
            return self._transition(card, Lifecycle.STAGING, detail="gate passed")
        if card.lifecycle == Lifecycle.STAGING:
            if not card.reader_study_signoff:
                raise RegistryError(f"cannot promote {model_id}: reader-study sign-off required")
            self._archive_current_production(card.name, superseded_by=model_id)
            card.locked = True
            return self._transition(card, Lifecycle.PRODUCTION, detail="locked for regulated path")
        raise RegistryError(f"cannot promote from lifecycle={card.lifecycle.value}")

    def rollback(self, model_id: str, *, reason: str) -> ModelCard:
        """Roll a production model back (e.g. on drift). Audited (§7.5)."""
        card = self.get(model_id)
        return self._transition(card, Lifecycle.REJECTED, detail=f"rollback: {reason}")

    def reject(self, model_id: str, *, reason: str) -> ModelCard:
        card = self.get(model_id)
        return self._transition(card, Lifecycle.REJECTED, detail=f"reject: {reason}")

    def active_production(self, name: str) -> Optional[ModelCard]:
        prod = self.store.list(name=name, lifecycle=Lifecycle.PRODUCTION.value)
        return prod[0] if prod else None

    # ---- internals ---------------------------------------------------------
    def _archive_current_production(self, name: str, *, superseded_by: str) -> None:
        for c in self.store.list(name=name, lifecycle=Lifecycle.PRODUCTION.value):
            self._transition(c, Lifecycle.ARCHIVED, detail=f"superseded by {superseded_by}")

    def _transition(self, card: ModelCard, to: Lifecycle, *, detail: str = "") -> ModelCard:
        allowed = ALLOWED_TRANSITIONS.get(card.lifecycle, set())
        if to not in allowed and to != card.lifecycle:
            raise RegistryError(
                f"illegal transition {card.lifecycle.value} -> {to.value} for {card.model_id}"
            )
        now = _now()
        card.history.append({"action": f"->{to.value}", "at": now, "detail": detail})
        card.lifecycle = to
        card.updated_at = now
        self.store.upsert(card)
        self.store.audit(card.model_id, f"transition:{to.value}", detail, now)
        return card

    def audit_log(self, model_id: Optional[str] = None) -> list[dict[str, Any]]:
        return self.store.audit_log(model_id)

    def close(self) -> None:
        self.store.close()
