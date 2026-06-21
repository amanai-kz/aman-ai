"""Tests for the inference engine + FastAPI serving layer (§7.5)."""
import io

import pytest

torch = pytest.importorskip("torch")

from ml_engine.encoder import EncoderConfig, MRIEncoder3D
from ml_engine.triage_head import TriageConfig, TriageHead
from ml_engine.serving import InferenceEngine


def _engine():
    cfg = EncoderConfig(img_size=(16, 16, 16), patch_size=(8, 8, 8),
                        embed_dim=32, depth=2, num_heads=4)
    enc = MRIEncoder3D(cfg)
    tri = TriageHead(in_dim=cfg.embed_dim, cfg=TriageConfig())
    return InferenceEngine(enc, tri, device="cpu")


def test_triage_study_shape_and_fields():
    eng = _engine()
    vol = torch.randn(1, 16, 16, 16)
    r = eng.triage_study(vol)
    assert set(r.per_finding) == set(TriageConfig().critical_findings)
    assert 0.0 <= r.severity <= 1.0
    assert isinstance(r.abstain, bool)


def test_api_healthz_and_triage():
    fastapi = pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    nib = pytest.importorskip("nibabel")
    import numpy as np
    from fastapi.testclient import TestClient
    from ml_engine.serving import create_app

    client = TestClient(create_app(_engine()))
    assert client.get("/healthz").json()["model_loaded"] is True

    # build a tiny in-memory NIfTI and upload it
    img = nib.Nifti1Image(np.random.rand(16, 16, 16).astype("float32"), affine=np.eye(4))
    buf = io.BytesIO()
    nib.save(img, "/tmp/_aman_test.nii")
    with open("/tmp/_aman_test.nii", "rb") as fh:
        resp = client.post("/triage", files={"file": ("study.nii", fh, "application/octet-stream")})
    assert resp.status_code == 200
    body = resp.json()
    assert "per_finding" in body and "abstain" in body and "disclaimer" in body
