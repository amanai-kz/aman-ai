"""Linear-probe evaluation for the 3D MRI encoder (SCRUM-21 acceptance #3).

The third SCRUM-21 acceptance criterion is:

    * linear-probe baseline beats from-scratch on a held-out task.

This module is that downstream evaluation. The protocol is the standard
self-supervised-learning readout:

  1. **Freeze** the encoder (no fine-tuning).
  2. Extract the pooled study embedding for every labelled volume.
  3. Standardise the features and fit a *linear* classifier (multinomial
     logistic regression) on a held-out train split.
  4. Score on the disjoint test split.

We run that protocol for two encoders on the *same* split with the *same* probe
hyper-parameters — the SSL-**pretrained** encoder and a **from-scratch** (random
init, identical architecture) encoder — and report whether the pretrained
features are more linearly separable. If they are, the SSL objective learned
something useful beyond the random-feature baseline, which is exactly what the
acceptance criterion asks for.

Data
----
* **Real run:** ``--data-dir DIR --labels labels.csv`` (CSV of ``path,label``)
  with ``--ckpt`` pointing at an encoder checkpoint from
  :mod:`ml_engine.encoder.train`. The checkpoint's ``cfg`` is reused so the two
  encoders match its architecture exactly.
* **Self-contained demonstration:** with no checkpoint, the CLI builds a
  class-structured synthetic task, SSL-pretrains a small encoder on it, and runs
  the comparison end-to-end on CPU. This exercises the criterion without needing
  a GPU or licensed data; the production verdict comes from the real run.

The probe is implemented in torch only (no scikit-learn dependency) so it runs
anywhere the training stack does; AUROC reuses :func:`ml_engine.evaluation.triage.auroc`.
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

from ..evaluation.triage import auroc
from .encoder import EncoderConfig, MRIEncoder3D


# --------------------------------------------------------------------------- #
# Labelled datasets
# --------------------------------------------------------------------------- #
class SyntheticProbeTask(Dataset):
    """Labelled volumes whose class is encoded as low-frequency spatial structure.

    Each sample is a smooth random field (so masked reconstruction is
    non-trivial) plus a Gaussian blob whose *position along the depth axis*
    depends on the class. A masked-volume SSL encoder has to represent that
    structure to reconstruct masked patches, so its features should be more
    linearly separable by class than a random encoder's — making this a fair,
    self-contained stand-in for a real held-out downstream task.
    """

    data_source = "synthetic-probe-task"

    def __init__(self, cfg: EncoderConfig, n: int = 160, n_classes: int = 2,
                 seed: int = 0, blob_amp: float = 3.0, noise: float = 1.0):
        self.cfg = cfg
        self.n = n
        self.n_classes = n_classes
        self.seed = seed
        self.blob_amp = blob_amp
        self.noise = noise
        g = torch.Generator().manual_seed(seed)
        # balanced-ish labels, deterministic
        self.labels = torch.randint(0, n_classes, (n,), generator=g)

    def __len__(self) -> int:
        return self.n

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        c = int(self.labels[idx])
        g = torch.Generator().manual_seed(self.seed * 100_003 + idx)
        d, h, w = self.cfg.img_size
        ch = self.cfg.in_channels

        # smooth low-frequency background (shared across classes)
        coarse = torch.rand(ch, max(1, d // 4), max(1, h // 4), max(1, w // 4),
                            generator=g)
        base = F.interpolate(coarse.unsqueeze(0), size=(d, h, w), mode="trilinear",
                             align_corners=False).squeeze(0)

        # class-specific Gaussian blob, centred at a class-dependent depth
        zc = (c + 0.5) / self.n_classes
        zz = torch.linspace(0, 1, d).view(d, 1, 1)
        yy = torch.linspace(0, 1, h).view(1, h, 1)
        xx = torch.linspace(0, 1, w).view(1, 1, w)
        sigma = 0.18
        dist2 = (zz - zc) ** 2 + (yy - 0.5) ** 2 + (xx - 0.5) ** 2
        blob = torch.exp(-dist2 / (2 * sigma ** 2)).unsqueeze(0)  # (1, D, H, W)
        if ch > 1:
            blob = blob.expand(ch, d, h, w)

        vol = self.noise * base + self.blob_amp * blob
        vol = (vol - vol.mean()) / (vol.std() + 1e-6)
        return vol, c


class LabeledNiftiDataset(Dataset):
    """Folder of NIfTI volumes + a ``path,label`` CSV -> ``(volume, label)``.

    ``labels_csv`` rows are ``relative/path.nii.gz,label``; ``path`` is resolved
    against ``root``. String labels are mapped to contiguous integer class ids
    (sorted), exposed as :attr:`classes`. Volume loading/standardisation reuses
    :func:`ml_engine.encoder.data.load_nifti`, so the contract matches training.
    """

    data_source = "labeled-nifti"

    def __init__(self, root: str | Path, labels_csv: str | Path,
                 img_size=(128, 128, 128), in_channels: int = 1, cache: bool = True):
        self.root = Path(root)
        self.img_size = tuple(img_size)
        self.in_channels = in_channels
        rows: list[tuple[str, str]] = []
        with open(labels_csv, newline="", encoding="utf-8") as fh:
            for row in csv.reader(fh):
                if not row or row[0].strip().lower() in ("path", "file", "filename"):
                    continue  # skip blanks / header
                rows.append((row[0].strip(), row[1].strip()))
        if not rows:
            raise ValueError(f"no labelled rows in {labels_csv}")
        self.classes = sorted({lab for _, lab in rows})
        self._cls_to_idx = {c: i for i, c in enumerate(self.classes)}
        self.paths = [str(self.root / p) for p, _ in rows]
        self.labels = torch.tensor([self._cls_to_idx[lab] for _, lab in rows])
        self.n_classes = len(self.classes)
        self._cache: Optional[dict[int, torch.Tensor]] = {} if cache else None

    def __len__(self) -> int:
        return len(self.paths)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        if self._cache is not None and idx in self._cache:
            vol = self._cache[idx]
        else:
            from .data import load_nifti  # lazy: keep nibabel optional
            vol = load_nifti(self.paths[idx], img_size=self.img_size,
                             in_channels=self.in_channels)
            if self._cache is not None:
                self._cache[idx] = vol
        return vol, int(self.labels[idx])


# --------------------------------------------------------------------------- #
# Probe internals
# --------------------------------------------------------------------------- #
def _dataset_labels(dataset: Dataset) -> torch.Tensor:
    """Labels in dataset order (uses ``.labels`` if present, else iterates)."""
    labels = getattr(dataset, "labels", None)
    if labels is not None:
        return torch.as_tensor(labels).long()
    return torch.tensor([int(dataset[i][1]) for i in range(len(dataset))]).long()


@torch.no_grad()
def extract_embeddings(encoder: MRIEncoder3D, dataset: Dataset, *,
                       device: str = "cpu", batch_size: int = 8) -> torch.Tensor:
    """Frozen encoder -> ``(N, embed_dim)`` pooled study embeddings (no shuffle)."""
    dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")
    encoder.eval().to(dev)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)
    out: list[torch.Tensor] = []
    for batch in loader:
        vol = batch[0] if isinstance(batch, (list, tuple)) else batch
        out.append(encoder.encode(vol.to(dev)).float().cpu())
    return torch.cat(out, dim=0)


def stratified_split(labels: torch.Tensor, *, test_frac: float = 0.4,
                     seed: int = 0) -> tuple[torch.Tensor, torch.Tensor]:
    """Deterministic per-class train/test index split."""
    g = torch.Generator().manual_seed(seed)
    train_idx, test_idx = [], []
    for c in labels.unique().tolist():
        idx = torch.where(labels == c)[0]
        idx = idx[torch.randperm(len(idx), generator=g)]
        n_test = max(1, int(round(len(idx) * test_frac)))
        test_idx.append(idx[:n_test])
        train_idx.append(idx[n_test:])
    return (torch.cat(train_idx)[torch.randperm(sum(len(t) for t in train_idx), generator=g)],
            torch.cat(test_idx))


def fit_linear_probe(x_train: torch.Tensor, y_train: torch.Tensor, n_classes: int, *,
                     iters: int = 300, lr: float = 0.05, weight_decay: float = 1e-4,
                     seed: int = 0) -> nn.Linear:
    """Fit a multinomial logistic-regression head on frozen features.

    Full-batch optimisation of a convex objective on standardised inputs, so the
    fit is deterministic and near-optimal — a faithful *linear* readout.
    """
    torch.manual_seed(seed)
    clf = nn.Linear(x_train.shape[1], n_classes)
    opt = torch.optim.AdamW(clf.parameters(), lr=lr, weight_decay=weight_decay)
    loss_fn = nn.CrossEntropyLoss()
    clf.train()
    for _ in range(iters):
        opt.zero_grad(set_to_none=True)
        loss_fn(clf(x_train), y_train).backward()
        opt.step()
    clf.eval()
    return clf


def _balanced_accuracy(y_true: torch.Tensor, y_pred: torch.Tensor, n_classes: int) -> float:
    recalls = []
    for c in range(n_classes):
        mask = y_true == c
        if int(mask.sum()) > 0:
            recalls.append(float((y_pred[mask] == c).float().mean()))
    return float(np.mean(recalls)) if recalls else float("nan")


def _macro_auroc(y_true: torch.Tensor, probs: torch.Tensor, n_classes: int) -> float:
    yt = y_true.numpy()
    pr = probs.numpy()
    aucs = []
    for c in range(n_classes):
        a = auroc((yt == c).astype(int), pr[:, c])
        if a == a:  # skip NaN (class absent in a split)
            aucs.append(a)
    return float(np.mean(aucs)) if aucs else float("nan")


def _score(clf: nn.Linear, x: torch.Tensor, y: torch.Tensor, n_classes: int) -> dict[str, float]:
    with torch.no_grad():
        logits = clf(x)
        probs = torch.softmax(logits, dim=-1)
        pred = logits.argmax(dim=-1)
    return {
        "accuracy": float((pred == y).float().mean()),
        "balanced_accuracy": _balanced_accuracy(y, pred, n_classes),
        "macro_auroc": _macro_auroc(y, probs, n_classes),
    }


# --------------------------------------------------------------------------- #
# Probe + comparison
# --------------------------------------------------------------------------- #
def probe_embeddings(embeddings: torch.Tensor, labels: torch.Tensor,
                     train_idx: torch.Tensor, test_idx: torch.Tensor, n_classes: int, *,
                     probe_iters: int = 300, seed: int = 0) -> dict[str, float]:
    """Standardise (train stats), fit the linear probe, score the held-out split."""
    x_tr, x_te = embeddings[train_idx], embeddings[test_idx]
    mu, sd = x_tr.mean(0, keepdim=True), x_tr.std(0, keepdim=True).clamp_min(1e-6)
    x_tr, x_te = (x_tr - mu) / sd, (x_te - mu) / sd
    clf = fit_linear_probe(x_tr, labels[train_idx], n_classes,
                           iters=probe_iters, seed=seed)
    return _score(clf, x_te, labels[test_idx], n_classes)


def compare_encoders(pretrained: MRIEncoder3D, scratch: MRIEncoder3D, dataset: Dataset, *,
                     n_classes: Optional[int] = None, test_frac: float = 0.4,
                     probe_iters: int = 300, device: str = "cpu", seed: int = 0,
                     data_source: str = "") -> dict[str, Any]:
    """Run the linear probe for both encoders on one shared split and compare.

    ``beats_scratch`` is decided on **balanced accuracy** (robust to class
    imbalance); accuracy and macro-AUROC are reported alongside.
    """
    labels = _dataset_labels(dataset)
    n_classes = n_classes or int(labels.max()) + 1
    train_idx, test_idx = stratified_split(labels, test_frac=test_frac, seed=seed)

    emb_pre = extract_embeddings(pretrained, dataset, device=device)
    emb_scr = extract_embeddings(scratch, dataset, device=device)

    pre = probe_embeddings(emb_pre, labels, train_idx, test_idx, n_classes,
                           probe_iters=probe_iters, seed=seed)
    scr = probe_embeddings(emb_scr, labels, train_idx, test_idx, n_classes,
                           probe_iters=probe_iters, seed=seed)

    margin = pre["balanced_accuracy"] - scr["balanced_accuracy"]
    return {
        "criterion": "linear_probe_beats_from_scratch",
        "pretrained": pre,
        "scratch": scr,
        "beats_scratch": bool(pre["balanced_accuracy"] > scr["balanced_accuracy"]),
        "margin_balanced_accuracy": margin,
        "chance_balanced_accuracy": 1.0 / n_classes,
        "n_classes": n_classes,
        "n_train": int(len(train_idx)),
        "n_test": int(len(test_idx)),
        "embed_dim": int(emb_pre.shape[1]),
        "data": data_source or getattr(dataset, "data_source", "custom"),
    }


def _cfg_from_checkpoint(ckpt_path: str) -> EncoderConfig:
    state = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    cfg = state.get("cfg") if isinstance(state, dict) else None
    if not cfg:
        raise ValueError(f"checkpoint {ckpt_path} has no 'cfg'; pass encoder args explicitly")
    fields = EncoderConfig.__dataclass_fields__
    kept = {k: (tuple(v) if isinstance(v, list) else v) for k, v in cfg.items() if k in fields}
    return EncoderConfig(**kept)


def compare_pretrained_vs_scratch(dataset: Dataset, *, ckpt: Optional[str] = None,
                                  cfg: Optional[EncoderConfig] = None,
                                  n_classes: Optional[int] = None, test_frac: float = 0.4,
                                  probe_iters: int = 300, device: str = "cpu",
                                  seed: int = 0) -> dict[str, Any]:
    """Build a pretrained encoder (from ``ckpt``) + a from-scratch one and compare."""
    if ckpt:
        cfg = cfg or _cfg_from_checkpoint(ckpt)
    if cfg is None:
        raise ValueError("provide either a checkpoint (--ckpt) or an EncoderConfig")

    torch.manual_seed(seed)
    pretrained = MRIEncoder3D(cfg)
    if ckpt:
        pretrained.load_pretrained(ckpt)

    torch.manual_seed(seed + 1)          # independent random init for the baseline
    scratch = MRIEncoder3D(cfg)

    result = compare_encoders(pretrained, scratch, dataset, n_classes=n_classes,
                              test_frac=test_frac, probe_iters=probe_iters,
                              device=device, seed=seed)
    result["checkpoint"] = ckpt or ""
    return result


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #
def _flatten_probe_metrics(result: dict[str, Any]) -> dict[str, float]:
    flat = {
        "probe.beats_scratch": 1.0 if result["beats_scratch"] else 0.0,
        "probe.margin_balanced_accuracy": result["margin_balanced_accuracy"],
        "probe.chance_balanced_accuracy": result["chance_balanced_accuracy"],
    }
    for arm in ("pretrained", "scratch"):
        for k, v in result[arm].items():
            flat[f"probe.{arm}.{k}"] = v
    return flat


def register_probe_result(result: dict[str, Any], *, name: str, version: str,
                          code_commit: str = "", out_path: str = "",
                          registry: Any = None) -> str:
    """Record the probe comparison as its own registry card (audited).

    Kept as a dedicated ``stage="linear-probe"`` card rather than attached to the
    encoder's eval report, so the (triage-oriented) promotion gates are not run
    against an encoder readout. Returns the new ``model_id``.
    """
    from ..registry import DataProvenance, ModelRegistry
    reg = registry or ModelRegistry()
    card = reg.register(
        name=name, version=version, stage="linear-probe",
        artifact_uri=out_path, code_commit=code_commit,
        config={
            "evaluation": "linear_probe_vs_from_scratch",
            "encoder_checkpoint": result.get("checkpoint", ""),
            "data": result.get("data", ""),
            "n_classes": result.get("n_classes"),
            "n_train": result.get("n_train"), "n_test": result.get("n_test"),
            "embed_dim": result.get("embed_dim"),
            **_flatten_probe_metrics(result),
        },
        data=DataProvenance(
            eval_datasets=[result.get("data", "")], license_cleared=False,
            notes="SCRUM-21 acceptance #3: linear-probe beats from-scratch",
        ),
    )
    return card.model_id


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _synthetic_demo(args: argparse.Namespace) -> dict[str, Any]:
    """SSL-pretrain a small encoder on a class-structured task, then probe it."""
    from .train import run_training

    cfg = EncoderConfig(in_channels=1, img_size=(args.img_size,) * 3,
                        patch_size=(args.patch_size,) * 3, embed_dim=args.embed_dim,
                        depth=args.depth, num_heads=args.heads)
    task = SyntheticProbeTask(cfg, n=args.n, n_classes=args.n_classes, seed=args.seed)

    out_dir = Path(args.out_dir)
    summary = run_training(cfg, dataset=task, steps=args.ssl_steps,
                           batch_size=args.batch_size, warmup=max(1, args.ssl_steps // 10),
                           device=args.device, out_dir=out_dir, log_every=max(1, args.ssl_steps // 5),
                           name="mr-encoder-probe-demo", register=False, seed=args.seed)
    print(json.dumps({"ssl_pretrain": {"first_loss": summary["first_loss"],
                                       "final_loss": summary["final_loss"]}}), flush=True)

    result = compare_pretrained_vs_scratch(
        task, ckpt=summary["checkpoint"], n_classes=args.n_classes,
        test_frac=args.test_frac, probe_iters=args.probe_iters,
        device=args.device, seed=args.seed)
    result["data"] = task.data_source + " (SSL-pretrained demonstration)"
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="ml_engine.encoder.linear_probe",
        description="Linear-probe vs from-scratch evaluation for the MRI encoder (SCRUM-21 #3)")
    ap.add_argument("--ckpt", default=None, help="encoder checkpoint (from encoder.train)")
    ap.add_argument("--data-dir", default=None, dest="data_dir",
                    help="folder of labelled NIfTI volumes")
    ap.add_argument("--labels", default=None, help="CSV of path,label (with --data-dir)")
    ap.add_argument("--n-classes", type=int, default=2, dest="n_classes")
    ap.add_argument("--test-frac", type=float, default=0.4, dest="test_frac")
    ap.add_argument("--probe-iters", type=int, default=300, dest="probe_iters")
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--seed", type=int, default=0)
    # architecture (used only when no --ckpt to read cfg from)
    ap.add_argument("--img-size", type=int, default=32, dest="img_size")
    ap.add_argument("--patch-size", type=int, default=16, dest="patch_size")
    ap.add_argument("--embed-dim", type=int, default=128, dest="embed_dim")
    ap.add_argument("--depth", type=int, default=4)
    ap.add_argument("--heads", type=int, default=8)
    # synthetic demonstration knobs
    ap.add_argument("--n", type=int, default=200, help="synthetic sample count")
    ap.add_argument("--ssl-steps", type=int, default=150, dest="ssl_steps")
    ap.add_argument("--batch-size", type=int, default=8, dest="batch_size")
    ap.add_argument("--out", default="checkpoints", dest="out_dir")
    # registry
    ap.add_argument("--register", action="store_true",
                    help="record the probe result as a registry card")
    ap.add_argument("--name", default="mr-encoder-linear-probe")
    ap.add_argument("--version", default="0.1.0")
    ap.add_argument("--commit", default="", dest="code_commit")
    ap.add_argument("--result-out", default="", dest="result_out",
                    help="write the result JSON here")
    args = ap.parse_args(argv)

    if args.data_dir:
        if not args.labels:
            ap.error("--data-dir requires --labels")
        cfg = _cfg_from_checkpoint(args.ckpt) if args.ckpt else EncoderConfig(
            in_channels=1, img_size=(args.img_size,) * 3,
            patch_size=(args.patch_size,) * 3, embed_dim=args.embed_dim,
            depth=args.depth, num_heads=args.heads)
        ds = LabeledNiftiDataset(args.data_dir, args.labels, img_size=cfg.img_size,
                                 in_channels=cfg.in_channels)
        result = compare_pretrained_vs_scratch(
            ds, ckpt=args.ckpt, cfg=cfg, n_classes=ds.n_classes,
            test_frac=args.test_frac, probe_iters=args.probe_iters,
            device=args.device, seed=args.seed)
    elif args.ckpt:
        ap.error("--ckpt needs --data-dir/--labels (or omit --ckpt for the demo)")
    else:
        result = _synthetic_demo(args)

    if args.result_out:
        Path(args.result_out).write_text(json.dumps(result, indent=2, default=str))
    if args.register:
        result["registered"] = register_probe_result(
            result, name=args.name, version=args.version,
            code_commit=args.code_commit, out_path=args.result_out)

    print(json.dumps({"summary": result}, indent=2, default=str), flush=True)
    return 0 if result["beats_scratch"] else 4


if __name__ == "__main__":
    raise SystemExit(main())
