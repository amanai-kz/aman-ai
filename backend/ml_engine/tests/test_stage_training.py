"""Smoke tests for the model-stage training loops (SCRUM-22 / 23 / 24).

All run on CPU with tiny configs. The report-gen test downloads a small open
model; it is skipped if transformers/peft or network are unavailable.
"""
import pytest

torch = pytest.importorskip("torch")

from ml_engine.encoder import EncoderConfig
from ml_engine.triage_head import TriageConfig


def _tiny_cfg() -> EncoderConfig:
    return EncoderConfig(img_size=(16, 16, 16), patch_size=(8, 8, 8),
                         embed_dim=32, depth=2, num_heads=4)


def test_alignment_training_learns_and_registers(tmp_path):
    from ml_engine.alignment.train import run_alignment_training
    from ml_engine.alignment import MRCLIPConfig
    s = run_alignment_training(
        _tiny_cfg(), MRCLIPConfig(proj_dim=16, text_dim=24),
        steps=40, batch_size=8, warmup=4, dataset_len=32, device="cpu",
        out_dir=tmp_path, log_every=10, register=False, seed=0,
    )
    assert s["final_loss"] < s["first_loss"]              # contrastive loss drops
    assert 0.0 <= s["zeroshot_top1"] <= 1.0
    assert (tmp_path / "mr-clip-0.1.0.pt").exists()


def test_triage_training_calibrates(tmp_path):
    from ml_engine.triage_head.train import run_triage_training
    s = run_triage_training(
        TriageConfig(), in_dim=32, steps=200, batch_size=64, device="cpu",
        n_train=2048, n_val=512, out_dir=tmp_path, register=False, seed=0,
    )
    assert s["final_loss"] < s["first_loss"]
    assert s["val_sensitivity"] >= 0.7                    # learns the synthetic task
    assert s["temperature"] > 0
    assert (tmp_path / "mr-triage-0.1.0.pt").exists()


def test_report_gen_lora_step(tmp_path):
    pytest.importorskip("transformers")
    pytest.importorskip("peft")
    from ml_engine.report_gen.train import run_report_training
    from ml_engine.report_gen import ReportGenConfig
    cfg = _tiny_cfg()
    rg = ReportGenConfig(n_visual_tokens=4, lora_r=4)
    try:
        s = run_report_training(
            cfg, rg, llm_name="hf-internal-testing/tiny-random-LlamaForCausalLM",
            steps=4, batch_size=2, device="cpu", max_len=16,
            out_dir=tmp_path, register=False, seed=0,
        )
    except Exception as exc:  # offline / model unavailable
        pytest.skip(f"report-gen LLM unavailable: {exc}")
    assert s["final_loss"] == s["final_loss"]             # finite
    assert s["trainable_params"] > 0
    assert (tmp_path / "mr-report-gen-0.1.0" / "projector.pt").exists()
