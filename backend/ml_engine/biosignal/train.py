"""SSL pretraining loop for the S2 biosignal encoder (SCRUM-68, MIMIC Phase 3).

Drives :class:`ml_engine.biosignal.MaskedBiosignalSSL` through a
masked-timestep reconstruction objective and versions the resulting
checkpoint in the model registry (mirrors
:mod:`ml_engine.encoder.train`'s Stage-A loop for the 3D MRI encoder).

Scaffold caveats (deliberately explicit — do not mistake this for a clinically
meaningful HRV model):
  * Real data is MIMIC-IV *demo* ICU ``chartevents`` — hourly-resampled vitals
    (HR, RR, SpO2, NIBP), **not** continuous PPG/ECG waveforms. See
    :mod:`ml_engine.ingestion.ehr`'s docstring for what would be needed for
    true HRV (credentialed MIMIC Waveform DB / MIMIC-IV-ECG).
  * Every MIMIC-derived checkpoint registers with ``license_cleared=False``
    and is never a production candidate (D10/D11,
    ``docs/mimic-data-strategy.md`` §6).
  * ``SyntheticVitalsWindows`` keeps the loop runnable without any data
    download at all (e.g. CI); swap in ``--mimic-dir`` for the real demo data,
    nothing else in the loop changes.
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict
from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

from .model import BiosignalEncoder1D, BiosignalEncoderConfig, MaskedBiosignalSSL, patchify_1d


# --------------------------------------------------------------------------- #
# Data
# --------------------------------------------------------------------------- #
class SyntheticVitalsWindows(Dataset):
    """Placeholder cohort of smooth, per-channel vitals windows.

    Stands in for real MIMIC ICU vitals so the training pipeline is runnable
    without any data download. Each sample is ``(C, T)`` with smooth
    low-frequency structure (so reconstruction is non-trivial), seeded
    deterministically for reproducibility.
    """

    def __init__(self, cfg: BiosignalEncoderConfig, length: int = 256, seed: int = 0):
        self.cfg = cfg
        self.length = length
        self.seed = seed

    def __len__(self) -> int:
        return self.length

    def __getitem__(self, idx: int) -> torch.Tensor:
        g = torch.Generator().manual_seed(self.seed + idx)
        t = self.cfg.seq_len
        coarse = torch.randn(self.cfg.in_channels, max(1, t // 4), generator=g)
        x = F.interpolate(coarse.unsqueeze(0), size=t, mode="linear",
                          align_corners=False).squeeze(0)
        return (x - x.mean(dim=-1, keepdim=True)) / (x.std(dim=-1, keepdim=True) + 1e-6)


class EhrVitalsDataset(Dataset):
    """Real MIMIC ICU-vitals windows (see :mod:`ml_engine.ingestion.ehr`)."""

    def __init__(self, mimic_dir: str, cfg: BiosignalEncoderConfig, **load_kwargs: Any):
        from ..ingestion.ehr import load_vitals_windows, normalise_windows
        windows, manifests = load_vitals_windows(
            mimic_dir, channels=cfg.channels, window_steps=cfg.seq_len, **load_kwargs,
        )
        self.windows = torch.from_numpy(normalise_windows(windows))
        self.manifests = manifests
        self.data_source = f"mimic-ehr:{mimic_dir} ({len(manifests)} stays)"

    def __len__(self) -> int:
        return len(self.windows)

    def __getitem__(self, idx: int) -> torch.Tensor:
        return self.windows[idx]


# --------------------------------------------------------------------------- #
# Schedule
# --------------------------------------------------------------------------- #
def cosine_warmup(step: int, *, warmup: int, total: int) -> float:
    """LR multiplier: linear warmup then cosine decay to ~0."""
    if step < warmup:
        return (step + 1) / max(1, warmup)
    progress = (step - warmup) / max(1, total - warmup)
    return 0.5 * (1.0 + math.cos(math.pi * min(1.0, progress)))


# --------------------------------------------------------------------------- #
# Training
# --------------------------------------------------------------------------- #
def run_training(
    cfg: BiosignalEncoderConfig,
    *,
    steps: int = 100,
    batch_size: int = 8,
    lr: float = 1.5e-4,
    weight_decay: float = 0.05,
    warmup: int = 10,
    grad_clip: float = 1.0,
    device: str = "cpu",
    amp: bool = False,
    dataset_len: int = 512,
    log_every: int = 10,
    out_dir: str | Path = "checkpoints",
    version: str = "0.1.0",
    name: str = "s2-biosignal-encoder",
    register: bool = False,
    code_commit: str = "",
    mimic_dir: str | None = None,
    dataset: Dataset | None = None,
    seed: int = 0,
) -> dict[str, Any]:
    torch.manual_seed(seed)
    dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")

    encoder = BiosignalEncoder1D(cfg)
    model = MaskedBiosignalSSL(encoder).to(dev)

    if dataset is not None:
        # Caller-supplied dataset (e.g. tests probing a specific cohort).
        ds = dataset
        data_source = getattr(dataset, "data_source", f"custom:{type(dataset).__name__}")
    elif mimic_dir:
        ds = EhrVitalsDataset(mimic_dir, cfg)
        data_source = ds.data_source
    else:
        ds = SyntheticVitalsWindows(cfg, length=dataset_len, seed=seed)
        data_source = "synthetic-placeholder"
    loader = DataLoader(ds, batch_size=min(batch_size, len(ds)), shuffle=True, drop_last=True,
                        num_workers=0)

    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay,
                            betas=(0.9, 0.95))
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: cosine_warmup(s, warmup=warmup, total=steps))
    use_amp = amp and dev.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    model.train()
    history: list[dict[str, float]] = []
    step = 0
    data_iter = iter(loader)
    first_loss = last_loss = float("nan")
    while step < steps:
        try:
            x = next(data_iter)
        except StopIteration:
            data_iter = iter(loader)
            x = next(data_iter)
        if isinstance(x, (list, tuple)):
            x = x[0]
        x = x.to(dev, non_blocking=True)
        target = patchify_1d(x, cfg.patch_size).to(dev, non_blocking=True)

        opt.zero_grad(set_to_none=True)
        with torch.autocast(device_type=dev.type, enabled=use_amp):
            loss = model(x, target)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
        scaler.step(opt)
        scaler.update()
        sched.step()

        last_loss = float(loss.detach().cpu())
        if step == 0:
            first_loss = last_loss
        if step % log_every == 0 or step == steps - 1:
            rec = {"step": step, "loss": last_loss, "lr": sched.get_last_lr()[0]}
            history.append(rec)
            print(json.dumps(rec), flush=True)
        step += 1

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = out_dir / f"{name}-{version}.pt"
    torch.save({
        "model": encoder.state_dict(),       # encoder-only -> load_pretrained compatible
        "cfg": asdict(cfg),
        "step": step,
        "final_loss": last_loss,
        "objective": "masked_biosignal_ssl",
    }, ckpt_path)

    summary: dict[str, Any] = {
        "name": name,
        "version": version,
        "device": str(dev),
        "amp": use_amp,
        "steps": step,
        "first_loss": first_loss,
        "final_loss": last_loss,
        "checkpoint": str(ckpt_path),
        "params_M": round(sum(p.numel() for p in encoder.parameters()) / 1e6, 3),
        "data": data_source,
    }

    if register:
        # Lazy import: keeps torch-only training decoupled from the registry.
        from ..registry import ModelRegistry
        from ..registry.models import DataProvenance
        reg = ModelRegistry()
        card = reg.register(
            name=name, version=version, stage="biosignal_encoder",
            artifact_uri=str(ckpt_path.resolve()), code_commit=code_commit,
            config={**asdict(cfg), "objective": "masked_biosignal_ssl",
                    "steps": step, "final_loss": last_loss},
            data=DataProvenance(
                train_datasets=[data_source], dataset_hash="", license_cleared=False,
                notes=("MIMIC-IV demo ICU vitals (or synthetic placeholder) — "
                       "R&D only, never a production candidate (D10/D11)."),
            ),
        )
        summary["registered"] = card.model_id

    print(json.dumps({"summary": summary}, default=str), flush=True)
    return summary


def _build_cfg(args: argparse.Namespace) -> BiosignalEncoderConfig:
    return BiosignalEncoderConfig(
        seq_len=args.seq_len, patch_size=args.patch_size,
        embed_dim=args.embed_dim, depth=args.depth, num_heads=args.heads,
        mask_ratio=args.mask_ratio,
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="ml_engine.biosignal.train",
        description="SSL pretrain the S2 biosignal encoder on MIMIC ICU vitals (SCRUM-68)")
    ap.add_argument("--steps", type=int, default=100)
    ap.add_argument("--batch-size", type=int, default=8, dest="batch_size")
    ap.add_argument("--seq-len", type=int, default=24, dest="seq_len")
    ap.add_argument("--patch-size", type=int, default=4, dest="patch_size")
    ap.add_argument("--embed-dim", type=int, default=128, dest="embed_dim")
    ap.add_argument("--depth", type=int, default=4)
    ap.add_argument("--heads", type=int, default=4)
    ap.add_argument("--mask-ratio", type=float, default=0.5, dest="mask_ratio")
    ap.add_argument("--lr", type=float, default=1.5e-4)
    ap.add_argument("--warmup", type=int, default=10)
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--amp", action="store_true", help="mixed precision (GPU)")
    ap.add_argument("--dataset-len", type=int, default=512, dest="dataset_len")
    ap.add_argument("--out", default="checkpoints", dest="out_dir")
    ap.add_argument("--name", default="s2-biosignal-encoder")
    ap.add_argument("--version", default="0.1.0")
    ap.add_argument("--register", action="store_true",
                    help="version the checkpoint in the model registry")
    ap.add_argument("--commit", default="", dest="code_commit")
    ap.add_argument("--mimic-dir", default=None, dest="mimic_dir",
                    help="MIMIC-IV demo root (e.g. ~/aman-data/mimic-iv-demo/2.2); "
                         "omit for synthetic data")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args(argv)

    run_training(
        _build_cfg(args),
        steps=args.steps, batch_size=args.batch_size, lr=args.lr,
        warmup=args.warmup, device=args.device, amp=args.amp,
        dataset_len=args.dataset_len, out_dir=args.out_dir, version=args.version,
        name=args.name, register=args.register, code_commit=args.code_commit,
        mimic_dir=args.mimic_dir, seed=args.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
