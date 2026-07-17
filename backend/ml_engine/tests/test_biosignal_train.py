"""Smoke tests for the SCRUM-68 biosignal encoder SSL training loop.

Mirrors ``tests/test_encoder_train.py`` (the SCRUM-21 MRI encoder loop) for
the S2 biosignal encoder: tiny config, a couple of CPU optimiser steps,
finite/decreasing-capable loss, and a registry-compatible checkpoint.
"""
import pytest

torch = pytest.importorskip("torch")
pd = pytest.importorskip("pandas")

from ml_engine.biosignal import BiosignalEncoder1D, BiosignalEncoderConfig
from ml_engine.biosignal.model import patchify_1d
from ml_engine.biosignal.train import (
    EhrVitalsDataset, SyntheticVitalsWindows, cosine_warmup, run_training,
)
from ml_engine.ingestion.ehr import VITAL_ITEMS


def _tiny_cfg() -> BiosignalEncoderConfig:
    return BiosignalEncoderConfig(seq_len=16, patch_size=4, embed_dim=16, depth=2, num_heads=2)


def test_patchify_1d_shape_and_order():
    cfg = _tiny_cfg()
    x = torch.randn(3, cfg.in_channels, cfg.seq_len)
    patches = patchify_1d(x, cfg.patch_size)
    pv = cfg.patch_size * cfg.in_channels
    assert patches.shape == (3, cfg.num_patches, pv)


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
    assert summary["data"] == "synthetic-placeholder"
    ckpt = tmp_path / "s2-biosignal-encoder-0.1.0.pt"
    assert ckpt.exists()
    state = torch.load(ckpt, map_location="cpu", weights_only=False)
    assert state["objective"] == "masked_biosignal_ssl"
    enc = BiosignalEncoder1D(_tiny_cfg())
    leftover = enc.load_pretrained(str(ckpt))
    assert leftover == []        # full key match -> checkpoint is encoder-only


def _write_demo_chartevents(mimic_dir, n_stays=3, n_hours=20):
    icu = mimic_dir / "icu"
    icu.mkdir(parents=True, exist_ok=True)
    ts = pd.date_range("2026-01-01", periods=n_hours, freq="1h")
    rows = []
    for s in range(n_stays):
        for hour_idx, t in enumerate(ts):
            for ch_idx, ch in enumerate(VITAL_ITEMS):
                value = 60.0 + 5.0 * ((hour_idx + ch_idx + s) % 4)
                rows.append((s, 100 + s, VITAL_ITEMS[ch], t.isoformat(), value))
    df = pd.DataFrame(rows, columns=["subject_id", "stay_id", "itemid", "charttime", "valuenum"])
    df.to_csv(icu / "chartevents.csv.gz", index=False, compression="gzip")


def test_run_training_with_real_ehr_dataset(tmp_path):
    mimic_dir = tmp_path / "mimic-demo"
    _write_demo_chartevents(mimic_dir, n_stays=3, n_hours=20)
    cfg = BiosignalEncoderConfig(seq_len=16, patch_size=4, embed_dim=16, depth=2, num_heads=2)

    ds = EhrVitalsDataset(str(mimic_dir), cfg)
    assert len(ds) == 3
    assert "mimic-ehr" in ds.data_source

    summary = run_training(
        cfg, steps=2, batch_size=2, warmup=1, device="cpu",
        out_dir=tmp_path / "ckpt", log_every=1, register=False, seed=0, dataset=ds,
    )
    assert summary["steps"] == 2
    assert "mimic-ehr" in summary["data"]
