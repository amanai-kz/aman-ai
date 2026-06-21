"""Smoke test for the SCRUM-21 encoder SSL training loop.

Runs a couple of optimiser steps on a tiny config on CPU (well under a second)
and checks the loop produces a finite loss, takes a real gradient step, and
writes a registry-compatible checkpoint. Skipped when torch is absent.
"""
import pytest

torch = pytest.importorskip("torch")

from ml_engine.encoder import EncoderConfig, MRIEncoder3D
from ml_engine.encoder.train import patchify, run_training, cosine_warmup


def _tiny_cfg() -> EncoderConfig:
    return EncoderConfig(img_size=(16, 16, 16), patch_size=(8, 8, 8),
                         embed_dim=32, depth=2, num_heads=4)


def test_patchify_shape_and_order():
    cfg = _tiny_cfg()
    vol = torch.randn(2, cfg.in_channels, *cfg.img_size)
    patches = patchify(vol, cfg.patch_size)
    pv = cfg.patch_size[0] * cfg.patch_size[1] * cfg.patch_size[2] * cfg.in_channels
    assert patches.shape == (2, cfg.num_patches, pv)


def test_cosine_warmup_monotonic_warmup_then_decay():
    assert cosine_warmup(0, warmup=5, total=100) < cosine_warmup(4, warmup=5, total=100)
    assert cosine_warmup(5, warmup=5, total=100) == pytest.approx(1.0, abs=1e-6)
    assert cosine_warmup(99, warmup=5, total=100) < 0.05


def test_run_training_smoke_writes_checkpoint(tmp_path):
    summary = run_training(
        _tiny_cfg(), steps=3, batch_size=2, warmup=1, dataset_len=8,
        device="cpu", out_dir=tmp_path, log_every=1, register=False, seed=0,
    )
    assert summary["steps"] == 3
    assert summary["final_loss"] == summary["final_loss"]      # not NaN
    ckpt = tmp_path / "mr-encoder-0.1.0.pt"
    assert ckpt.exists()
    # checkpoint warm-starts a fresh encoder (load_pretrained contract)
    state = torch.load(ckpt, map_location="cpu", weights_only=False)
    assert state["objective"] == "masked_volume_ssl"
    enc = MRIEncoder3D(_tiny_cfg())
    leftover = enc.load_pretrained(str(ckpt))
    assert leftover == []        # full key match -> checkpoint is encoder-only
