"""Clinical-efficacy metrics for reports (SCRUM-26, §7.3).

NLG metrics do not detect factual/clinical errors, so promotion is gated on
these instead:

* **CheXbert-style F1** — agreement on a fixed set of pathology labels.
* **RadGraph F1** — overlap of extracted clinical *entities* and *relations*
  against a reference (entity-F1 and relation-F1, plus their mean).
* **GREEN** — an LLM-graded factual-correctness score (optional; ``nan`` unless
  a grader callable is supplied).

These operate on **structured** representations the report generator
(SCRUM-23) emits alongside prose, so they do not require an external model.
"""
from __future__ import annotations

from typing import Callable, Mapping, Optional, Sequence


# ---- CheXbert-style multi-label F1 ----------------------------------------
def chexbert_f1(
    pred_labels: Sequence[Mapping[str, int]],
    ref_labels: Sequence[Mapping[str, int]],
    label_set: Optional[Sequence[str]] = None,
    average: str = "micro",
) -> float:
    """Multi-label F1 over a fixed pathology label set.

    Each item maps ``label -> {0,1}`` (1 = present). ``average`` is ``micro``
    (default) or ``macro``.
    """
    if not pred_labels:
        return float("nan")
    if label_set is None:
        label_set = sorted({k for d in list(pred_labels) + list(ref_labels) for k in d})
    if not label_set:
        return float("nan")

    def prf(tp: int, fp: int, fn: int) -> float:
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        return 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0

    if average == "micro":
        tp = fp = fn = 0
        for p, r in zip(pred_labels, ref_labels):
            for lab in label_set:
                pv, rv = int(p.get(lab, 0)), int(r.get(lab, 0))
                tp += pv & rv
                fp += pv & (1 - rv)
                fn += (1 - pv) & rv
        return prf(tp, fp, fn)

    # macro
    f1s = []
    for lab in label_set:
        tp = fp = fn = 0
        for p, r in zip(pred_labels, ref_labels):
            pv, rv = int(p.get(lab, 0)), int(r.get(lab, 0))
            tp += pv & rv
            fp += pv & (1 - rv)
            fn += (1 - pv) & rv
        f1s.append(prf(tp, fp, fn))
    return sum(f1s) / len(f1s) if f1s else float("nan")


# ---- RadGraph-style entity / relation F1 ----------------------------------
def _entity_set(findings: Sequence[Mapping]) -> set:
    """Set of (label, anatomy, presence) entity tuples from structured findings."""
    out = set()
    for f in findings:
        out.add((
            str(f.get("label", "")).lower(),
            str(f.get("anatomy", "")).lower(),
            str(f.get("presence", "present")).lower(),
        ))
    return out


def _relation_set(findings: Sequence[Mapping]) -> set:
    """Set of (label, relation, target) relation triples."""
    out = set()
    for f in findings:
        lab = str(f.get("label", "")).lower()
        for rel in f.get("relations", []) or []:
            out.add((lab, str(rel.get("type", "")).lower(), str(rel.get("target", "")).lower()))
    return out


def _set_f1(pred: set, ref: set) -> float:
    if not pred and not ref:
        return 1.0
    tp = len(pred & ref)
    prec = tp / len(pred) if pred else 0.0
    rec = tp / len(ref) if ref else 0.0
    return 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0


def radgraph_f1(
    pred_findings: Sequence[Sequence[Mapping]],
    ref_findings: Sequence[Sequence[Mapping]],
) -> dict[str, float]:
    """Entity-F1, relation-F1 and their mean over a list of studies."""
    if not pred_findings:
        return {"entity_f1": float("nan"), "relation_f1": float("nan"), "f1": float("nan")}
    ent, rel = [], []
    for p, r in zip(pred_findings, ref_findings):
        ent.append(_set_f1(_entity_set(p), _entity_set(r)))
        rel.append(_set_f1(_relation_set(p), _relation_set(r)))
    e = sum(ent) / len(ent)
    rl = sum(rel) / len(rel)
    return {"entity_f1": e, "relation_f1": rl, "f1": (e + rl) / 2}


# ---- GREEN (optional, LLM-graded) -----------------------------------------
def green_score(
    hypotheses: Sequence[str],
    references: Sequence[str],
    grader: Optional[Callable[[str, str], float]] = None,
) -> float:
    """Average GREEN factual-correctness score.

    Requires an LLM ``grader(hyp, ref) -> [0,1]``; returns ``nan`` if none given
    (keeps the harness runnable offline).
    """
    if grader is None or not hypotheses:
        return float("nan")
    scores = [float(grader(h, r)) for h, r in zip(hypotheses, references)]
    return sum(scores) / len(scores) if scores else float("nan")


def all_clinical_metrics(
    pred_labels: Sequence[Mapping[str, int]],
    ref_labels: Sequence[Mapping[str, int]],
    pred_findings: Sequence[Sequence[Mapping]],
    ref_findings: Sequence[Sequence[Mapping]],
    label_set: Optional[Sequence[str]] = None,
) -> dict[str, float]:
    rg = radgraph_f1(pred_findings, ref_findings)
    return {
        "report.chexbert_f1": chexbert_f1(pred_labels, ref_labels, label_set),
        "report.chexbert_f1_macro": chexbert_f1(pred_labels, ref_labels, label_set, average="macro"),
        "report.radgraph_entity_f1": rg["entity_f1"],
        "report.radgraph_relation_f1": rg["relation_f1"],
        "report.radgraph_f1": rg["f1"],
    }
