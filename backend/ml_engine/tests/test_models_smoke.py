"""Forward-pass smoke tests for the PyTorch model stages (SCRUM-21..24).

Skipped automatically when torch is not installed (e.g. CI without GPU deps).
Uses a tiny volume so it runs on CPU in well under a second.
"""
import pytest

torch = pytest.importorskip("torch")

from ml_engine.encoder import EncoderConfig, MRIEncoder3D, MaskedVolumeSSL
from ml_engine.alignment import MRCLIP, MRCLIPConfig
from ml_engine.triage_head import TriageHead, TriageConfig


def _tiny_cfg() -> EncoderConfig:
    return EncoderConfig(img_size=(16, 16, 16), patch_size=(8, 8, 8),
                         embed_dim=32, depth=2, num_heads=4)


def test_encoder_forward_shapes():
    cfg = _tiny_cfg()
    enc = MRIEncoder3D(cfg)
    x = torch.randn(2, 1, *cfg.img_size)
    out = enc(x)
    assert out["pooled"].shape == (2, cfg.embed_dim)
    assert out["patch_tokens"].shape == (2, cfg.num_patches, cfg.embed_dim)


def test_masked_ssl_loss_is_scalar():
    cfg = _tiny_cfg()
    ssl = MaskedVolumeSSL(MRIEncoder3D(cfg))
    x = torch.randn(2, 1, *cfg.img_size)
    pv = cfg.patch_size[0] * cfg.patch_size[1] * cfg.patch_size[2] * cfg.in_channels
    target = torch.randn(2, cfg.num_patches, pv)
    loss = ssl(x, target)
    assert loss.ndim == 0 and torch.isfinite(loss)


def test_mrclip_loss_and_zeroshot():
    cfg = _tiny_cfg()
    clip = MRCLIP(MRIEncoder3D(cfg), MRCLIPConfig(proj_dim=16, text_dim=24))
    vol = torch.randn(4, 1, *cfg.img_size)
    txt = torch.randn(4, 24)
    out = clip(vol, txt)
    assert torch.isfinite(out["loss"])
    logits = clip.zero_shot_logits(vol[:1], torch.randn(3, 24))
    assert logits.shape == (1, 3)


def test_triage_head_predict_and_abstain():
    head = TriageHead(in_dim=32, cfg=TriageConfig())
    feats = torch.randn(5, 32)
    out = head.predict(feats)
    assert out["probs"].shape == (5, 3)
    assert out["abstain"].shape == (5,)
    assert "intracranial_hemorrhage" in out["per_finding"]
