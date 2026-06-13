"""Command-line interface for the MRI AI Engine MLOps surface.

Examples
--------
    python -m ml_engine.cli register --name mr-encoder --version 0.1.0 --stage encoder
    python -m ml_engine.cli eval --test-set frozen-v1 --samples tests/data/sample_eval.json \
                                 --model mr-report-gen:0.1.0
    python -m ml_engine.cli promote --model mr-report-gen:0.1.0
    python -m ml_engine.cli sign-off --model mr-report-gen:0.1.0 --reviewer dr.x
    python -m ml_engine.cli promote --model mr-report-gen:0.1.0
    python -m ml_engine.cli list
    python -m ml_engine.cli drift --reference ref.json --current cur.json
    python -m ml_engine.cli audit --model mr-report-gen:0.1.0
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from ..evaluation import EvalConfig, EvalHarness, load_samples
from ..registry import DriftMonitor, ModelRegistry, RegistryError, check_gates


def _print(obj: Any) -> None:
    print(json.dumps(obj, indent=2, default=str))


def cmd_register(args: argparse.Namespace) -> int:
    reg = ModelRegistry()
    card = reg.register(
        name=args.name, version=args.version, stage=args.stage,
        artifact_uri=args.artifact or "", code_commit=args.commit or "",
        config=json.loads(args.config) if args.config else {},
    )
    _print(card.to_dict())
    return 0


def cmd_eval(args: argparse.Namespace) -> int:
    samples = load_samples(args.samples)
    harness = EvalHarness(EvalConfig(triage_threshold=args.threshold))
    report = harness.evaluate(samples, test_set=args.test_set)
    result = check_gates(report)
    out = {
        "test_set": report.test_set,
        "test_set_hash": report.test_set_hash,
        "metrics": report.metrics,
        "subgroup_metrics": report.subgroup_metrics,
        "gate_passed": result.passed,
        "gate_failures": result.failures,
    }
    if args.model:
        reg = ModelRegistry()
        gr = reg.attach_eval(args.model, report)
        out["attached_to"] = args.model
        out["gate_passed"] = gr.passed
        out["gate_failures"] = gr.failures
    _print(out)
    return 0 if result.passed else 2


def cmd_promote(args: argparse.Namespace) -> int:
    reg = ModelRegistry()
    card = reg.promote(args.model)
    _print({"model": card.model_id, "lifecycle": card.lifecycle.value, "locked": card.locked})
    return 0


def cmd_sign_off(args: argparse.Namespace) -> int:
    reg = ModelRegistry()
    card = reg.sign_off(args.model, reviewer=args.reviewer or "")
    _print({"model": card.model_id, "reader_study_signoff": card.reader_study_signoff})
    return 0


def cmd_rollback(args: argparse.Namespace) -> int:
    reg = ModelRegistry()
    card = reg.rollback(args.model, reason=args.reason or "manual")
    _print({"model": card.model_id, "lifecycle": card.lifecycle.value})
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    reg = ModelRegistry()
    cards = reg.list(name=args.name, lifecycle=args.lifecycle, stage=args.stage)
    _print([{"model": c.model_id, "stage": c.stage, "lifecycle": c.lifecycle.value,
             "locked": c.locked, "signoff": c.reader_study_signoff} for c in cards])
    return 0


def cmd_drift(args: argparse.Namespace) -> int:
    with open(args.reference) as fh:
        reference = json.load(fh)
    with open(args.current) as fh:
        current = json.load(fh)
    monitor = DriftMonitor(reference)
    report = monitor.check(current)
    _print({
        "action": report.action.value,
        "triggered": report.triggered,
        "alerts": [vars(a) | {"action": a.action.value} for a in report.alerts],
    })
    return 0 if not report.triggered else 3


def cmd_audit(args: argparse.Namespace) -> int:
    reg = ModelRegistry()
    _print(reg.audit_log(args.model))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ml_engine.cli", description="MRI AI Engine MLOps CLI")
    sub = p.add_subparsers(dest="command", required=True)

    r = sub.add_parser("register", help="register a model release")
    r.add_argument("--name", required=True)
    r.add_argument("--version", required=True)
    r.add_argument("--stage", default="encoder")
    r.add_argument("--artifact")
    r.add_argument("--commit")
    r.add_argument("--config", help="JSON string")
    r.set_defaults(func=cmd_register)

    e = sub.add_parser("eval", help="run the evaluation harness on a test set")
    e.add_argument("--samples", required=True, help="path to JSON test set")
    e.add_argument("--test-set", default="", dest="test_set")
    e.add_argument("--threshold", type=float, default=0.5)
    e.add_argument("--model", help="attach the report to this model_id and run gates")
    e.set_defaults(func=cmd_eval)

    pr = sub.add_parser("promote", help="advance a model one lifecycle step")
    pr.add_argument("--model", required=True)
    pr.set_defaults(func=cmd_promote)

    so = sub.add_parser("sign-off", help="record reader-study sign-off")
    so.add_argument("--model", required=True)
    so.add_argument("--reviewer")
    so.set_defaults(func=cmd_sign_off)

    rb = sub.add_parser("rollback", help="roll a model back (e.g. on drift)")
    rb.add_argument("--model", required=True)
    rb.add_argument("--reason")
    rb.set_defaults(func=cmd_rollback)

    ls = sub.add_parser("list", help="list registered models")
    ls.add_argument("--name")
    ls.add_argument("--lifecycle")
    ls.add_argument("--stage")
    ls.set_defaults(func=cmd_list)

    dr = sub.add_parser("drift", help="run a drift check (reference vs current JSON)")
    dr.add_argument("--reference", required=True)
    dr.add_argument("--current", required=True)
    dr.set_defaults(func=cmd_drift)

    au = sub.add_parser("audit", help="show the audit log")
    au.add_argument("--model")
    au.set_defaults(func=cmd_audit)
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except RegistryError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
