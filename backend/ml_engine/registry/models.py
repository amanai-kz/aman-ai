"""Data model for the model registry (SCRUM-27).

A :class:`ModelCard` records, per release, everything the SRS §7.4 requires:
**data, code, config, metrics, and intended-use scope**. Models move through a
controlled :class:`Lifecycle` and can only reach ``PRODUCTION`` via a passing
promotion gate (see :mod:`ml_engine.registry.gates`).
"""
from __future__ import annotations

import enum
import hashlib
import json
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


class Lifecycle(str, enum.Enum):
    """Controlled model lifecycle (§7.4)."""

    REGISTERED = "registered"   # artifact recorded, not yet evaluated
    EVALUATED = "evaluated"     # has an attached evaluation report
    STAGING = "staging"         # passed eval gate, awaiting reader-study sign-off
    PRODUCTION = "production"   # promoted; locked for the regulated path
    ARCHIVED = "archived"       # superseded
    REJECTED = "rejected"       # failed a gate / rolled back


# Transitions allowed by the lifecycle state machine.
ALLOWED_TRANSITIONS: dict[Lifecycle, set[Lifecycle]] = {
    Lifecycle.REGISTERED: {Lifecycle.EVALUATED, Lifecycle.REJECTED, Lifecycle.ARCHIVED},
    Lifecycle.EVALUATED: {Lifecycle.STAGING, Lifecycle.REJECTED, Lifecycle.ARCHIVED},
    Lifecycle.STAGING: {Lifecycle.PRODUCTION, Lifecycle.REJECTED, Lifecycle.ARCHIVED},
    Lifecycle.PRODUCTION: {Lifecycle.ARCHIVED, Lifecycle.REJECTED},  # rollback -> rejected/archived
    Lifecycle.ARCHIVED: set(),
    Lifecycle.REJECTED: {Lifecycle.ARCHIVED},
}


@dataclass
class DataProvenance:
    """Exactly which data a model was trained and evaluated on (§6.4, §7.4)."""

    train_datasets: list[str] = field(default_factory=list)
    eval_datasets: list[str] = field(default_factory=list)
    dataset_hash: str = ""            # pinned hash of the frozen splits (§7.2)
    license_cleared: bool = False     # commercial-use clearance (§6.2 critical path)
    notes: str = ""


@dataclass
class IntendedUse:
    """Intended-use scope locked to each release (§4.1, §7.4)."""

    statement: str = ""
    modalities: list[str] = field(default_factory=lambda: ["T1", "T2", "FLAIR", "SWI"])
    anatomy: str = "brain"
    assistive_only: bool = True       # radiologist-in-the-loop; never autonomous


@dataclass
class EvalReport:
    """Output of the evaluation harness (SCRUM-26), attached to a model.

    ``metrics`` is a flat namespaced dict, e.g. ``{"triage.sensitivity": 0.97,
    "report.radgraph_f1": 0.43, "calibration.ece": 0.06}``. ``gate_passed`` and
    ``gate_failures`` are filled by :mod:`ml_engine.registry.gates`.
    """

    test_set: str = ""
    test_set_hash: str = ""
    metrics: dict[str, float] = field(default_factory=dict)
    subgroup_metrics: dict[str, dict[str, float]] = field(default_factory=dict)
    gate_passed: Optional[bool] = None
    gate_failures: list[str] = field(default_factory=list)
    created_at: str = ""

    def get(self, key: str, default: float = float("nan")) -> float:
        return self.metrics.get(key, default)


@dataclass
class ModelCard:
    """A single registered model release (§7.4)."""

    name: str
    version: str
    stage: str = "encoder"            # which SCRUM-7 stage produced it (A-E / eval / triage)
    lifecycle: Lifecycle = Lifecycle.REGISTERED
    artifact_uri: str = ""            # path/URI to checkpoint
    code_commit: str = ""             # git SHA of training code
    config: dict[str, Any] = field(default_factory=dict)
    data: DataProvenance = field(default_factory=DataProvenance)
    intended_use: IntendedUse = field(default_factory=IntendedUse)
    eval_report: Optional[EvalReport] = None
    reader_study_signoff: bool = False  # required for PRODUCTION (§7.4)
    locked: bool = False                # locked model for the regulated path
    created_at: str = ""
    updated_at: str = ""
    history: list[dict[str, Any]] = field(default_factory=list)  # audit trail (NFR-07)

    @property
    def model_id(self) -> str:
        return f"{self.name}:{self.version}"

    def fingerprint(self) -> str:
        """Stable content hash of the release's identifying inputs."""
        payload = json.dumps(
            {
                "name": self.name,
                "version": self.version,
                "code_commit": self.code_commit,
                "config": self.config,
                "dataset_hash": self.data.dataset_hash,
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["lifecycle"] = self.lifecycle.value
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "ModelCard":
        d = dict(d)
        d["lifecycle"] = Lifecycle(d.get("lifecycle", "registered"))
        d["data"] = DataProvenance(**d.get("data", {}))
        d["intended_use"] = IntendedUse(**d.get("intended_use", {}))
        er = d.get("eval_report")
        d["eval_report"] = EvalReport(**er) if er else None
        return cls(**d)
