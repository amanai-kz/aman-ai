# Aman AI — Roadmap to a World-Class Brain-MRI AI Engine

*Status: 2026-06-23. Owner: ML Engineering (Epic SCRUM-7). Audience: leadership (business) + technical leads.*

This document is grounded in (a) a code audit of the current engine across ML,
MLOps, and product layers, and (b) a verified deep-research pass on the 2024-2026
state of the art (fact-checked by multi-vote adversarial verification; sources
cited inline). It states honestly where we are, defines what "world-class" means
in 2026, and gives a prioritized, evidence-backed plan with target metrics.

---

## 1. Executive summary (for leadership)

**What we have.** A clean, end-to-end, *honestly-engineered* MRI AI engine: a 3D
vision encoder, image-text alignment, an LLM report generator, a calibrated
triage classifier, a full MLOps spine (model registry, lifecycle gates, audit
log, drift monitor), a serving API, and a product flow wired into the existing
radiologist worklist with mandatory sign-off. It runs on real GPUs (2x A10),
trains on real open brain MRI (IXI), and is unit-tested. The safety posture
(radiologist-in-the-loop, calibration, abstention, synthetic-data isolation) is
genuinely strong and is our most defensible asset.

**The honest gap.** Today the engine is **world-class infrastructure wrapped
around prototype-grade models**. Three things separate us from a fundable,
publishable, certifiable product:
1. **Data.** We train on synthetic/open data with **no paired radiology
   reports**. The entire SOTA in this field is built on *report-paired 3D scans*
   (e.g. CT-RATE: 25,692 chest CT each with a report). This is the single
   highest-leverage gap. [arXiv:2403.17834]
2. **Model recipes.** Our architectures are sound but generic (2021-era MAE/CLIP),
   not the 2025-26 medical recipes (foundation-model warm-starts, grounded
   reporting, factuality-rewarded generation).
3. **Evaluation credibility.** Several "clinical" metrics are home-grown
   approximations, and we report point estimates with **no confidence intervals**
   — below the bar a journal reviewer or regulator will accept.

**The opportunity.** Brain-MRI report generation is *under-served* versus chest
imaging, and pixel-grounded brain-MRI reporting is brand-new (first method
published mid-2024). With the right data partnership and the upgrades below, this
is a credible path to (a) a strong arXiv/MICCAI publication, (b) defensible IP,
and (c) an assistive SaMD product on the EU/US/KZ regulatory lanes.

**The ask.** (1) Secure one **report-paired brain-MRI data partnership** (the
critical path). (2) Fund a ~6-month ML push to SOTA recipes + a credible
evaluation. (3) In parallel we are already shipping the engineering quick-wins
(this session) that make the platform safe and reproducible.

---

## 2. Where we are — honest audit

### Genuinely strong (defensible today)
- **MLOps lifecycle**: explicit state machine, immutable versions, append-only
  audit log, reader-study sign-off + model lock before production, gates that
  treat a missing metric as a failure (correct safety default).
- **Calibration & triage safety**: correct Guo-2017 temperature scaling, ECE/MCE/
  Brier, abstention band; drift via PSI + two-sample KS; tie-corrected AUROC.
- **Safety-by-design**: assistive-only, radiologist signs every report; synthetic
  augmentation is provably isolated from patient-facing views (enforced invariant).
- **Product spine**: real auth/RBAC, patient-scoped authorization, a working
  worklist -> review -> sign-off workflow with an audit trail.

### Gaps that block "world-class" (with fixes in section 4)
- **ML (models):** the masked-autoencoder objective is mis-implemented (encodes
  the full volume, masks *after* the forward pass); alignment has no real text
  encoder; the triage head trains on synthetic linearly-separable features (so its
  reported AUROC/sensitivity are self-fulfilling); report-gen has no grounding,
  no structured findings, and no factuality objective despite docstring claims.
- **Evaluation:** BLEU/ROUGE/METEOR are hand-rolled and diverge from standard
  implementations; **RadGraph and CheXbert are not actually run** (they are
  set/dict overlap over labels the generator itself emits); GREEN is a stub. No
  bootstrap confidence intervals, Clopper-Pearson bounds, or significance tests
  anywhere. No experiment tracking (MLflow is commented out); the eval harness
  sets no seed and never records the git SHA.
- **Product:** the inference FastAPI endpoint has **no authentication**; sign-off
  is non-atomic (no DB transaction / optimistic lock); slow ML inference runs
  synchronously and will time out on real volumes; the worklist silently shows
  **mock data on a DB error** (a radiologist could see fabricated findings);
  `mapRisk` never returns CRITICAL; secrets are committed; there is no CI/CD.

---

## 3. What "world-class" means in 2026 (verified research)

**The data lever dominates.** The proven path is *report-paired 3D volumes*.
CT-RATE (25,692 chest CT / 21,304 patients, each with a report) is the template;
CT-CHAT pairs that encoder with an LLM over 2.7M+ QA pairs — the same
encoder->projector->LLM shape we already have. IXI has **no reports**, so
report-paired MRI must be acquired. [arXiv:2403.17834; Nature BME s41551-025-01599-y]

**Brain-MRI foundation models exist — and they favor contrastive SSL.**
BrainIAC (Nature Neuroscience 2026) is a 3D ViT-B trained with **contrastive
SimCLR**, explicitly chosen over MAE and over ResNet/Swin baselines, on 32,015
multiparametric MRIs from 16 datasets. In low-data regimes it crushes prior
backbones (10% data: balanced-acc 90.8 vs 74.2). Implication: our MAE-only
encoder default is not the 2026 recipe for brain MRI; add a contrastive objective
and warm-start from a public brain-MRI FM. [Nature Neuro s41593-026-02202-6; arXiv:2412.17041]

**Reporting is now grounded.** MAIRA-2 set the grounded-reporting paradigm
(frozen Rad-DINO ViT -> MLP adapter -> 7B LLM, reports as sentences with spatial
boxes). AutoRG-Brain is the first **pixel-grounded brain-MRI** report generator
(anomaly-ROI segmentation then visual prompting), reporting Prompt RadGraph 41.74
/ RadCliQ 0.30 / RaTEScore 68.76 (oracle-mask setting) vs MedFlamingo 16.93.
Grounding + structured findings is the differentiator for trust. [arXiv:2406.04449; arXiv:2407.16684]

**Factuality is trained, not hoped for.** Evidence-aware RL rewards that score
true/false-positive/false-negative findings against spatial maps improve clinical
metrics over supervised fine-tuning (e.g. RadGraph-F1 +~0.02-0.03 in CXR
studies). The lever is real; specific numbers are CXR-2D and not universal
targets. [arXiv:2604.13598, medium confidence]

**Evaluation the field trusts:** RadGraph-F1, GREEN (LLM-based factuality),
RadCliQ, RaTEScore for reports; sensitivity-at-fixed-specificity, AUROC, ECE, and
OOD/abstention for triage; subgroup/fairness breakdowns; and — non-negotiable for
publication/regulators — **confidence intervals (bootstrap; Clopper-Pearson for
sensitivity)**, frozen hash-pinned test sets, model cards, data statements, seeds,
and ablations.

> Note: some widely-repeated claims did **not** survive verification and are *not*
> used here as targets (e.g. "CT-CLIP beats supervised on all metrics", a specific
> "MedGemma SOTA RadGraph-F1 30.3", and treating one paper's CXR numbers as
> universal 2026 targets). We anchor to *paradigms and method levers*, not to
> contested leaderboard numbers.

---

## 4. The plan — three senior lenses

### 4A. ML / Research (primary focus)

**Encoder (Stage A)**
- *Now (quick-win):* fix the SSL objective to true masked-input prediction
  (SimMIM-style: corrupt masked patches at the input with a learnable mask token,
  reconstruct masked patches only, normalize patch targets). [shipping this session]
- *Next:* add a **SimCLR/SigLIP contrastive SSL** option (BrainIAC-aligned) and
  support **warm-starts from a public brain-MRI FM**; move to a hierarchical /
  multi-scale 3D backbone for small-lesion sensitivity.
- *Multi-modal routing:* actually implement T1/T2/FLAIR/SWI fusion (config lists
  it; code is single-channel).

**Alignment (Stage B)**
- Wire a real **frozen biomedical text encoder** (BiomedCLIP / CXR-BERT-style)
  instead of the current placeholder linear-over-precomputed-vector.
- Swap InfoNCE -> **SigLIP** loss (better at small batch), add **hard-negative
  mining** and **local+global** (token-level) alignment for localized findings.

**Report generation (Stage C)**
- Add **grounding** (segmentation-anchored, AutoRG-Brain style) and actually emit
  the `StructuredFinding` objects that are defined but never produced.
- Add a **factuality objective** (RadGraph/entity-F1 or GREEN-style reward; DPO/RL)
  on top of next-token loss; constrain decoding to the clinical vocabulary;
  implement the promised **abstention**.

**Triage (Stage D)**
- *Now (quick-win):* **focal loss + class weighting** for rare critical findings,
  **per-class temperature**, and **operating-point selection at a target
  sensitivity** instead of a hard-coded abstention band.
- *Next:* **conformal / risk-controlled prediction** to give a statistical
  guarantee on critical-finding sensitivity — a genuine safety differentiator.

**Augmentation (Stage E)**
- Wire a real generative backend (currently `NotImplementedError`) with FID/expert
  quality-gating and a principled real:synthetic mixing policy; keep the
  (excellent) isolation invariant.

**Publication / IP angle.** Two credible thrusts: (1) *pixel-grounded brain-MRI
reporting with risk-controlled triage* (novel; brain MRI is under-served) — target
a MICCAI / Radiology: AI submission; (2) defensible IP around the
**provably-isolated synthetic-augmentation safety invariant** and the
**conformal critical-finding guarantee**.

### 4B. Evaluation & MLOps (the credibility layer)
- *Now (quick-wins):* real NLG metrics (`sacrebleu`, `rouge-score`); **bootstrap
  CIs + Clopper-Pearson** lower bound on sensitivity, and **gate on the CI lower
  bound**; fix the RadGraph empty-set F1=1.0 bug; fix the `subgroup_metrics` type
  contract; record seed + git SHA + full (untruncated) test-set hash; add MLflow
  experiment tracking. [several shipping this session]
- *Next:* integrate **real RadGraph / f1chexbert / GREEN**, validated against
  published numbers; build a **frozen, hash-verified multi-site test set** with a
  data card; stand up a **reader-study / MRMC** harness feeding the existing
  sign-off; surface calibration reliability tables into the model card.

### 4C. Product / Fullstack (make it safe and scalable)
- *Now (urgent safety quick-wins):* add **auth on the inference endpoint**; make
  **sign-off atomic** (transaction + "already signed" guard + optimistic lock);
  stop showing **mock data on DB error** in the worklist; fix `mapRisk` CRITICAL;
  move **secrets to a vault**; add a **CI workflow** (lint + typecheck + tests +
  build).
- *Next:* **async inference** (persist `Analysis(PENDING)`, enqueue to a
  Redis/Celery worker on the GPU host, return 202, poll/stream status);
  **observability** (structured logs, OpenTelemetry traces, Prometheus latency/
  error metrics); **PHI hardening** (encryption at rest, signed-URL object storage
  with read audit, retention); a **typed OpenAPI contract** between Next and FastAPI.

---

## 5. Target metrics — what lets leadership credibly say "world-class"

| Dimension | Today | World-class target (2026 anchor) |
|---|---|---|
| Report factuality | RadGraph/CheXbert **approximated** (not real) | Real **RadGraph-F1** + **GREEN** + **RadCliQ/RaTEScore**, reported with 95% CIs; competitive with AutoRG-Brain-class brain-MRI reporting [arXiv:2407.16684] |
| Critical-finding triage | sensitivity on **synthetic** task | **Sensitivity >= 0.95 with a Clopper-Pearson lower bound**, AUROC, ECE <= 0.05, OOD-abstention, **conformal guarantee** |
| Foundation | MAE on IXI (no reports) | Contrastive SSL warm-started from a **brain-MRI FM**, trained on **report-paired** data [Nature Neuro s41593-026-02202-6] |
| Reproducibility | no tracking, no seed, no CI | **MLflow** run lineage, seeds, git SHA, **frozen hash-pinned test set**, model cards, ablations |
| Clinical validation | sign-off boolean | **Reader study / MRMC** with inter-rater agreement |
| Product reliability | sync inference, no CI, safety bugs | async job pipeline, observability, CI/CD, **zero patient-safety defects** |

---

## 6. Sequencing

- **This week (engineering quick-wins, in progress this session):** SSL MAE fix;
  triage focal-loss + per-class temperature + operating point; bootstrap CIs +
  CI-gated sensitivity; real NLG metrics + metric-honesty fixes; MLflow tracking;
  reproducibility metadata; urgent product-safety fixes; first CI workflow.
- **30-60-90 days:** real RadGraph/CheXbert/GREEN; biomedical text encoder +
  SigLIP alignment; report-gen grounding + structured findings; async inference +
  observability; frozen multi-site test set + data card.
- **6-12 months (needs the data partnership):** train on report-paired brain MRI
  warm-started from a brain-MRI FM; factuality RL; conformal triage; reader study;
  regulatory pack (EU MDR + EU AI Act high-risk obligations are phasing in through
  2026; assistive radiology AI is high-risk) and KZ registration.

---

## 7. Risks & honest caveats
- **Data licensing is the critical path** (decision D10): research datasets
  (MR-RATE etc.) are non-commercial; the production model needs commercially
  cleared, report-paired partner data. No amount of engineering substitutes for this.
- **Do not overclaim.** Until the real metrics + reader study exist, this is
  "validated engineering on research-licensed data", not a certified device.
- **Regulatory timeline is long and multi-party** (months), independent of code.

---

## 8. Implemented in this session
See the accompanying PR(s). This session delivers the first batch of section-4
quick-wins (ML SSL correctness + evaluation statistical rigor), each unit-tested,
plus this roadmap. Subsequent batches follow the sequencing in section 6.
