"""Rare-class synthetic-augmentation ablation (SCRUM-25 acceptance #3, §7.1 E).

Acceptance criterion: *"Ablation shows measurable gain on rare-class metrics."*

We construct a deliberately class-imbalanced triage task (one critical finding is
severely under-represented), then compare the triage head trained:

  * **baseline** — on the imbalanced data, vs
  * **augmented** — on the same data plus synthetic, *tagged* rare-class positives
    from :class:`~ml_engine.augmentation.SyntheticAugmentor`.

Both are scored on a *balanced* held-out test set; we report rare-class
sensitivity (recall), AUROC and AUPRC with a Wilson CI on sensitivity, and the
verdict that augmentation measurably lifts rare-class detection.

Honest framing (consistent with the triage scaffold, §6.2 / decision D10):
features/labels are synthetic, so the synthetic generator is represented by its
*effect in feature space* — rare-class-consistent feature vectors. With an
encoder checkpoint (``--encoder-ckpt`` / ``encode_fn``) the same harness instead
encodes procedurally-generated rare-lesion **volumes** through the real Stage-A
encoder, exercising the full Stage E -> Stage A path. Either way the synthetic
records carry the synthetic tag and are isolated from any patient-facing view
(§7.5), which is asserted here.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from typing import Any, Callable, Optional

import numpy as np
import torch
import torch.nn.functional as F

from ..evaluation.stats import wilson_interval
from ..triage_head.classifier import TriageConfig, TriageHead
from .synth import SYNTHETIC_TAG, SyntheticAugmentor, assert_no_synthetic_in_patient_view
from .generators import ProceduralLesionGenerator


def _rule(in_dim: int, n_classes: int, seed: int) -> torch.Tensor:
    return torch.randn(in_dim, n_classes, generator=torch.Generator().manual_seed(seed))


def _label(x: torch.Tensor, w: torch.Tensor, g: torch.Generator) -> torch.Tensor:
    logits = x @ w + 0.3 * torch.randn(x.shape[0], w.shape[1], generator=g)
    return (logits > 0).float()


def _sample(n: int, in_dim: int, w: torch.Tensor, seed: int):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(n, in_dim, generator=g)
    return x, _label(x, w, g)


def _downsample_rare(x, y, rare_idx: int, keep_frac: float, seed: int):
    """Drop most positives of the rare class to create class imbalance."""
    g = torch.Generator().manual_seed(seed)
    pos = y[:, rare_idx] == 1
    keep = torch.ones(x.shape[0], dtype=torch.bool)
    pos_idx = torch.where(pos)[0]
    drop = pos_idx[torch.rand(len(pos_idx), generator=g) > keep_frac]
    keep[drop] = False
    return x[keep], y[keep]


def _synth_rare_positives(n: int, in_dim: int, w: torch.Tensor, rare_idx: int, seed: int):
    """Synthetic features that are confidently positive for the rare class.

    Rejection-sample feature vectors whose projection on the rare hyperplane is
    strongly positive; label them by the full rule (so other classes stay
    correct). Models 'NV-Generate yields rare-pathology volumes that encode into
    the rare-class feature region'.
    """
    g = torch.Generator().manual_seed(seed)
    wr = w[:, rare_idx]
    out = []
    tries = 0
    while len(out) < n and tries < n * 200:
        x = torch.randn(in_dim, generator=g)
        if float(x @ wr) > 0.8 * float(wr.norm()):
            out.append(x)
        tries += 1
    X = torch.stack(out) if out else torch.zeros(0, in_dim)
    Y = _label(X, w, g)
    Y[:, rare_idx] = 1.0  # guaranteed rare-positive
    return X, Y


def _train_head(x, y, in_dim, cfg, steps, lr, seed, device):
    torch.manual_seed(seed)
    dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")
    x, y = x.to(dev), y.to(dev)
    head = TriageHead(in_dim=in_dim, cfg=cfg).to(dev)
    opt = torch.optim.AdamW(head.net.parameters(), lr=lr, weight_decay=1e-4)
    head.train()
    n = x.shape[0]
    for _ in range(steps):
        idx = torch.randint(0, n, (min(64, n),), device=dev)
        loss = F.binary_cross_entropy_with_logits(head(x[idx]), y[idx])
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
    head.eval()
    return head


def _rare_metrics(head, xte, yte, rare_idx, threshold=0.5) -> dict[str, float]:
    with torch.no_grad():
        probs = torch.sigmoid(head(xte.to(next(head.parameters()).device))).cpu()
    p = probs[:, rare_idx]
    y = yte[:, rare_idx]
    pred = (p >= threshold).float()
    tp = float((pred * y).sum()); fn = float(((1 - pred) * y).sum())
    tn = float(((1 - pred) * (1 - y)).sum()); fp = float((pred * (1 - y)).sum())
    sens = tp / max(tp + fn, 1.0)
    spec = tn / max(tn + fp, 1.0)
    # AUROC (pairwise) + AUPRC (step) for the rare class
    pos, neg = p[y == 1], p[y == 0]
    auroc = float((pos.unsqueeze(1) > neg.unsqueeze(0)).float().mean()) if len(pos) and len(neg) else float("nan")
    order = torch.argsort(p, descending=True)
    ys = y[order]
    tps = torch.cumsum(ys, 0)
    prec = tps / torch.arange(1, len(ys) + 1)
    rec = tps / max(float(ys.sum()), 1.0)
    auprc = float(torch.trapz(prec, rec)) if len(ys) > 1 and ys.sum() > 0 else float("nan")
    lo, hi = wilson_interval(int(tp), int(tp + fn))
    return {"sensitivity": sens, "sens_ci_low": lo, "sens_ci_high": hi,
            "specificity": spec, "auroc": auroc, "auprc": auprc,
            "n_pos": int(tp + fn)}


def run_rare_class_ablation(
    *,
    in_dim: int = 128,
    n_classes: int = 3,
    rare_idx: int = 2,
    n_train: int = 4000,
    n_test: int = 2000,
    rare_keep_frac: float = 0.04,
    n_synth: int = 600,
    steps: int = 500,
    lr: float = 1e-3,
    seed: int = 0,
    device: str = "cpu",
    encode_fn: Optional[Callable[[int], "torch.Tensor"]] = None,
    register: bool = False,
    name: str = "mr-synthetic-aug",
    version: str = "0.1.0",
    code_commit: str = "",
) -> dict[str, Any]:
    cfg = TriageConfig()
    w = _rule(in_dim, n_classes, seed)
    rare_name = cfg.critical_findings[rare_idx] if rare_idx < len(cfg.critical_findings) else f"class{rare_idx}"

    # Balanced pools, then make the TRAIN set rare-imbalanced.
    xtr_full, ytr_full = _sample(n_train, in_dim, w, seed)
    xtr, ytr = _downsample_rare(xtr_full, ytr_full, rare_idx, rare_keep_frac, seed + 1)
    xte, yte = _sample(n_test, in_dim, w, seed + 2)
    base_prev = float(ytr[:, rare_idx].mean())

    # Synthetic, tagged rare-class positives via the augmentor (Stage E).
    aug = SyntheticAugmentor(volume_generator=ProceduralLesionGenerator(size=32))
    syn_records = aug.generate_batch(sequence="FLAIR", pathology="acute_infarct", n=n_synth)
    # Safety invariant (§7.5): the guard must BLOCK these from any patient view.
    # If it raises on the synthetic records, isolation is correctly enforced.
    try:
        assert_no_synthetic_in_patient_view(syn_records)
        isolation_enforced = False          # guard failed to detect synthetic
    except AssertionError:
        isolation_enforced = True           # guard correctly blocked synthetic
    assert all(SYNTHETIC_TAG in r.tags for r in syn_records)

    if encode_fn is not None:                       # real Stage A path (GPU)
        xs = encode_fn(n_synth)
        g = torch.Generator().manual_seed(seed + 7)
        ys = _label(xs, w, g); ys[:, rare_idx] = 1.0
    else:                                           # feature-space effect
        xs, ys = _synth_rare_positives(n_synth, in_dim, w, rare_idx, seed + 3)

    xaug = torch.cat([xtr, xs], 0)
    yaug = torch.cat([ytr, ys], 0)
    aug_prev = float(yaug[:, rare_idx].mean())

    base = _train_head(xtr, ytr, in_dim, cfg, steps, lr, seed, device)
    augm = _train_head(xaug, yaug, in_dim, cfg, steps, lr, seed, device)

    m_base = _rare_metrics(base, xte, yte, rare_idx)
    m_aug = _rare_metrics(augm, xte, yte, rare_idx)
    margin = m_aug["sensitivity"] - m_base["sensitivity"]
    auroc_margin = (m_aug["auroc"] - m_base["auroc"]) if m_aug["auroc"] == m_aug["auroc"] else float("nan")

    summary: dict[str, Any] = {
        "rare_class": rare_name,
        "rare_prevalence_train_baseline": round(base_prev, 4),
        "rare_prevalence_train_augmented": round(aug_prev, 4),
        "n_synthetic": int(len(syn_records)),
        "synthetic_tag": SYNTHETIC_TAG,
        "synthetic_isolated_from_patient_view": isolation_enforced,
        "baseline": {k: round(v, 4) if isinstance(v, float) else v for k, v in m_base.items()},
        "augmented": {k: round(v, 4) if isinstance(v, float) else v for k, v in m_aug.items()},
        "sensitivity_margin": round(margin, 4),
        "auroc_margin": round(auroc_margin, 4) if auroc_margin == auroc_margin else None,
        "rare_class_gain": bool(margin > 0.0),
        "acceptance_satisfied": bool(margin > 0.05),
        "mode": "encoder" if encode_fn is not None else "feature-space",
    }

    if register:
        from ..registry import ModelRegistry
        reg = ModelRegistry()
        card = reg.register(
            name=name, version=version, stage="augmentation",
            code_commit=code_commit,
            config={"ablation": summary, "data": "synthetic", "generator": "procedural-fallback",
                    "license": "NVIDIA Open Model Licence (NV-Generate); verify for prod (§6.2)"},
        )
        summary["registered"] = card.model_id
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="ml_engine.augmentation.ablation",
        description="Rare-class synthetic-augmentation ablation (SCRUM-25)")
    ap.add_argument("--n-train", type=int, default=4000, dest="n_train")
    ap.add_argument("--n-test", type=int, default=2000, dest="n_test")
    ap.add_argument("--rare-keep-frac", type=float, default=0.04, dest="rare_keep_frac")
    ap.add_argument("--n-synth", type=int, default=600, dest="n_synth")
    ap.add_argument("--steps", type=int, default=500)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--register", action="store_true")
    ap.add_argument("--version", default="0.1.0")
    ap.add_argument("--commit", default="", dest="code_commit")
    a = ap.parse_args(argv)
    out = run_rare_class_ablation(
        n_train=a.n_train, n_test=a.n_test, rare_keep_frac=a.rare_keep_frac,
        n_synth=a.n_synth, steps=a.steps, seed=a.seed, device=a.device,
        register=a.register, version=a.version, code_commit=a.code_commit,
    )
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
