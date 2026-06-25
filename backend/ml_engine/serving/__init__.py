"""Inference serving for the MRI AI engine (§7.5)."""
from .engine import InferenceEngine, TriageResult
from .app import build_router, create_app, create_default_app
from .ood import MahalanobisOOD, OODVerdict, fit_from_feature_batches
from .saliency import Saliency, finding_saliency
from .findings import StructuredFinding, structured_findings, mc_dropout_probs

__all__ = ["InferenceEngine", "TriageResult", "build_router",
           "create_app", "create_default_app",
           "MahalanobisOOD", "OODVerdict", "fit_from_feature_batches",
           "Saliency", "finding_saliency",
           "StructuredFinding", "structured_findings", "mc_dropout_probs"]
