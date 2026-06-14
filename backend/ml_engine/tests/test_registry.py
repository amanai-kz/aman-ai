"""Tests for the model registry, gates & lifecycle (SCRUM-27)."""
import pytest

from ml_engine.registry import (
    ModelRegistry, RegistryError, Lifecycle, EvalReport, DataProvenance, check_gates,
)


def _good_report() -> EvalReport:
    return EvalReport(
        test_set="frozen-v1", test_set_hash="abc123",
        metrics={
            "triage.sensitivity": 0.97, "triage.auroc": 0.92,
            "report.radgraph_f1": 0.45, "report.chexbert_f1": 0.55,
            "calibration.ece": 0.06,
        },
        subgroup_metrics={"site": {"A": {"triage.sensitivity": 0.96},
                                   "B": {"triage.sensitivity": 0.95}}},
    )


def _bad_report() -> EvalReport:
    r = _good_report()
    r.metrics["triage.sensitivity"] = 0.80  # below the 0.95 safety gate
    return r


def test_register_and_get(tmp_settings):
    reg = ModelRegistry(tmp_settings)
    card = reg.register(name="mr-encoder", version="0.1.0", stage="encoder", code_commit="deadbeef")
    assert card.model_id == "mr-encoder:0.1.0"
    assert reg.get("mr-encoder:0.1.0").lifecycle == Lifecycle.REGISTERED
    reg.close()


def test_versions_are_immutable(tmp_settings):
    reg = ModelRegistry(tmp_settings)
    reg.register(name="m", version="1.0.0")
    with pytest.raises(RegistryError):
        reg.register(name="m", version="1.0.0")
    reg.close()


def test_gate_pass_and_fail():
    assert check_gates(_good_report()).passed is True
    res = check_gates(_bad_report())
    assert res.passed is False
    assert any("triage_sensitivity" in f for f in res.failures)


def test_full_promotion_flow(tmp_settings):
    reg = ModelRegistry(tmp_settings)
    reg.register(name="rg", version="0.1.0", stage="report_gen",
                 data=DataProvenance(license_cleared=True))
    gr = reg.attach_eval("rg:0.1.0", _good_report())
    assert gr.passed
    assert reg.get("rg:0.1.0").lifecycle == Lifecycle.EVALUATED

    reg.promote("rg:0.1.0")  # -> staging
    assert reg.get("rg:0.1.0").lifecycle == Lifecycle.STAGING

    with pytest.raises(RegistryError):       # cannot reach production without sign-off
        reg.promote("rg:0.1.0")

    reg.sign_off("rg:0.1.0", reviewer="dr.x")
    reg.promote("rg:0.1.0")  # -> production
    card = reg.get("rg:0.1.0")
    assert card.lifecycle == Lifecycle.PRODUCTION
    assert card.locked is True
    reg.close()


def test_failed_gate_blocks_promotion(tmp_settings):
    reg = ModelRegistry(tmp_settings)
    reg.register(name="t", version="0.1.0", stage="triage_head")
    reg.attach_eval("t:0.1.0", _bad_report())
    with pytest.raises(RegistryError):
        reg.promote("t:0.1.0")
    reg.close()


def test_promotion_supersedes_previous_production(tmp_settings):
    reg = ModelRegistry(tmp_settings)
    for v in ("0.1.0", "0.2.0"):
        reg.register(name="rg", version=v, stage="report_gen")
        reg.attach_eval(f"rg:{v}", _good_report())
        reg.promote(f"rg:{v}")
        reg.sign_off(f"rg:{v}")
        reg.promote(f"rg:{v}")
    # only the latest is production; the older one was archived
    assert reg.active_production("rg").version == "0.2.0"
    assert reg.get("rg:0.1.0").lifecycle == Lifecycle.ARCHIVED
    reg.close()


def test_rollback_and_audit(tmp_settings):
    reg = ModelRegistry(tmp_settings)
    reg.register(name="rg", version="0.1.0", stage="report_gen")
    reg.attach_eval("rg:0.1.0", _good_report())
    reg.promote("rg:0.1.0"); reg.sign_off("rg:0.1.0"); reg.promote("rg:0.1.0")
    reg.rollback("rg:0.1.0", reason="drift detected")
    assert reg.get("rg:0.1.0").lifecycle == Lifecycle.REJECTED
    log = reg.audit_log("rg:0.1.0")
    actions = [e["action"] for e in log]
    assert "register" in actions
    assert any("rejected" in a for a in actions)
    reg.close()


def test_illegal_transition_blocked(tmp_settings):
    reg = ModelRegistry(tmp_settings)
    reg.register(name="x", version="0.1.0")
    # REGISTERED cannot jump straight to production
    with pytest.raises(RegistryError):
        reg.promote("x:0.1.0")
    reg.close()
