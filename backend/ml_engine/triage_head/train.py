"""Supervised triage-head training + calibration (SCRUM-24, §7.1 Stage D, §7.3).

Trains :class:`ml_engine.triage_head.TriageHead` (multi-label BCE) on pooled
encoder features, then fits the temperature scaler on a held-out split for
calibration. Reports the safety-critical metrics — sensitivity, AUROC, ECE —
and versions the checkpoint in the registry.

Scaffold caveat: features/labels are synthetic (a fixed linear rule over random
pooled features) so the supervised + calibration path is runnable and the
metrics are meaningful; real training uses encoder features over labelled
studies. See data-strategy §6.2 / decision D10.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F

from .classifier import TriageConfig, TriageHead


def make_rule(in_dim: int, n_classes: int, seed: int = 0) -> torch.Tensor:
    """The fixed labelling hyperplanes — shared across train/val so the task
    is learnable and the held-out metrics are meaningful."""
    return torch.randn(in_dim, n_classes, generator=torch.Generator().manual_seed(seed))


def make_synthetic(n: int, in_dim: int, n_classes: int, w: torch.Tensor, seed: int = 0):
    """Random pooled features labelled by the shared linear rule ``w`` (+ noise)."""
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(n, in_dim, generator=g)
    logits = x @ w + 0.3 * torch.randn(n, n_classes, generator=g)
    y = (logits > 0).float()
    return x, y


def _metrics(probs: torch.Tensor, y: torch.Tensor, threshold: float = 0.5,
             n_bins: int = 10) -> dict[str, float]:
    pred = (probs >= threshold).float()
    tp = (pred * y).sum()
    fn = ((1 - pred) * y).sum()
    tn = ((1 - pred) * (1 - y)).sum()
    fp = (pred * (1 - y)).sum()
    sens = float(tp / (tp + fn).clamp(min=1))
    spec = float(tn / (tn + fp).clamp(min=1))
    # AUROC (macro over classes, pairwise rank estimator)
    aurocs = []
    for c in range(y.shape[1]):
        pc, yc = probs[:, c], y[:, c]
        pos, neg = pc[yc == 1], pc[yc == 0]
        if len(pos) and len(neg):
            aurocs.append(float((pos.unsqueeze(1) > neg.unsqueeze(0)).float().mean()))
    auroc = sum(aurocs) / len(aurocs) if aurocs else float("nan")
    # ECE: for a binary decision the confidence is max(p, 1-p), not p.
    conf = torch.maximum(probs, 1 - probs).flatten()
    correct = (pred.flatten() == y.flatten()).float()
    ece = 0.0
    for b in range(n_bins):
        lo, hi = b / n_bins, (b + 1) / n_bins
        m = (conf > lo) & (conf <= hi)
        if m.any():
            ece += float(m.float().mean()) * abs(float(correct[m].mean()) - float(conf[m].mean()))
    return {"sensitivity": sens, "specificity": spec, "auroc": auroc, "ece": ece}


def run_triage_training(
    cfg: TriageConfig | None = None,
    *,
    in_dim: int = 768,
    steps: int = 300,
    batch_size: int = 64,
    lr: float = 1e-3,
    weight_decay: float = 1e-4,
    device: str = "cpu",
    n_train: int = 4096,
    n_val: int = 1024,
    log_every: int = 50,
    out_dir: str | Path = "checkpoints",
    name: str = "mr-triage",
    version: str = "0.1.0",
    register: bool = False,
    code_commit: str = "",
    seed: int = 0,
) -> dict[str, Any]:
    torch.manual_seed(seed)
    dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")
    cfg = cfg or TriageConfig()

    rule = make_rule(in_dim, cfg.num_classes, seed=seed)        # shared train/val rule
    xtr, ytr = make_synthetic(n_train, in_dim, cfg.num_classes, rule, seed=seed)
    xva, yva = make_synthetic(n_val, in_dim, cfg.num_classes, rule, seed=seed + 1)
    xtr, ytr, xva, yva = (t.to(dev) for t in (xtr, ytr, xva, yva))

    head = TriageHead(in_dim=in_dim, cfg=cfg).to(dev)
    opt = torch.optim.AdamW(head.net.parameters(), lr=lr, weight_decay=weight_decay)

    head.train()
    first_loss = last_loss = float("nan")
    for step in range(steps):
        idx = torch.randint(0, n_train, (batch_size,), device=dev)
        logits = head(xtr[idx])
        loss = F.binary_cross_entropy_with_logits(logits, ytr[idx])
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        last_loss = float(loss.detach().cpu())
        if step == 0:
            first_loss = last_loss
        if step % log_every == 0 or step == steps - 1:
            print(json.dumps({"step": step, "bce": last_loss}), flush=True)

    # Calibration: fit temperature on the held-out split (uncalibrated logits).
    head.eval()
    with torch.no_grad():
        val_logits = head(xva)
    temp = head.calibrator.fit(val_logits, yva)

    with torch.no_grad():
        pre = _metrics(torch.sigmoid(val_logits), yva)
        post = _metrics(torch.sigmoid(head.calibrator(val_logits)), yva)

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = out_dir / f"{name}-{version}.pt"
    torch.save({"model": head.state_dict(), "cfg": asdict(cfg),
                "in_dim": in_dim, "temperature": temp,
                "val_metrics": post}, ckpt_path)

    summary: dict[str, Any] = {
        "name": name, "version": version, "device": str(dev), "steps": steps,
        "first_loss": first_loss, "final_loss": last_loss, "temperature": temp,
        "val_sensitivity": post["sensitivity"], "val_auroc": post["auroc"],
        "ece_before": pre["ece"], "ece_after": post["ece"],
        "checkpoint": str(ckpt_path),
    }
    if register:
        from ..registry import ModelRegistry
        reg = ModelRegistry()
        card = reg.register(
            name=name, version=version, stage="triage",
            artifact_uri=str(ckpt_path.resolve()), code_commit=code_commit,
            config={**asdict(cfg), "in_dim": in_dim, "temperature": temp,
                    "val_metrics": post, "data": "synthetic"},
        )
        summary["registered"] = card.model_id
    print(json.dumps({"summary": summary}, default=str), flush=True)
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="ml_engine.triage_head.train",
                                 description="Triage head supervised train + calibration (SCRUM-24)")
    ap.add_argument("--in-dim", type=int, default=768, dest="in_dim")
    ap.add_argument("--steps", type=int, default=300)
    ap.add_argument("--batch-size", type=int, default=64, dest="batch_size")
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--out", default="checkpoints", dest="out_dir")
    ap.add_argument("--name", default="mr-triage")
    ap.add_argument("--version", default="0.1.0")
    ap.add_argument("--register", action="store_true")
    ap.add_argument("--commit", default="", dest="code_commit")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args(argv)
    run_triage_training(
        in_dim=a.in_dim, steps=a.steps, batch_size=a.batch_size, lr=a.lr,
        device=a.device, out_dir=a.out_dir, name=a.name, version=a.version,
        register=a.register, code_commit=a.code_commit, seed=a.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
