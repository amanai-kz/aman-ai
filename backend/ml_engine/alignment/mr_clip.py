"""MR-CLIP: contrastive image-text alignment (SCRUM-22, §7.1 Stage B).

Aligns the 3D MRI encoder's pooled embedding with radiology-report text
embeddings via a symmetric InfoNCE objective (CT-CLIP-style, adapted to MRI).
Enables zero-shot abnormality retrieval/classification baselines.

Acceptance criteria (SCRUM-22): contrastive image-report training on
report-paired data; zero-shot abnormality retrieval baseline; checkpoints
versioned; eval on the frozen test set.
"""
from __future__ import annotations

from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F

from ..encoder.encoder import MRIEncoder3D


@dataclass
class MRCLIPConfig:
    proj_dim: int = 512
    text_dim: int = 768          # dim of the (frozen) text encoder output
    init_logit_scale: float = 2.6593  # ln(1/0.07), as in CLIP


def info_nce_loss(image_emb: torch.Tensor, text_emb: torch.Tensor,
                  logit_scale: torch.Tensor) -> torch.Tensor:
    """Symmetric image<->text contrastive loss over a batch (diagonal = positives)."""
    image_emb = F.normalize(image_emb, dim=-1)
    text_emb = F.normalize(text_emb, dim=-1)
    logits = logit_scale.exp() * image_emb @ text_emb.t()
    targets = torch.arange(logits.size(0), device=logits.device)
    return 0.5 * (F.cross_entropy(logits, targets) + F.cross_entropy(logits.t(), targets))


class MRCLIP(nn.Module):
    """Projection heads + temperature over a (possibly frozen) image/text pair."""

    def __init__(self, encoder: MRIEncoder3D, cfg: MRCLIPConfig | None = None):
        super().__init__()
        self.encoder = encoder
        self.cfg = cfg or MRCLIPConfig()
        self.image_proj = nn.Linear(encoder.embed_dim, self.cfg.proj_dim)
        self.text_proj = nn.Linear(self.cfg.text_dim, self.cfg.proj_dim)
        self.logit_scale = nn.Parameter(torch.tensor(self.cfg.init_logit_scale))

    def encode_image(self, volume: torch.Tensor) -> torch.Tensor:
        return self.image_proj(self.encoder.encode(volume))

    def encode_text(self, text_features: torch.Tensor) -> torch.Tensor:
        return self.text_proj(text_features)

    def forward(self, volume: torch.Tensor, text_features: torch.Tensor) -> dict[str, torch.Tensor]:
        img = self.encode_image(volume)
        txt = self.encode_text(text_features)
        loss = info_nce_loss(img, txt, self.logit_scale)
        return {"loss": loss, "image_emb": img, "text_emb": txt}

    @torch.no_grad()
    def zero_shot_logits(self, volume: torch.Tensor, class_text_features: torch.Tensor) -> torch.Tensor:
        """Similarity of a study to each class prompt embedding (zero-shot)."""
        img = F.normalize(self.encode_image(volume), dim=-1)
        cls = F.normalize(self.encode_text(class_text_features), dim=-1)
        return self.logit_scale.exp() * img @ cls.t()
