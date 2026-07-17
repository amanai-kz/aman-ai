"""Aman AI — MRI AI Engine (Epic SCRUM-7).

Core IP for the MRI Radiology Assistant: a 3D MRI vision encoder, image-text
alignment, an LLM report generator, a triage classifier, synthetic augmentation,
an evaluation harness, and model lifecycle / MLOps.

Sub-packages
------------
- ``registry``    SCRUM-27  model registry, promotion gates, drift monitoring
- ``evaluation``  SCRUM-26  NLG + clinical-efficacy + triage metrics harness
- ``encoder``     SCRUM-21  3D MRI encoder (SSL on FOMO300K)
- ``alignment``   SCRUM-22  MR-CLIP image-text alignment
- ``report_gen``  SCRUM-23  LLM + LoRA report generator
- ``triage_head`` SCRUM-24  calibrated triage classifier
- ``augmentation``SCRUM-25  NV-Generate-MR-Brain synthetic augmentation
- ``biosignal``   SCRUM-68  S2 biosignal encoder (SSL on MIMIC ICU vitals)

Reference: SRS/ТЗ §7 (ML / AI Pipeline), Phases P1-P2.
"""

__version__ = "0.1.0"
