"""Tests for the evaluation harness metrics (SCRUM-26)."""
import math

from ml_engine.evaluation import nlg, clinical, triage, calibration, fairness
from ml_engine.evaluation import EvalHarness, EvalConfig


# ---- NLG -------------------------------------------------------------------
def test_bleu_identical_is_high():
    s = ["acute infarct in the left mca territory"]
    assert nlg.corpus_bleu(s, s) > 0.99


def test_bleu_disjoint_is_low():
    assert nlg.corpus_bleu(["foo bar baz qux"], ["alpha beta gamma delta"]) < 0.05


def test_rouge_l_identical():
    s = ["no acute intracranial abnormality"]
    assert math.isclose(nlg.rouge_l(s, s), 1.0, abs_tol=1e-6)


def test_cider_and_meteor_run():
    h = ["small chronic infarct"]
    r = ["small chronic infarct noted"]
    assert 0.0 <= nlg.meteor_lite(h, r) <= 1.0
    assert not math.isnan(nlg.cider(h, r))


def test_bertscore_missing_is_nan():
    # bert_score not installed in CI -> nan (treated as "not measured").
    assert math.isnan(nlg.bert_score(["a"], ["b"])) or 0.0 <= nlg.bert_score(["a"], ["b"]) <= 1.0


# ---- clinical --------------------------------------------------------------
def test_chexbert_f1_perfect():
    pred = [{"infarct": 1, "hemorrhage": 0}, {"infarct": 0, "hemorrhage": 1}]
    assert clinical.chexbert_f1(pred, pred) == 1.0


def test_chexbert_f1_partial():
    pred = [{"infarct": 1, "hemorrhage": 1}]
    ref = [{"infarct": 1, "hemorrhage": 0}]
    f1 = clinical.chexbert_f1(pred, ref)
    assert 0.0 < f1 < 1.0


def test_radgraph_entity_relation_f1():
    pred = [[{"label": "infarct", "anatomy": "left mca", "presence": "present",
              "relations": [{"type": "location", "target": "left mca"}]}]]
    rg = clinical.radgraph_f1(pred, pred)
    assert rg["entity_f1"] == 1.0 and rg["relation_f1"] == 1.0 and rg["f1"] == 1.0


# ---- triage ----------------------------------------------------------------
def test_triage_sensitivity_specificity():
    y_true = [1, 1, 0, 0]
    y_pred = [1, 0, 0, 0]
    assert triage.sensitivity(y_true, y_pred) == 0.5
    assert triage.specificity(y_true, y_pred) == 1.0


def test_auroc_perfect_separation():
    y_true = [0, 0, 1, 1]
    y_score = [0.1, 0.2, 0.8, 0.9]
    assert math.isclose(triage.auroc(y_true, y_score), 1.0, abs_tol=1e-9)


def test_auroc_matches_known_value():
    # AUROC for a single mis-ranked pair.
    y_true = [0, 0, 1, 1]
    y_score = [0.1, 0.6, 0.4, 0.9]   # one negative scored above one positive
    assert math.isclose(triage.auroc(y_true, y_score), 0.75, abs_tol=1e-9)


# ---- calibration -----------------------------------------------------------
def test_ece_perfectly_calibrated_low():
    # probs equal to empirical accuracy in each region -> low ECE
    y_true = [0, 0, 1, 1] * 25
    y_prob = [0.0, 0.0, 1.0, 1.0] * 25
    assert calibration.expected_calibration_error(y_true, y_prob) < 0.05


def test_brier_bounds():
    b = calibration.brier_score([1, 0], [0.9, 0.1])
    assert 0.0 <= b <= 1.0


# ---- fairness --------------------------------------------------------------
def test_subgroup_breakdown_shapes():
    y_true = [1, 1, 0, 0]
    y_score = [0.9, 0.2, 0.1, 0.3]
    groups = {"site": ["A", "A", "B", "B"]}
    fns = {"triage.sensitivity": lambda yt, ys: triage.sensitivity(yt, [1 if v >= 0.5 else 0 for v in ys])}
    bd = fairness.subgroup_breakdown(y_true, y_score, groups, fns)
    assert "site" in bd and set(bd["site"]) == {"A", "B"}
    assert "triage.sensitivity" in bd["site"]["A"]


# ---- harness end-to-end ----------------------------------------------------
def test_harness_produces_report():
    samples = [
        {
            "study_id": "S1",
            "report": {"hyp": "acute infarct left mca", "ref": "acute infarct left mca",
                       "pred_labels": {"acute_infarct": 1}, "ref_labels": {"acute_infarct": 1},
                       "pred_findings": [{"label": "infarct", "anatomy": "left mca"}],
                       "ref_findings": [{"label": "infarct", "anatomy": "left mca"}]},
            "triage": {"y_true": 1, "y_score": 0.97, "time_to_flag_s": 120.0},
            "subgroups": {"site": "KZ-01", "field_strength": "3T"},
        },
        {
            "study_id": "S2",
            "report": {"hyp": "no acute abnormality", "ref": "no acute intracranial abnormality",
                       "pred_labels": {"acute_infarct": 0}, "ref_labels": {"acute_infarct": 0},
                       "pred_findings": [], "ref_findings": []},
            "triage": {"y_true": 0, "y_score": 0.05, "time_to_flag_s": 90.0},
            "subgroups": {"site": "KZ-02", "field_strength": "1.5T"},
        },
    ]
    report = EvalHarness(EvalConfig()).evaluate(samples, test_set="unit-v1")
    assert report.test_set == "unit-v1" and report.test_set_hash
    assert "triage.sensitivity" in report.metrics
    assert "report.radgraph_f1" in report.metrics
    assert "report.bleu" in report.metrics
    assert "site" in report.subgroup_metrics
