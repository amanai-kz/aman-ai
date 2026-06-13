"""3D MRI vision encoder + masked-volume SSL objective (SCRUM-21, §7.1 Stage A).

A patch-embedding 3D Vision Transformer over MRI volumes, pretrained with a
masked-volume reconstruction objective (MAE-style). FOMO300K published weights
are loaded as a warm start via :meth:`MRIEncoder3D.load_pretrained`. The encoder
features feed downstream alignment (SCRUM-22) and triage (SCRUM-24).

Acceptance criteria (SCRUM-21):
  * masked-volume / contrastive SSL on FOMO300K; FOMO weights warm-start;
  * checkpoints versioned in the registry (see ``ml_engine.registry``);
  * linear-probe baseline beats from-scratch on a held-out task.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import torch  # training-time dependency
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class EncoderConfig:
    in_channels: int = 1                 # per-sequence; sequences routed separately (§3.3 FR-03)
    img_size: tuple[int, int, int] = (128, 128, 128)
    patch_size: tuple[int, int, int] = (16, 16, 16)
    embed_dim: int = 768
    depth: int = 12
    num_heads: int = 12
    mlp_ratio: float = 4.0
    mask_ratio: float = 0.75             # MAE masking fraction
    drop: float = 0.0
    sequences: tuple[str, ...] = ("T1", "T2", "FLAIR", "SWI")

    @property
    def grid(self) -> tuple[int, int, int]:
        return tuple(i // p for i, p in zip(self.img_size, self.patch_size))  # type: ignore

    @property
    def num_patches(self) -> int:
        g = self.grid
        return g[0] * g[1] * g[2]


class PatchEmbed3D(nn.Module):
    def __init__(self, cfg: EncoderConfig):
        super().__init__()
        self.proj = nn.Conv3d(cfg.in_channels, cfg.embed_dim,
                              kernel_size=cfg.patch_size, stride=cfg.patch_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C, D, H, W) -> (B, N, embed_dim)
        x = self.proj(x)
        return x.flatten(2).transpose(1, 2)


class MRIEncoder3D(nn.Module):
    """3D ViT encoder producing patch tokens + a pooled study embedding."""

    def __init__(self, cfg: EncoderConfig | None = None):
        super().__init__()
        self.cfg = cfg or EncoderConfig()
        self.patch_embed = PatchEmbed3D(self.cfg)
        self.cls_token = nn.Parameter(torch.zeros(1, 1, self.cfg.embed_dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, self.cfg.num_patches + 1, self.cfg.embed_dim))
        layer = nn.TransformerEncoderLayer(
            d_model=self.cfg.embed_dim, nhead=self.cfg.num_heads,
            dim_feedforward=int(self.cfg.embed_dim * self.cfg.mlp_ratio),
            dropout=self.cfg.drop, batch_first=True, activation="gelu",
        )
        self.blocks = nn.TransformerEncoder(layer, num_layers=self.cfg.depth)
        self.norm = nn.LayerNorm(self.cfg.embed_dim)
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    @property
    def embed_dim(self) -> int:
        return self.cfg.embed_dim

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        tokens = self.patch_embed(x)
        cls = self.cls_token.expand(tokens.size(0), -1, -1)
        tokens = torch.cat([cls, tokens], dim=1) + self.pos_embed[:, : tokens.size(1) + 1]
        tokens = self.norm(self.blocks(tokens))
        return {"patch_tokens": tokens[:, 1:], "pooled": tokens[:, 0]}

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        """Pooled study-level embedding (used by alignment / triage)."""
        return self.forward(x)["pooled"]

    def load_pretrained(self, ckpt_path: str, *, strict: bool = False) -> list[str]:
        """Warm-start from FOMO300K weights; returns missing/unexpected keys."""
        state = torch.load(ckpt_path, map_location="cpu")
        state = state.get("model", state)
        result = self.load_state_dict(state, strict=strict)
        return list(result.missing_keys) + list(result.unexpected_keys)


class MaskedVolumeSSL(nn.Module):
    """MAE-style masked-volume reconstruction head for SSL pretraining (Stage A)."""

    def __init__(self, encoder: MRIEncoder3D):
        super().__init__()
        self.encoder = encoder
        cfg = encoder.cfg
        patch_voxels = cfg.patch_size[0] * cfg.patch_size[1] * cfg.patch_size[2] * cfg.in_channels
        self.decoder = nn.Sequential(
            nn.Linear(cfg.embed_dim, cfg.embed_dim), nn.GELU(),
            nn.Linear(cfg.embed_dim, patch_voxels),
        )

    def random_mask(self, n_patches: int, batch: int, device) -> torch.Tensor:
        keep = int(n_patches * (1 - self.encoder.cfg.mask_ratio))
        noise = torch.rand(batch, n_patches, device=device)
        ids = torch.argsort(noise, dim=1)
        mask = torch.ones(batch, n_patches, device=device)
        mask.scatter_(1, ids[:, :keep], 0)  # 0 = visible, 1 = masked
        return mask

    def forward(self, x: torch.Tensor, target_patches: torch.Tensor) -> torch.Tensor:
        """Return reconstruction loss on masked patches.

        ``target_patches``: (B, N, patch_voxels) ground-truth patch pixels.
        """
        out = self.encoder(x)
        pred = self.decoder(out["patch_tokens"])
        mask = self.random_mask(pred.size(1), pred.size(0), pred.device)
        loss = ((pred - target_patches) ** 2).mean(dim=-1)
        return (loss * mask).sum() / mask.sum().clamp(min=1)
