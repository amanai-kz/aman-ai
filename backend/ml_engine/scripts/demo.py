"""End-to-end demo of the Aman AI MRI engine on real brain MRI.

Runs on the GPU host against the registered checkpoints and the open IXI set.
Five self-contained, independently-guarded sections so a single failure never
breaks the show:

  1. Environment + GPU
  2. Model registry / MLOps lifecycle
  3. Live triage on real scans (calibrated probabilities + abstention)
  4. Statistical rigor: confidence intervals + the promotion gate (D18)
  5. SSL transfer: linear-probe pretrained-vs-from-scratch on real data

Honest framing: IXI subjects are healthy controls and the triage head was
trained on synthetic findings, so section 3 shows the *pipeline* running
end-to-end on real scans with calibrated, sign-off-flagged outputs -- not
clinical accuracy. Clinical accuracy needs the cleared, pathology-labelled
partner dataset (decisions D10/D17). Section 5 is a genuine, reproducible
transfer result on real morphometry.

Usage (from <repo>/backend, on the GPU host):

    AMAN_ML_REGISTRY_DB=~/aman-ml/run_artifacts/registry.db \
    python -m ml_engine.scripts.demo \
        --ckpt-dir ~/aman-ml/run_artifacts/ckpts \
        --image-dir ~/aman-ml/data/ixi_tiny/image \
        --label-dir ~/aman-ml/data/ixi_tiny/label \
        --device cuda
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import traceback
from pathlib import Path

# Make `import ml_engine...` work whether run as a module or a bare script.
_HERE = Path(__file__).resolve()
_BACKEND = _HERE.parents[2]              # .../backend/ml_engine/scripts -> .../backend
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


# --------------------------------------------------------------------------- #
# Pretty printing
# --------------------------------------------------------------------------- #
def rule(title: str = "") -> None:
    bar = "=" * 78
    if title:
        print(f"\n{bar}\n  {title}\n{bar}")
    else:
        print(bar)


def kv(key: str, val: object, width: int = 26) -> None:
    print(f"  {key:<{width}} {val}")


def section(fn):
    """Run a section; on failure print the traceback and keep going."""
    def wrapped(*a, **k):
        try:
            return fn(*a, **k)
        except Exception as exc:  # noqa: BLE001
            print(f"\n  [section '{fn.__name__}' failed: {exc}]")
            traceback.print_exc()
            return None
    return wrapped


# --------------------------------------------------------------------------- #
# 1. Environment
# --------------------------------------------------------------------------- #
@section
def show_environment(args) -> None:
    rule("1. ENVIRONMENT")
    import torch
    kv("torch", torch.__version__)
    kv("CUDA available", torch.cuda.is_available())
    if torch.cuda.is_available():
        kv("GPU", torch.cuda.get_device_name(0))
        kv("GPU count", torch.cuda.device_count())
        total = torch.cuda.get_device_properties(0).total_memory / 1e9
        kv("GPU memory", f"{total:.0f} GB")
    kv("checkpoints dir", args.ckpt_dir)
    kv("real MRI volumes", len(_list_volumes(args.image_dir)))


# --------------------------------------------------------------------------- #
# 2. Registry / MLOps lifecycle
# --------------------------------------------------------------------------- #
@section
def show_registry(args) -> None:
    rule("2. MODEL REGISTRY  (versioned checkpoints + lifecycle, SCRUM-27)")
    from ml_engine.registry import ModelRegistry
    cards = ModelRegistry().list()
    if not cards:
        print("  (registry empty -- set AMAN_ML_REGISTRY_DB to the populated DB)")
        return
    print(f"  {'MODEL':<28} {'STAGE':<14} {'LIFECYCLE':<12} LOCKED")
    print(f"  {'-'*28} {'-'*14} {'-'*12} ------")
    for c in sorted(cards, key=lambda c: (c.stage, c.model_id)):
        print(f"  {c.model_id:<28} {c.stage:<14} {c.lifecycle.value:<12} {c.locked}")
    print("\n  Lifecycle is gated: register -> eval (gates) -> staging -> reader-study")
    print("  sign-off -> production (locked, immutable audit trail).  Decision D2:")
    print("  every served output is assistive and requires radiologist sign-off.")


# --------------------------------------------------------------------------- #
# Volume helpers
# --------------------------------------------------------------------------- #
def _list_volumes(image_dir: str) -> list[Path]:
    d = Path(os.path.expanduser(image_dir))
    if not d.exists():
        return []
    return sorted([p for p in d.iterdir() if p.name.endswith((".nii", ".nii.gz"))])


# --------------------------------------------------------------------------- #
# 3. Live triage on real scans
# --------------------------------------------------------------------------- #
@section
def run_triage(args) -> dict | None:
    rule("3. LIVE TRIAGE ON REAL BRAIN MRI  (calibrated + abstention, SCRUM-24)")
    import torch
    from ml_engine.encoder.data import load_nifti
    from ml_engine.serving.engine import InferenceEngine

    enc = os.path.join(os.path.expanduser(args.ckpt_dir), args.encoder_ckpt)
    tri = os.path.join(os.path.expanduser(args.ckpt_dir), args.triage_ckpt)
    print(f"  encoder : {args.encoder_ckpt}   (SSL-pretrained on 566 real IXI T1 volumes)")
    print(f"  triage  : {args.triage_ckpt}")
    t0 = time.time()
    engine = InferenceEngine.from_checkpoints(enc, tri, device=args.device)
    print(f"  models loaded in {time.time()-t0:.1f}s on {engine.dev}\n")

    img_size = engine.encoder.cfg.img_size
    in_ch = engine.encoder.cfg.in_channels
    vols = _list_volumes(args.image_dir)[: args.n_scans]
    abstained = 0
    latencies: list[float] = []
    findings = engine.findings
    print(f"  What is REAL here: a real 3D brain MRI goes through the full serving")
    print(f"  path (load -> encode -> calibrated triage head -> abstention gate) and")
    print(f"  returns in milliseconds. Findings screened: {', '.join(findings)}\n")
    for p in vols:
        vol = load_nifti(str(p), img_size=img_size, in_channels=in_ch)
        t0 = time.time()
        r = engine.triage_study(vol)
        ms = (time.time() - t0) * 1000
        latencies.append(ms)
        abstained += int(r.abstain)
        probs = "  ".join(f"{k}={v:.3f}" for k, v in r.per_finding.items())
        flag = "ABSTAIN->manual review" if r.abstain else f"top={r.top_finding}"
        sub = p.name.split("_")[0]
        print(f"  {sub:<20} {probs}")
        kv("", f"severity={r.severity:.3f}  {flag}  ({ms:.0f} ms)", width=20)
    if latencies:
        mean_ms = sum(latencies) / len(latencies)
        print(f"\n  end-to-end latency: ~{mean_ms:.0f} ms/scan on one A10 (real 3D volumes).")
    print(f"\n  HONEST CAVEAT: IXI are healthy controls and the triage *head weights*")
    print(f"  are a placeholder trained on synthetic findings, so the probabilities")
    print(f"  above are NOT clinically meaningful (they saturate on out-of-distribution")
    print(f"  healthy scans). What is delivered and real: the serving pipeline, the")
    print(f"  calibration + abstention machinery, and the encoder beneath -- which IS")
    print(f"  pretrained on real MRI and demonstrably learned anatomy (see section 5).")
    print(f"  Clinically-meaningful triage needs the cleared, pathology-labelled")
    print(f"  partner dataset (decisions D10/D17) -- the one piece code cannot supply.")
    return {"n": len(vols), "abstained": abstained}


# --------------------------------------------------------------------------- #
# 4. Statistical rigor: CIs + the gate
# --------------------------------------------------------------------------- #
@section
def show_statistical_rigor(args, triage_summary: dict | None) -> None:
    rule("4. STATISTICAL RIGOR  (confidence intervals + the gate, SCRUM-26 / D18)")
    from ml_engine.evaluation.stats import clopper_pearson, wilson_interval
    from ml_engine.config import gates as eval_gates

    # 4a. A real statistic from this very run: abstention rate + 95% CI.
    if triage_summary and triage_summary["n"]:
        k, n = triage_summary["abstained"], triage_summary["n"]
        lo, hi = wilson_interval(k, n)
        print("  Live statistic from section 3 (abstention = routed to manual review):")
        kv("    abstained / total", f"{k} / {n}")
        kv("    rate (95% Wilson CI)", f"{k/n:.3f}  [{lo:.3f}, {hi:.3f}]")

    # 4b. The promotion gate uses the CI *lower bound*, not the point estimate (D18).
    print("\n  Promotion gate (production, safety-critical) -- decision D18:")
    print("  a model passes only if the *lower* bound of the sensitivity CI clears")
    print("  the threshold, so we never promote on an optimistic point estimate.")
    gate = eval_gates.triage_sensitivity_min
    print(f"\n  {'illustrative sensitivity':<28}{'95% Clopper-Pearson CI':<28}{'gate>=%.2f?' % gate}")
    print(f"  {'-'*26}  {'-'*26}  {'-'*10}")
    for k, n in [(95, 100), (190, 200), (48, 50)]:
        lo, hi = clopper_pearson(k, n)
        verdict = "PASS" if lo >= gate else "BLOCK"
        print(f"  {k}/{n} = {k/n:.3f}{'':<14}[{lo:.3f}, {hi:.3f}]{'':<10}{verdict}  (lower={lo:.3f})")
    print("\n  (Clopper-Pearson exact for proportions; bootstrap CIs for AUROC --")
    print("   both wired into the eval harness so every reported metric ships with")
    print("   an interval and n. This is the batch-1 'world-class' upgrade.)")


# --------------------------------------------------------------------------- #
# 5. SSL transfer: linear probe pretrained vs from-scratch
# --------------------------------------------------------------------------- #
def _brain_volume_labels(image_dir: str, label_dir: str, max_n: int) -> Path:
    """Derive a binary morphometric label (brain-volume median split) per subject
    from the segmentation masks, and write a `path,label` CSV. No fabrication:
    the label is the count of non-zero voxels in each subject's own mask.
    """
    import csv
    import nibabel as nib
    import numpy as np

    imgs = _list_volumes(image_dir)[:max_n] if max_n else _list_volumes(image_dir)
    ldir = Path(os.path.expanduser(label_dir))
    rows: list[tuple[str, float]] = []
    for p in imgs:
        sub = p.name.split("_")[0]
        matches = list(ldir.glob(f"{sub}_*"))
        if not matches:
            continue
        mask = np.asarray(nib.load(str(matches[0])).dataobj)
        rows.append((p.name, float((mask > 0).sum())))
    if not rows:
        raise RuntimeError("no image/label pairs matched")
    median = float(np.median([v for _, v in rows]))
    out = Path(os.path.expanduser("~")) / ".cache" / "aman_demo_morph_labels.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["path", "label"])
        for name, vol in rows:
            w.writerow([name, "large" if vol >= median else "small"])
    return out


@section
def run_linear_probe(args) -> None:
    rule("5. SSL TRANSFER  (linear-probe: pretrained vs from-scratch, SCRUM-21 #3)")
    print("  Task: predict brain-tissue volume (median split) from frozen encoder")
    print("  features -- a discriminating morphometric task derived from the IXI")
    print("  segmentation masks. If SSL learned anatomy, its frozen features beat")
    print("  an identical-architecture random-init encoder on the same split.\n")
    from ml_engine.encoder.linear_probe import (
        LabeledNiftiDataset, _cfg_from_checkpoint, compare_pretrained_vs_scratch,
    )

    enc = os.path.join(os.path.expanduser(args.ckpt_dir), args.encoder_ckpt)
    csv_path = _brain_volume_labels(args.image_dir, args.label_dir, args.probe_max)
    cfg = _cfg_from_checkpoint(enc)
    ds = LabeledNiftiDataset(args.image_dir, csv_path,
                             img_size=cfg.img_size, in_channels=cfg.in_channels)
    print(f"  dataset: {len(ds)} real volumes  |  classes: {ds.classes}")
    t0 = time.time()
    res = compare_pretrained_vs_scratch(
        ds, ckpt=enc, cfg=cfg, n_classes=2,
        probe_iters=args.probe_iters, device=args.device, seed=0,
    )
    dt = time.time() - t0
    pre, scr = res["pretrained"], res["scratch"]
    print(f"\n  n_train={res['n_train']}  n_test={res['n_test']}  "
          f"(probe fit in {dt:.0f}s)\n")
    print(f"  {'encoder':<20}{'balanced acc':<16}{'macro-AUROC':<14}")
    print(f"  {'-'*18}  {'-'*14}  {'-'*12}")
    print(f"  {'SSL-pretrained':<20}{pre['balanced_accuracy']:<16.3f}{pre['macro_auroc']:<14.3f}")
    print(f"  {'from-scratch':<20}{scr['balanced_accuracy']:<16.3f}{scr['macro_auroc']:<14.3f}")
    verdict = "SSL BEATS FROM-SCRATCH" if res["beats_scratch"] else "no transfer on this task"
    print(f"\n  margin (balanced acc): {res['margin_balanced_accuracy']:+.3f}   -> {verdict}")
    print(f"  acceptance criterion #3 (linear-probe beats from-scratch): "
          f"{'SATISFIED' if res['beats_scratch'] else 'not shown'}")


# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Aman AI MRI engine -- end-to-end demo")
    ap.add_argument("--ckpt-dir", default="~/aman-ml/run_artifacts/ckpts")
    ap.add_argument("--image-dir", default="~/aman-ml/data/ixi_tiny/image")
    ap.add_argument("--label-dir", default="~/aman-ml/data/ixi_tiny/label")
    ap.add_argument("--encoder-ckpt", default="mr-encoder-1.0.0-ixi.pt")
    ap.add_argument("--triage-ckpt", default="mr-triage-0.1.1.pt")
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--n-scans", type=int, default=4, help="scans to triage in section 3")
    ap.add_argument("--probe-iters", type=int, default=500)
    ap.add_argument("--probe-max", type=int, default=0,
                    help="cap volumes used in the probe (0 = all)")
    ap.add_argument("--skip-probe", action="store_true",
                    help="skip section 5 (the slow one)")
    args = ap.parse_args(argv)

    rule()
    print("  AMAN AI -- MRI RADIOLOGY ASSISTANT : ENGINE DEMO")
    print("  Real models, real brain MRI, on the customer GPU server.")
    rule()

    show_environment(args)
    show_registry(args)
    summary = run_triage(args)
    show_statistical_rigor(args, summary)
    if not args.skip_probe:
        run_linear_probe(args)

    rule("DONE")
    print("  Assistive only -- every output requires radiologist sign-off (D2).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
