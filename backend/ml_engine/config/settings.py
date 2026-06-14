"""Central configuration for the MRI AI Engine.

Paths, registry location, and the evaluation **promotion gates** that a model
must pass before it can be promoted to ``production`` (SRS §7.3, §7.4).

All values are overridable via environment variables prefixed ``AMAN_ML_``.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any


def _env(key: str, default: str) -> str:
    return os.environ.get(f"AMAN_ML_{key}", default)


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(f"AMAN_ML_{key}", default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class EvalGates:
    """Promotion gates checked against a frozen, multi-site test set (§7.3).

    These are *illustrative* thresholds from the SRS; finalise with clinical +
    regulatory sign-off before relying on them.
    """

    # Report — clinical efficacy
    radgraph_f1_min: float = field(default_factory=lambda: _env_float("GATE_RADGRAPH_F1", 0.40))
    chexbert_f1_min: float = field(default_factory=lambda: _env_float("GATE_CHEXBERT_F1", 0.50))
    # Triage — detection. Sensitivity gate is the safety-critical one.
    triage_sensitivity_min: float = field(default_factory=lambda: _env_float("GATE_TRIAGE_SENS", 0.95))
    triage_auroc_min: float = field(default_factory=lambda: _env_float("GATE_TRIAGE_AUROC", 0.85))
    # Calibration — lower is better (Expected Calibration Error).
    ece_max: float = field(default_factory=lambda: _env_float("GATE_ECE_MAX", 0.10))
    # Fairness — max allowed gap between best and worst subgroup on the key metric.
    fairness_max_gap: float = field(default_factory=lambda: _env_float("GATE_FAIRNESS_GAP", 0.10))

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


@dataclass(frozen=True)
class MLEngineSettings:
    # Where the model registry + artifacts live.
    artifacts_root: Path = field(
        default_factory=lambda: Path(_env("ARTIFACTS_ROOT", str(Path.home() / ".aman" / "ml_engine")))
    )
    registry_db: Path = field(
        default_factory=lambda: Path(
            _env("REGISTRY_DB", str(Path.home() / ".aman" / "ml_engine" / "registry.db"))
        )
    )
    # Critical findings the triage head must detect (§7.1 Stage D, FR-05).
    critical_findings: tuple[str, ...] = (
        "intracranial_hemorrhage",
        "mass_effect",
        "acute_infarct",
    )
    # Supported MRI sequences (§3.3 FR-01).
    supported_sequences: tuple[str, ...] = ("T1", "T2", "FLAIR", "SWI")
    # Subgroup axes for fairness reporting (§7.3).
    fairness_axes: tuple[str, ...] = ("scanner", "field_strength", "site", "age_group", "sex")

    def ensure_dirs(self) -> None:
        self.artifacts_root.mkdir(parents=True, exist_ok=True)
        self.registry_db.parent.mkdir(parents=True, exist_ok=True)

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["artifacts_root"] = str(self.artifacts_root)
        d["registry_db"] = str(self.registry_db)
        return d


settings = MLEngineSettings()
gates = EvalGates()
