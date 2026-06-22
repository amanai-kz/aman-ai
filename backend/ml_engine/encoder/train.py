"""SSL pretraining loop for the 3D MRI encoder (SCRUM-21, §7.1 Stage A).

Drives :class:`ml_engine.encoder.MaskedVolumeSSL` through a masked-volume
reconstruction objective and versions the resulting checkpoint in the model
registry (SCRUM-27) — satisfying the SCRUM-21 acceptance criteria:

  * masked-volume SSL objective with an optimiser/schedule/AMP loop;
  * checkpoints versioned in the registry;
  * FOMO300K weights can warm-start via ``MRIEncoder3D.load_pretrained``.

Runs on CPU (tiny config, used by the smoke test) or on one/both A10 GPUs.

Scaffold caveats (deliberately explicit — do not mistake this for the final
training run):
  * **Data is synthetic.** Real pretraining needs FOMO300K / a commercially
    cleared partner dataset (blocked — see vault data-strategy §6.2 / decision
    D10). Swap :class:`SyntheticMRIVolumes` for the real loader; nothing else
    in the loop changes.
  * ``MaskedVolumeSSL`` now uses SimMIM-style input masking: masked patches are
    replaced with a learnable mask token before encoding and the loss is computed
    on the masked patches only against per-patch-normalised targets — a genuine
    self-supervised signal (not full-volume autoencoding).
  * Linear-probe-beats-from-scratch (the 3rd acceptance criterion) is a
    downstream eval, not part of this loop — tracked as a follow-up.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import torch
from torch.utils.data import DataLoader, Dataset

from .encoder import EncoderConfig, MRIEncoder3D, MaskedVolumeSSL


# --------------------------------------------------------------------------- #
# Data
# --------------------------------------------------------------------------- #
class SyntheticMRIVolumes(Dataset):
    """Placeholder dataset of structured-noise volumes.

    Stands in for FOMO300K / cleared partner data so the training pipeline is
    runnable today. Each sample is a single-sequence volume ``(C, D, H, W)``
    with smooth low-frequency structure (so reconstruction is non-trivial),
    seeded deterministically for reproducibility.
    """

    def __init__(self, cfg: EncoderConfig, length: int = 256, seed: int = 0):
        self.cfg = cfg
        self.length = length
        self.seed = seed

    def __len__(self) -> int:
        return self.length

    def __getitem__(self, idx: int) -> torch.Tensor:
        g = torch.Generator().manual_seed(self.seed + idx)
        d, h, w = self.cfg.img_size
        # low-res random field upsampled -> smooth spatial structure
        coarse = torch.rand(self.cfg.in_channels, d // 4 or 1, h // 4 or 1,
                            w // 4 or 1, generator=g)
        vol = torch.nn.functional.interpolate(
            coarse.unsqueeze(0), size=(d, h, w), mode="trilinear",
            align_corners=False,
        ).squeeze(0)
        # per-volume z-score (mimics intensity standardisation)
        return (vol - vol.mean()) / (vol.std() + 1e-6)


def patchify(vol: torch.Tensor, patch_size: tuple[int, int, int]) -> torch.Tensor:
    """``(B, C, D, H, W)`` -> ``(B, N, C*pz*py*px)`` in encoder token order.

    Patch ordering over the (D, H, W) grid is row-major, matching the flatten
    order of :class:`PatchEmbed3D`'s ``Conv3d`` output, so reconstruction
    targets line up with the encoder's patch tokens.
    """
    b, c, d, h, w = vol.shape
    pz, py, px = patch_size
    dg, hg, wg = d // pz, h // py, w // px
    x = vol.reshape(b, c, dg, pz, hg, py, wg, px)
    x = x.permute(0, 2, 4, 6, 1, 3, 5, 7).contiguous()
    return x.reshape(b, dg * hg * wg, c * pz * py * px)


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
    cfg: EncoderConfig,
    *,
    steps: int = 100,
    batch_size: int = 4,
    lr: float = 1.5e-4,
    weight_decay: float = 0.05,
    warmup: int = 10,
    grad_clip: float = 1.0,
    device: str = "cpu",
    amp: bool = False,
    data_parallel: bool = False,
    dataset_len: int = 1024,
    log_every: int = 10,
    out_dir: str | Path = "checkpoints",
    version: str = "0.1.0",
    name: str = "mr-encoder",
    register: bool = False,
    code_commit: str = "",
    data_dir: str | None = None,
    seed: int = 0,
) -> dict[str, Any]:
    torch.manual_seed(seed)
    dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")

    encoder = MRIEncoder3D(cfg)
    model = MaskedVolumeSSL(encoder).to(dev)

    multi_gpu = data_parallel and dev.type == "cuda" and torch.cuda.device_count() > 1
    train_model = torch.nn.DataParallel(model) if multi_gpu else model

    if data_dir:
        from .data import NiftiVolumeDataset
        ds = NiftiVolumeDataset(data_dir, img_size=cfg.img_size, in_channels=cfg.in_channels)
        data_source = f"nifti:{data_dir} ({len(ds)} volumes)"
    else:
        ds = SyntheticMRIVolumes(cfg, length=dataset_len, seed=seed)
        data_source = "synthetic-placeholder"
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True,
                        num_workers=2 if dev.type == "cuda" else 0)

    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay,
                            betas=(0.9, 0.95))
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: cosine_warmup(s, warmup=warmup, total=steps))
    use_amp = amp and dev.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    train_model.train()
    history: list[dict[str, float]] = []
    step = 0
    data_iter = iter(loader)
    first_loss = last_loss = float("nan")
    while step < steps:
        try:
            vol = next(data_iter)
        except StopIteration:
            data_iter = iter(loader)
            vol = next(data_iter)
        vol = vol.to(dev, non_blocking=True)
        target = patchify(vol, cfg.patch_size).to(dev, non_blocking=True)

        opt.zero_grad(set_to_none=True)
        with torch.autocast(device_type=dev.type, enabled=use_amp):
            loss = train_model(vol, target)
            if multi_gpu:                 # DataParallel gathers one scalar per replica
                loss = loss.mean()
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
        "objective": "masked_volume_ssl",
    }, ckpt_path)

    summary: dict[str, Any] = {
        "name": name,
        "version": version,
        "device": str(dev),
        "multi_gpu": multi_gpu,
        "amp": use_amp,
        "steps": step,
        "first_loss": first_loss,
        "final_loss": last_loss,
        "checkpoint": str(ckpt_path),
        "params_M": round(sum(p.numel() for p in encoder.parameters()) / 1e6, 2),
        "data": data_source,
    }

    if register:
        # Lazy import: keeps torch-only training decoupled from the registry.
        from ..registry import ModelRegistry
        reg = ModelRegistry()
        card = reg.register(
            name=name, version=version, stage="encoder",
            artifact_uri=str(ckpt_path.resolve()), code_commit=code_commit,
            config={**asdict(cfg), "objective": "masked_volume_ssl",
                    "steps": step, "final_loss": last_loss,
                    "data": data_source},
        )
        summary["registered"] = card.model_id

    print(json.dumps({"summary": summary}, default=str), flush=True)
    return summary


def _build_cfg(args: argparse.Namespace) -> EncoderConfig:
    s = args.img_size
    p = args.patch_size
    return EncoderConfig(
        in_channels=1,
        img_size=(s, s, s), patch_size=(p, p, p),
        embed_dim=args.embed_dim, depth=args.depth, num_heads=args.heads,
        mask_ratio=args.mask_ratio,
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="ml_engine.encoder.train",
                                 description="SSL pretrain the 3D MRI encoder (SCRUM-21)")
    ap.add_argument("--steps", type=int, default=100)
    ap.add_argument("--batch-size", type=int, default=4, dest="batch_size")
    ap.add_argument("--img-size", type=int, default=128, dest="img_size")
    ap.add_argument("--patch-size", type=int, default=16, dest="patch_size")
    ap.add_argument("--embed-dim", type=int, default=768, dest="embed_dim")
    ap.add_argument("--depth", type=int, default=12)
    ap.add_argument("--heads", type=int, default=12)
    ap.add_argument("--mask-ratio", type=float, default=0.75, dest="mask_ratio")
    ap.add_argument("--lr", type=float, default=1.5e-4)
    ap.add_argument("--warmup", type=int, default=10)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--amp", action="store_true", help="mixed precision (GPU)")
    ap.add_argument("--data-parallel", action="store_true", dest="data_parallel",
                    help="use all visible GPUs via DataParallel")
    ap.add_argument("--dataset-len", type=int, default=1024, dest="dataset_len")
    ap.add_argument("--out", default="checkpoints", dest="out_dir")
    ap.add_argument("--name", default="mr-encoder")
    ap.add_argument("--version", default="0.1.0")
    ap.add_argument("--register", action="store_true",
                    help="version the checkpoint in the model registry")
    ap.add_argument("--commit", default="", dest="code_commit")
    ap.add_argument("--data-dir", default=None, dest="data_dir",
                    help="folder of NIfTI volumes (real data); omit for synthetic")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args(argv)

    run_training(
        _build_cfg(args),
        steps=args.steps, batch_size=args.batch_size, lr=args.lr,
        warmup=args.warmup, device=args.device, amp=args.amp,
        data_parallel=args.data_parallel, dataset_len=args.dataset_len,
        out_dir=args.out_dir, version=args.version, name=args.name,
        register=args.register, code_commit=args.code_commit,
        data_dir=args.data_dir, seed=args.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
