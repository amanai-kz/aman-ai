"""Safety-layer tests: OOD gate (FR-14), saliency/evidence (FR-07), structured
findings with uncertainty (FR-06, FR-15)."""
import pytest

torch = pytest.importorskip("torch")
import numpy as np

from ml_engine.encoder import EncoderConfig, MRIEncoder3D
from ml_engine.triage_head import TriageConfig, TriageHead
from ml_engine.serving import (
    InferenceEngine, MahalanobisOOD, finding_saliency, structured_findings,
)


def _engine(model_version: str = "mr-triage:test"):
    cfg = EncoderConfig(img_size=(16, 16, 16), patch_size=(8, 8, 8),
                        embed_dim=32, depth=2, num_heads=4)
    enc = MRIEncoder3D(cfg)
    tri = TriageHead(in_dim=cfg.embed_dim, cfg=TriageConfig())
    return InferenceEngine(enc, tri, device="cpu", model_version=model_version)


def _features(eng, vols):
    return torch.cat([eng.features(v) for v in vols], 0)


# --- FR-14 OOD detection ---------------------------------------------------- #
def test_ood_detector_separates_in_and_out():
    eng = _engine()
    in_vols = [torch.randn(1, 16, 16, 16) for _ in range(24)]
    ood_vols = [torch.randn(1, 16, 16, 16) * 6.0 + 12.0 for _ in range(24)]
    fin, fout = _features(eng, in_vols), _features(eng, ood_vols)
    det = MahalanobisOOD().fit(fin)
    det.calibrate(fin, target_fpr=0.1)
    assert det.auroc(fin, fout) > 0.6              # detects distribution shift
    assert det.score(fout).mean() > det.score(fin).mean()


def test_ood_verdict_fields():
    eng = _engine()
    fin = _features(eng, [torch.randn(1, 16, 16, 16) for _ in range(16)])
    det = MahalanobisOOD().fit(fin)
    det.calibrate(fin, target_fpr=0.05)
    v = det.verdict(fin[:1])
    assert isinstance(v.is_ood, bool)
    assert v.threshold == det.threshold_ and v.score >= 0.0


# --- FR-07 saliency / evidence ---------------------------------------------- #
def test_saliency_shape_and_laterality():
    eng = _engine()
    vol = torch.randn(1, 16, 16, 16)
    s = finding_saliency(eng, vol, finding_idx=0)
    assert s.saliency.shape == (16, 16, 16)
    assert s.laterality in {"left", "right", "midline"}
    assert len(s.top_slices) == 3


# --- FR-06 structured findings + uncertainty -------------------------------- #
def test_structured_findings_have_ci_and_version():
    eng = _engine(model_version="mr-triage:0.1.1")
    vol = torch.randn(1, 16, 16, 16)
    fs = structured_findings(eng, vol, n_mc=15, with_saliency=False)
    assert len(fs) == len(TriageConfig().critical_findings)
    for f in fs:
        assert 0.0 <= f.ci_low <= f.ci_high <= 1.0
        assert f.ai_generated is True
        assert f.model_version == "mr-triage:0.1.1"


# --- assess_study: OOD gate blocks the draft (FR-14) ------------------------ #
def test_assess_study_gates_ood_no_draft():
    eng = _engine()
    fin = _features(eng, [torch.randn(1, 16, 16, 16) for _ in range(16)])
    det = MahalanobisOOD().fit(fin)
    det.calibrate(fin, target_fpr=0.05)
    eng.attach_ood(det)

    vol = torch.randn(1, 16, 16, 16)
    det.threshold_ = -1.0                          # force OOD -> gate must block
    out = eng.assess_study(vol, n_mc=5)
    assert out["ood"] is True and out["ai_draft"] is False and out["findings"] == []

    det.threshold_ = 1e9                           # force in-distribution
    out2 = eng.assess_study(vol, n_mc=5)
    assert out2["ood"] is False and out2["ai_draft"] is True
    assert len(out2["findings"]) == len(eng.findings)
    assert out2["disclaimer"]
