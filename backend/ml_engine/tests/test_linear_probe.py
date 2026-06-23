"""Tests for the SCRUM-21 #3 linear-probe evaluation.

All run on CPU with tiny configs. They verify the *harness* is correct — the
probe measures linear separability, embeddings are extracted from a frozen
encoder, the split is clean, the comparison/verdict ranks better features
higher, and the result registers. The scientific claim that the SSL-pretrained
encoder beats from-scratch is a research outcome demonstrated on the real IXI
run (see docs); a sub-second synthetic toy cannot assert it reliably, so the
SSL-path test only checks well-formedness.
"""
import pytest

torch = pytest.importorskip("torch")

from ml_engine.encoder import EncoderConfig, MRIEncoder3D
from ml_engine.encoder.linear_probe import (
    SyntheticProbeTask, compare_encoders, compare_pretrained_vs_scratch,
    extract_embeddings, fit_linear_probe, probe_embeddings, register_probe_result,
    stratified_split, _score,
)
from ml_engine.encoder.train import run_training


def _tiny_cfg() -> EncoderConfig:
    return EncoderConfig(img_size=(16, 16, 16), patch_size=(8, 8, 8),
                         embed_dim=32, depth=2, num_heads=4)


# --------------------------------------------------------------------------- #
# Probe instrument validity
# --------------------------------------------------------------------------- #
def test_probe_separates_separable_features_and_chance_on_noise():
    torch.manual_seed(0)
    n, d = 200, 8
    y = torch.cat([torch.zeros(n // 2), torch.ones(n // 2)]).long()
    # class-shifted Gaussians -> linearly separable
    x = torch.randn(n, d) + (y.float() * 4.0).unsqueeze(1)
    idx = torch.randperm(n)
    tr, te = idx[: int(n * 0.6)], idx[int(n * 0.6):]

    good = probe_embeddings(x, y, tr, te, 2, probe_iters=300, seed=0)
    assert good["balanced_accuracy"] > 0.9        # probe reads real linear signal
    assert good["macro_auroc"] > 0.9

    # same features, shuffled labels -> no learnable signal -> ~chance
    y_rand = y[torch.randperm(n)]
    bad = probe_embeddings(x, y_rand, tr, te, 2, probe_iters=300, seed=0)
    assert bad["balanced_accuracy"] < 0.75        # cannot manufacture signal


def test_score_bounds_and_perfect_separation():
    clf = fit_linear_probe(torch.tensor([[-3.0], [-2.5], [2.5], [3.0]]),
                           torch.tensor([0, 0, 1, 1]), 2, iters=300)
    s = _score(clf, torch.tensor([[-2.8], [2.8]]), torch.tensor([0, 1]), 2)
    assert s["accuracy"] == 1.0
    for v in s.values():
        assert 0.0 <= v <= 1.0


# --------------------------------------------------------------------------- #
# Embedding extraction + split
# --------------------------------------------------------------------------- #
def test_extract_embeddings_shape_and_frozen():
    cfg = _tiny_cfg()
    enc = MRIEncoder3D(cfg)
    ds = SyntheticProbeTask(cfg, n=12, n_classes=2, seed=0)
    before = enc.cls_token.detach().clone()

    emb = extract_embeddings(enc, ds, device="cpu", batch_size=4)

    assert emb.shape == (12, cfg.embed_dim)
    assert not emb.requires_grad                          # no graph kept
    assert torch.equal(enc.cls_token.detach(), before)    # encoder untouched (frozen)


def test_stratified_split_disjoint_exhaustive_balanced():
    labels = torch.tensor([0, 1] * 25)                    # 50 samples, 2 classes
    tr, te = stratified_split(labels, test_frac=0.4, seed=0)
    assert set(tr.tolist()) | set(te.tolist()) == set(range(50))   # exhaustive
    assert set(tr.tolist()) & set(te.tolist()) == set()            # disjoint
    assert {0, 1} <= set(labels[te].tolist())                      # both classes in test
    assert len(te) == 20                                            # 40% of 50


# --------------------------------------------------------------------------- #
# Comparison / verdict logic
# --------------------------------------------------------------------------- #
def test_compare_ranks_informative_over_degenerate():
    """The verdict must rank an informative encoder above a degenerate one.

    On an easy, well-separated task a random encoder is already informative;
    an encoder with zeroed weights emits a constant embedding (~chance). The
    comparison should flag ``beats_scratch`` for the informative one — this is
    the decision the acceptance criterion turns on, made deterministic.
    """
    cfg = _tiny_cfg()
    task = SyntheticProbeTask(cfg, n=80, n_classes=2, seed=0, blob_amp=4.0)

    torch.manual_seed(0)
    informative = MRIEncoder3D(cfg)
    degenerate = MRIEncoder3D(cfg)
    with torch.no_grad():
        for p in degenerate.parameters():
            p.zero_()                                       # constant embedding

    r = compare_encoders(informative, degenerate, task, n_classes=2,
                         test_frac=0.4, probe_iters=300, device="cpu", seed=0)

    assert r["beats_scratch"] is True
    assert r["margin_balanced_accuracy"] > 0.0
    assert r["pretrained"]["balanced_accuracy"] > 0.8
    assert r["scratch"]["balanced_accuracy"] <= 0.65       # degenerate ~ chance
    assert r["n_train"] + r["n_test"] == 80


# --------------------------------------------------------------------------- #
# End-to-end SSL path + checkpoint cfg round-trip
# --------------------------------------------------------------------------- #
def test_compare_pretrained_vs_scratch_wellformed_reads_cfg(tmp_path):
    cfg = _tiny_cfg()
    task = SyntheticProbeTask(cfg, n=60, n_classes=2, seed=0)
    summary = run_training(cfg, dataset=task, steps=20, batch_size=8, warmup=2,
                           device="cpu", out_dir=tmp_path, log_every=10**9,
                           name="mr-enc-probe", register=False, seed=0)

    r = compare_pretrained_vs_scratch(task, ckpt=summary["checkpoint"], n_classes=2,
                                      test_frac=0.4, probe_iters=200, device="cpu", seed=0)

    assert r["criterion"] == "linear_probe_beats_from_scratch"
    assert isinstance(r["beats_scratch"], bool)            # honest verdict, not forced
    assert r["embed_dim"] == cfg.embed_dim                 # cfg recovered from checkpoint
    assert r["n_train"] + r["n_test"] == 60
    assert r["chance_balanced_accuracy"] == 0.5
    for arm in ("pretrained", "scratch"):
        for v in r[arm].values():
            assert 0.0 <= v <= 1.0


def test_register_probe_result_creates_card(tmp_settings):
    from ml_engine.registry import ModelRegistry
    reg = ModelRegistry(settings=tmp_settings)
    result = {
        "beats_scratch": True, "margin_balanced_accuracy": 0.12,
        "chance_balanced_accuracy": 0.5, "checkpoint": "enc.pt",
        "data": "synthetic-probe-task", "n_classes": 2, "n_train": 36,
        "n_test": 24, "embed_dim": 32,
        "pretrained": {"accuracy": 0.9, "balanced_accuracy": 0.9, "macro_auroc": 0.95},
        "scratch": {"accuracy": 0.78, "balanced_accuracy": 0.78, "macro_auroc": 0.82},
    }
    model_id = register_probe_result(result, name="mr-encoder-linear-probe",
                                     version="0.1.0", registry=reg)
    assert model_id == "mr-encoder-linear-probe:0.1.0"
    card = reg.get(model_id)
    assert card.stage == "linear-probe"
    assert card.config["probe.beats_scratch"] == 1.0
    assert card.config["probe.pretrained.balanced_accuracy"] == 0.9


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def test_cli_synthetic_demo_runs(tmp_path):
    from ml_engine.encoder.linear_probe import main
    rc = main(["--device", "cpu", "--img-size", "16", "--patch-size", "8",
               "--embed-dim", "32", "--depth", "2", "--heads", "4",
               "--n", "40", "--n-classes", "2", "--ssl-steps", "10",
               "--probe-iters", "100", "--out", str(tmp_path),
               "--result-out", str(tmp_path / "probe.json")])
    assert rc in (0, 4)                                    # ran; verdict either way
    assert (tmp_path / "probe.json").exists()
