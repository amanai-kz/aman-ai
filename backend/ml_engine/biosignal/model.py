"""1D biosignal encoder + masked-timestep SSL objective (SCRUM-68, MIMIC Phase 3).

Applies the 3D MRI encoder's proven SimMIM-style recipe (see
:mod:`ml_engine.encoder`, decision D15 — input-masking beats masking after the
forward pass) to short multichannel ICU-vitals windows (heart rate,
respiratory rate, SpO2, NIBP systolic/diastolic — see
:mod:`ml_engine.ingestion.ehr`). This is a pretraining scaffold for the S2
service's eventual wearable-PPG/ECG encoder (team Mukhammedzhan), not a
finished HRV model — see ``ingestion.ehr``'s docstring for the data-tier gap
(charted vitals now, continuous waveforms only after credentialed MIMIC
Waveform DB / MIMIC-IV-ECG access).
"""
from __future__ import annotations

from dataclasses import dataclass

import torch
import torch.nn as nn


@dataclass
class BiosignalEncoderConfig:
    in_channels: int = 5                  # see ingestion.ehr.VITAL_ITEMS order
    seq_len: int = 24                     # hourly steps per window
    patch_size: int = 4                   # timesteps per token
    embed_dim: int = 128
    depth: int = 4
    num_heads: int = 4
    mlp_ratio: float = 4.0
    mask_ratio: float = 0.5
    drop: float = 0.0
    channels: tuple[str, ...] = (
        "heart_rate", "resp_rate", "spo2", "nibp_systolic", "nibp_diastolic",
    )

    @property
    def num_patches(self) -> int:
        return self.seq_len // self.patch_size


def patchify_1d(x: torch.Tensor, patch_size: int) -> torch.Tensor:
    """``(B, C, T)`` -> ``(B, N, C*patch_size)`` in token order matching
    :class:`PatchEmbed1D`'s ``Conv1d`` output, so reconstruction targets line
    up with the encoder's patch tokens."""
    b, c, t = x.shape
    n = t // patch_size
    xr = x[:, :, : n * patch_size].reshape(b, c, n, patch_size)
    xr = xr.permute(0, 2, 1, 3).contiguous()
    return xr.reshape(b, n, c * patch_size)


class PatchEmbed1D(nn.Module):
    def __init__(self, cfg: BiosignalEncoderConfig):
        super().__init__()
        self.proj = nn.Conv1d(cfg.in_channels, cfg.embed_dim,
                              kernel_size=cfg.patch_size, stride=cfg.patch_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C, T) -> (B, N, embed_dim)
        x = self.proj(x)
        return x.transpose(1, 2)


class BiosignalEncoder1D(nn.Module):
    """Transformer encoder over patch-embedded multichannel vitals windows."""

    def __init__(self, cfg: BiosignalEncoderConfig | None = None):
        super().__init__()
        self.cfg = cfg or BiosignalEncoderConfig()
        self.patch_embed = PatchEmbed1D(self.cfg)
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

    def forward(self, x: torch.Tensor, *, token_mask: torch.Tensor | None = None,
                mask_token: torch.Tensor | None = None) -> dict[str, torch.Tensor]:
        tokens = self.patch_embed(x)
        if token_mask is not None and mask_token is not None:
            # SimMIM-style input masking (see ml_engine.encoder.MaskedVolumeSSL
            # / decision D15): replace masked patch embeddings with a shared
            # learnable mask token *before* encoding. token_mask: (B, N), 1=masked.
            w = token_mask.unsqueeze(-1).to(tokens.dtype)
            tokens = tokens * (1.0 - w) + mask_token.to(tokens.dtype) * w
        cls = self.cls_token.expand(tokens.size(0), -1, -1)
        tokens = torch.cat([cls, tokens], dim=1) + self.pos_embed[:, : tokens.size(1) + 1]
        tokens = self.norm(self.blocks(tokens))
        return {"patch_tokens": tokens[:, 1:], "pooled": tokens[:, 0]}

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        """Pooled window-level embedding (for downstream probes)."""
        return self.forward(x)["pooled"]

    def load_pretrained(self, ckpt_path: str, *, strict: bool = False) -> list[str]:
        state = torch.load(ckpt_path, map_location="cpu")
        state = state.get("model", state)
        result = self.load_state_dict(state, strict=strict)
        return list(result.missing_keys) + list(result.unexpected_keys)


class MaskedBiosignalSSL(nn.Module):
    """SimMIM-style masked-timestep reconstruction head (mirrors
    :class:`ml_engine.encoder.MaskedVolumeSSL`, decision D15): masked patches
    are replaced at the input with a learnable mask token, and the loss is
    computed on the masked patches only against per-patch-normalised targets.
    """

    def __init__(self, encoder: BiosignalEncoder1D):
        super().__init__()
        self.encoder = encoder
        cfg = encoder.cfg
        patch_values = cfg.patch_size * cfg.in_channels
        self.mask_token = nn.Parameter(torch.zeros(1, 1, cfg.embed_dim))
        nn.init.trunc_normal_(self.mask_token, std=0.02)
        self.decoder = nn.Sequential(
            nn.Linear(cfg.embed_dim, cfg.embed_dim), nn.GELU(),
            nn.Linear(cfg.embed_dim, patch_values),
        )

    def random_mask(self, n_patches: int, batch: int, device) -> torch.Tensor:
        keep = max(1, int(n_patches * (1 - self.encoder.cfg.mask_ratio)))
        noise = torch.rand(batch, n_patches, device=device)
        ids = torch.argsort(noise, dim=1)
        mask = torch.ones(batch, n_patches, device=device)
        mask.scatter_(1, ids[:, :keep], 0)  # 0 = visible, 1 = masked
        return mask

    @staticmethod
    def _normalize_patches(target: torch.Tensor) -> torch.Tensor:
        mu = target.mean(dim=-1, keepdim=True)
        var = target.var(dim=-1, keepdim=True, unbiased=False)
        return (target - mu) / (var + 1e-6).sqrt()

    def forward(self, x: torch.Tensor, target_patches: torch.Tensor) -> torch.Tensor:
        mask = self.random_mask(self.encoder.cfg.num_patches, x.size(0), x.device)
        out = self.encoder(x, token_mask=mask, mask_token=self.mask_token)
        pred = self.decoder(out["patch_tokens"])
        target = self._normalize_patches(target_patches)
        loss = ((pred - target) ** 2).mean(dim=-1)             # (B, N)
        return (loss * mask).sum() / mask.sum().clamp(min=1)   # masked patches only
