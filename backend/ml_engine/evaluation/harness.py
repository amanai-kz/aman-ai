"""Evaluation harness (SCRUM-26, §7.3).

One entry point that runs **NLG + clinical-efficacy + triage + calibration +
fairness** over a frozen test set and produces an :class:`EvalReport`. The
report can be handed straight to the registry, which checks promotion gates:

    harness = EvalHarness()
    report = harness.evaluate(samples, test_set="frozen-multisite-v1")
    reg.attach_eval(model_id, report)   # gates run here

A *sample* is a plain dict (JSON-friendly) so the harness is decoupled from the
models — see :data:`SAMPLE_SCHEMA_DOC`.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable, Optional, Sequence

from ..registry.models import EvalReport
from . import calibration, clinical, fairness, nlg, triage

SAMPLE_SCHEMA_DOC = """
Each sample is a dict with (all keys optional except study_id):
{
  "study_id": "S001",
  "report": {
     "hyp": "draft report text", "ref": "reference report text",
     "pred_labels": {"acute_infarct": 1, "mass_effect": 0},
     "ref_labels":  {"acute_infarct": 1, "mass_effect": 0},
     "pred_findings": [{"label":"infarct","anatomy":"left MCA","presence":"present",
                        "relations":[{"type":"location","target":"left MCA"}]}],
     "ref_findings":  [{"label":"infarct","anatomy":"left MCA","presence":"present"}]
  },
  "triage": {"y_true": 1, "y_score": 0.97, "time_to_flag_s": 110.0},
  "subgroups": {"scanner":"GE", "field_strength":"3T", "site":"KZ-01",
                "age_group":"adult", "sex":"F"}
}
"""


@dataclass
class EvalConfig:
    triage_threshold: float = 0.5
    calibration_bins: int = 10
    label_set: Optional[Sequence[str]] = None
    green_grader: Optional[Callable[[str, str], float]] = None


class EvalHarness:
    def __init__(self, config: Optional[EvalConfig] = None):
        self.config = config or EvalConfig()

    def evaluate(self, samples: Sequence[dict[str, Any]], *, test_set: str = "") -> EvalReport:
        cfg = self.config

        # ---- collect columns -------------------------------------------------
        hyps, refs = [], []
        pred_labels, ref_labels = [], []
        pred_findings, ref_findings = [], []
        y_true, y_score, ttf = [], [], []
        subgroup_cols: dict[str, list] = {}

        for s in samples:
            rep = s.get("report") or {}
            if "hyp" in rep and "ref" in rep:
                hyps.append(rep["hyp"]); refs.append(rep["ref"])
            if "pred_labels" in rep and "ref_labels" in rep:
                pred_labels.append(rep["pred_labels"]); ref_labels.append(rep["ref_labels"])
            if "pred_findings" in rep and "ref_findings" in rep:
                pred_findings.append(rep["pred_findings"]); ref_findings.append(rep["ref_findings"])

            tr = s.get("triage") or {}
            if "y_true" in tr and "y_score" in tr:
                y_true.append(int(tr["y_true"])); y_score.append(float(tr["y_score"]))
                ttf.append(tr.get("time_to_flag_s"))
                for axis, val in (s.get("subgroups") or {}).items():
                    subgroup_cols.setdefault(axis, []).append(val)

        metrics: dict[str, float] = {}

        # ---- NLG -------------------------------------------------------------
        if hyps:
            metrics.update(nlg.all_nlg_metrics(hyps, refs))
            if cfg.green_grader is not None:
                metrics["report.green"] = clinical.green_score(hyps, refs, cfg.green_grader)

        # ---- clinical efficacy ----------------------------------------------
        if pred_labels:
            metrics.update(clinical.all_clinical_metrics(
                pred_labels, ref_labels, pred_findings or [[]] * len(pred_labels),
                ref_findings or [[]] * len(pred_labels), cfg.label_set,
            ))
        elif pred_findings:
            rg = clinical.radgraph_f1(pred_findings, ref_findings)
            metrics["report.radgraph_entity_f1"] = rg["entity_f1"]
            metrics["report.radgraph_relation_f1"] = rg["relation_f1"]
            metrics["report.radgraph_f1"] = rg["f1"]

        # ---- triage + calibration -------------------------------------------
        subgroup_metrics: dict[str, dict[str, dict[str, float]]] = {}
        if y_true:
            metrics.update(triage.all_triage_metrics(
                y_true, y_score, cfg.triage_threshold, ttf if any(ttf) else None))
            metrics.update(calibration.all_calibration_metrics(
                y_true, y_score, cfg.calibration_bins))

            # ---- fairness: triage sensitivity per subgroup ------------------
            thr = cfg.triage_threshold

            def _sens(yt: Sequence[int], ys: Sequence[float]) -> float:
                return triage.sensitivity(yt, [1 if v >= thr else 0 for v in ys])

            def _auroc(yt: Sequence[int], ys: Sequence[float]) -> float:
                return triage.auroc(yt, ys)

            if subgroup_cols:
                breakdown = fairness.subgroup_breakdown(
                    y_true, y_score, subgroup_cols,
                    {"triage.sensitivity": _sens, "triage.auroc": _auroc},
                )
                subgroup_metrics = breakdown

        report = EvalReport(
            test_set=test_set,
            test_set_hash=self._hash(samples),
            metrics=metrics,
            subgroup_metrics=subgroup_metrics,
            created_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
        )
        return report

    @staticmethod
    def _hash(samples: Sequence[dict[str, Any]]) -> str:
        try:
            blob = json.dumps(samples, sort_keys=True, default=str)
        except TypeError:
            blob = str(samples)
        return hashlib.sha256(blob.encode()).hexdigest()[:16]


def load_samples(path: str) -> list[dict[str, Any]]:
    """Load a JSON test set: either a list of samples or ``{"samples": [...]}``."""
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data["samples"] if isinstance(data, dict) and "samples" in data else data
