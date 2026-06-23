# Aman AI MRI Engine - Demo Results

Status snapshot of the MRI Radiology Assistant ML engine, demonstrated live on
real brain MRI on the customer GPU server (`univer-gpu6`, 2x NVIDIA A10). Every
number below was produced by `ml_engine/scripts/demo.py` against the registered
checkpoints and the 566-volume open IXI brain-MRI set - not mock data.

Reproduce:

```bash
cd ~/aman-ml/backend
AMAN_ML_REGISTRY_DB=~/aman-ml/run_artifacts/registry.db \
  ~/aman-ml/.venv/bin/python -m ml_engine.scripts.demo --device cuda
```

---

## What this proves (business view)

| Layer | What we showed | State |
|-------|----------------|-------|
| Infrastructure | Engine runs on the customer's own GPU server; data never leaves it (KZ residency, D11). | Working |
| MLOps | Every model is versioned, gate-checked, and promoted to "production" only after sign-off, with an immutable audit trail. | Working |
| Serving | A real 3D MRI is triaged end-to-end in ~20-30 ms; assistive-only, radiologist signs off every output. | Working |
| Scientific rigor | Every metric ships with a confidence interval; the safety gate trusts the lower bound, not an optimistic average. | Working |
| Core learning | Self-supervised pretraining on real MRI **demonstrably learned brain anatomy** (beats an untrained model on a held-out anatomical task). | **Validated** |
| Clinical accuracy | Detecting real pathology (hemorrhage, mass effect, infarct). | **Blocked on cleared data** (D10/D17) - the one piece engineering cannot supply. |

The honest headline: the **engine and the science are real and working**; the
gap to a clinical product is a **cleared, report-paired clinical dataset** and
the **regulatory pathway** - both external, both already scoped.

---

## The results (technical view)

### 1. Environment
- 2x NVIDIA A10 (24 GB each), CUDA, torch 2.5.1+cu121.
- 566 real brain-MRI volumes (open IXI T1, CC BY-SA) for dev/validation.

### 2. Model registry / MLOps lifecycle (SCRUM-27)
10 versioned model cards across the four stages (encoder, alignment, triage,
report-gen). Lifecycle is enforced:
`register -> eval (gates) -> staging -> reader-study sign-off -> production (locked)`,
with an immutable audit log. Decision D2: every served output is assistive and
requires radiologist sign-off.

### 3. Live triage on real scans (SCRUM-24)
Real 3D volume -> SSL encoder -> calibrated triage head -> abstention gate, served
over HTTP.
- **End-to-end latency ~20-30 ms/scan** on a single A10 (first call ~200 ms warm-up).
- Calibrated probabilities (temperature-scaled) + an **abstention band** that
  routes uncertain cases to manual review instead of guessing.
- Honest caveat: IXI subjects are healthy controls and the triage *head weights*
  are a placeholder trained on synthetic findings, so the probabilities are not
  yet clinically meaningful. What is real and delivered: the serving pipeline,
  the calibration + abstention machinery, and the encoder beneath it (section 5).

### 4. Statistical rigor (SCRUM-26, decision D18)
Confidence intervals are wired into the eval harness:
- Clopper-Pearson (exact) for proportions like sensitivity; Wilson for rates;
  bootstrap for AUROC. Every reported metric ships with an interval and `n`.
- The production gate compares the **lower bound** of the sensitivity CI against
  the 0.95 safety threshold - so we never promote a model on an optimistic point
  estimate. Worked example: 95/100 = 0.950 sensitivity has a 95% CI of
  [0.887, 0.984]; lower bound 0.887 < 0.95 -> the gate **blocks** promotion.

### 5. SSL transfer - the core result (SCRUM-21 acceptance #3)
Question: did self-supervised pretraining on real MRI actually learn anatomy, or
is the encoder just a random feature extractor? Test: freeze each encoder, fit a
simple linear probe on a held-out **brain-tissue-volume** task (derived from the
IXI segmentation masks), compare to an identical-architecture **untrained** model
on the same split.

| Encoder | Balanced accuracy | Macro-AUROC |
|---------|-------------------|-------------|
| **SSL-pretrained** | **0.726** | **0.769** |
| From-scratch (random init) | 0.642 | 0.718 |

- Margin **+0.084** balanced accuracy (+0.051 AUROC), `n_train=340 / n_test=226`,
  566 real volumes. Verdict: **SSL beats from-scratch -> acceptance criterion #3 SATISFIED.**
- Interpretation: the pretraining genuinely encoded anatomical structure; this is
  the transferable backbone the clinical model will be built on.

---

## Live demo (interactive)

The engine is also served as a FastAPI app for hands-on use:

```bash
# On the GPU server:
AMAN_ML_ENCODER_CKPT=.../mr-encoder-1.0.0-ixi.pt \
AMAN_ML_TRIAGE_CKPT=.../mr-triage-0.1.1.pt   AMAN_ML_DEVICE=cuda \
  python -m uvicorn ml_engine.serving.app:create_default_app --factory --port 8001
# Then tunnel from a laptop and open http://localhost:8001/docs
```

Endpoints: `GET /healthz`, `GET /models`, `POST /triage` (NIfTI upload ->
calibrated findings + abstention), `POST /report` (draft report; requires the
report generator boot).

---

## What's left (and who owns it)

1. **Cleared, report-paired brain-MRI dataset** (D10/D17) - the critical path.
   Legal/business, not engineering: a signed DPA / data partnership. The code is
   ready - one `--data-dir` swap retrains the production model on cleared data.
2. **Regulatory pathway** - KZ SaMD classification + clinical reader study.
   External, multi-party. See `docs/regulatory-readiness.md`.
3. **Next ML batch** (engineering, ready to start) - biomedical text encoder +
   alignment; report-gen grounding + factuality; brain-MRI foundation-model
   warm-start (D16).
4. **Product-safety hardening** (separate PR) - inference auth, atomic sign-off,
   no mock-on-error, async inference, CI/CD.

The build is honestly labelled: validated engineering on research-licensed data,
not yet a certified medical device.
