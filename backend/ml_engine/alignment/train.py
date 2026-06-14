"""Contrastive image-text alignment training (SCRUM-22, §7.1 Stage B).

Trains :class:`ml_engine.alignment.MRCLIP` with the symmetric InfoNCE objective
on (volume, report-text-embedding) pairs, warm-starting the image encoder from
the SCRUM-21 SSL checkpoint when available. Reports a zero-shot retrieval
baseline (batch image->text top-1) and versions the checkpoint in the registry.

Scaffold caveats: pairs are synthetic (deterministic per-sample volume + a
paired pseudo text embedding) so the loop is runnable today; real training uses
report-paired studies with a frozen clinical text encoder. See data-strategy
§6.2 / decision D10.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import torch
from torch.utils.data import DataLoader, Dataset

from ..encoder.encoder import EncoderConfig, MRIEncoder3D
from ..encoder.train import cosine_warmup
from .mr_clip import MRCLIP, MRCLIPConfig


class PairedVolumeText(Dataset):
    """Volume/text pairs built from a shared per-sample latent ``z``.

    Both the volume (a low-frequency field whose coarse content is a fixed
    linear function of ``z``) and the paired text embedding (another fixed
    linear function of ``z``) are generated from the *same* well-conditioned
    latent. The image<->text correspondence is therefore genuinely learnable —
    the encoder recovers ``z`` from the volume and aligns it with the text — so
    the contrastive loss drops and batch retrieval rises well above chance.
    Stands in for a real frozen clinical text encoder over paired reports.
    """

    POOL = 4

    def __init__(self, cfg: EncoderConfig, text_dim: int, length: int = 512,
                 latent_dim: int = 32, seed: int = 0):
        self.cfg = cfg
        self.text_dim = text_dim
        self.latent_dim = latent_dim
        self.length = length
        self.seed = seed
        coarse_dim = (self.POOL ** 3) * cfg.in_channels
        g = torch.Generator().manual_seed(seed * 100003 + 7)
        # fixed maps: latent -> coarse volume content, latent -> text embedding
        self.to_coarse = torch.randn(coarse_dim, latent_dim, generator=g) / (latent_dim ** 0.5)
        self.to_text = torch.randn(text_dim, latent_dim, generator=g) / (latent_dim ** 0.5)

    def __len__(self) -> int:
        return self.length

    def __getitem__(self, idx: int):
        g = torch.Generator().manual_seed(self.seed * 100003 + idx)
        z = torch.randn(self.latent_dim, generator=g)
        d, h, w = self.cfg.img_size
        coarse = (self.to_coarse @ z).reshape(self.cfg.in_channels, self.POOL, self.POOL, self.POOL)
        vol = torch.nn.functional.interpolate(
            coarse.unsqueeze(0), size=(d, h, w), mode="trilinear", align_corners=False
        ).squeeze(0)
        vol = vol + 0.05 * torch.randn(self.cfg.in_channels, d, h, w, generator=g)
        text = self.to_text @ z + 0.05 * torch.randn(self.text_dim, generator=g)
        return vol, text


@torch.no_grad()
def zero_shot_top1(model: MRCLIP, vol: torch.Tensor, text: torch.Tensor) -> float:
    """Batch image->text retrieval top-1 accuracy (diagonal = correct match)."""
    img = torch.nn.functional.normalize(model.encode_image(vol), dim=-1)
    txt = torch.nn.functional.normalize(model.encode_text(text), dim=-1)
    sims = img @ txt.t()
    pred = sims.argmax(dim=-1)
    target = torch.arange(vol.size(0), device=vol.device)
    return float((pred == target).float().mean())


def run_alignment_training(
    cfg: EncoderConfig,
    clip_cfg: MRCLIPConfig | None = None,
    *,
    steps: int = 100,
    batch_size: int = 16,
    lr: float = 5e-4,
    weight_decay: float = 0.1,
    warmup: int = 10,
    grad_clip: float = 1.0,
    device: str = "cpu",
    amp: bool = False,
    dataset_len: int = 512,
    log_every: int = 10,
    out_dir: str | Path = "checkpoints",
    name: str = "mr-clip",
    version: str = "0.1.0",
    encoder_ckpt: str | None = None,
    register: bool = False,
    code_commit: str = "",
    seed: int = 0,
) -> dict[str, Any]:
    torch.manual_seed(seed)
    dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")
    clip_cfg = clip_cfg or MRCLIPConfig()

    encoder = MRIEncoder3D(cfg)
    warm = []
    if encoder_ckpt:
        warm = encoder.load_pretrained(encoder_ckpt)      # FOMO/SSL warm start
    model = MRCLIP(encoder, clip_cfg).to(dev)

    ds = PairedVolumeText(cfg, clip_cfg.text_dim, length=dataset_len, seed=seed)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True,
                        num_workers=2 if dev.type == "cuda" else 0)

    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: cosine_warmup(s, warmup=warmup, total=steps))
    use_amp = amp and dev.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    model.train()
    it = iter(loader)
    first_loss = last_loss = float("nan")
    last_top1 = float("nan")
    for step in range(steps):
        try:
            vol, text = next(it)
        except StopIteration:
            it = iter(loader)
            vol, text = next(it)
        vol, text = vol.to(dev), text.to(dev)
        opt.zero_grad(set_to_none=True)
        with torch.autocast(device_type=dev.type, enabled=use_amp):
            loss = model(vol, text)["loss"]
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
        scaler.step(opt)
        scaler.update()
        # keep CLIP temperature in the stable CLIP range
        with torch.no_grad():
            model.logit_scale.clamp_(0, 4.6052)   # exp -> <=100
        sched.step()
        last_loss = float(loss.detach().cpu())
        if step == 0:
            first_loss = last_loss
        if step % log_every == 0 or step == steps - 1:
            model.eval()
            last_top1 = zero_shot_top1(model, vol, text)
            model.train()
            print(json.dumps({"step": step, "loss": last_loss,
                              "zeroshot_top1": last_top1,
                              "lr": sched.get_last_lr()[0]}), flush=True)

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = out_dir / f"{name}-{version}.pt"
    torch.save({"model": model.state_dict(), "cfg": asdict(cfg),
                "clip_cfg": asdict(clip_cfg), "final_loss": last_loss,
                "zeroshot_top1": last_top1, "objective": "info_nce"}, ckpt_path)

    summary: dict[str, Any] = {
        "name": name, "version": version, "device": str(dev), "amp": use_amp,
        "steps": steps, "first_loss": first_loss, "final_loss": last_loss,
        "zeroshot_top1": last_top1, "warm_start": bool(encoder_ckpt),
        "warm_start_missing_keys": len(warm), "checkpoint": str(ckpt_path),
    }
    if register:
        from ..registry import ModelRegistry
        reg = ModelRegistry()
        card = reg.register(
            name=name, version=version, stage="alignment",
            artifact_uri=str(ckpt_path.resolve()), code_commit=code_commit,
            config={**asdict(clip_cfg), "objective": "info_nce",
                    "zeroshot_top1": last_top1, "data": "synthetic-paired"},
        )
        summary["registered"] = card.model_id
    print(json.dumps({"summary": summary}, default=str), flush=True)
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="ml_engine.alignment.train",
                                 description="Contrastive image-text alignment (SCRUM-22)")
    ap.add_argument("--steps", type=int, default=100)
    ap.add_argument("--batch-size", type=int, default=16, dest="batch_size")
    ap.add_argument("--img-size", type=int, default=128, dest="img_size")
    ap.add_argument("--patch-size", type=int, default=16, dest="patch_size")
    ap.add_argument("--embed-dim", type=int, default=768, dest="embed_dim")
    ap.add_argument("--depth", type=int, default=12)
    ap.add_argument("--heads", type=int, default=12)
    ap.add_argument("--proj-dim", type=int, default=512, dest="proj_dim")
    ap.add_argument("--text-dim", type=int, default=768, dest="text_dim")
    ap.add_argument("--lr", type=float, default=5e-4)
    ap.add_argument("--warmup", type=int, default=10)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--amp", action="store_true")
    ap.add_argument("--dataset-len", type=int, default=512, dest="dataset_len")
    ap.add_argument("--out", default="checkpoints", dest="out_dir")
    ap.add_argument("--name", default="mr-clip")
    ap.add_argument("--version", default="0.1.0")
    ap.add_argument("--encoder-ckpt", dest="encoder_ckpt", help="SSL warm-start checkpoint")
    ap.add_argument("--register", action="store_true")
    ap.add_argument("--commit", default="", dest="code_commit")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args(argv)
    cfg = EncoderConfig(img_size=(a.img_size,) * 3, patch_size=(a.patch_size,) * 3,
                        embed_dim=a.embed_dim, depth=a.depth, num_heads=a.heads)
    run_alignment_training(
        cfg, MRCLIPConfig(proj_dim=a.proj_dim, text_dim=a.text_dim),
        steps=a.steps, batch_size=a.batch_size, lr=a.lr, warmup=a.warmup,
        device=a.device, amp=a.amp, dataset_len=a.dataset_len, out_dir=a.out_dir,
        name=a.name, version=a.version, encoder_ckpt=a.encoder_ckpt,
        register=a.register, code_commit=a.code_commit, seed=a.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
