"""
S1: CT/MRI Analysis Service
===========================
Deep Learning analysis of brain scans for early diagnosis
of neurodegenerative diseases.

Team: Murat, Adilet

ML inference is wired to the MRI engine (``ml_engine.serving``, Epic SCRUM-7):
The 3D triage engine and 2D segmentation model are separate, opt-in stages.
Neither returns fabricated clinical findings when its checkpoint is absent.
Assistive only — output is flagged for radiologist sign-off (decision D2).
"""

import os
import tempfile
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.core.auth import (
    CurrentUserContext,
    get_current_user_context,
    require_patient_access_if_present,
)
from app.services.mri_segmentation import (
    IncompatibleCheckpointError,
    InferenceError,
    MalformedImageError,
    ModelNotConfiguredError,
    MriSegmenter,
    decode_and_preprocess,
)

router = APIRouter(dependencies=[Depends(get_current_user_context)])

# Lazy singleton — built on first use from AMAN_ML_ENCODER_CKPT / AMAN_ML_TRIAGE_CKPT.
_ENGINE = None
_ENGINE_TRIED = False
_SEGMENTER = None
MAX_SEGMENTATION_UPLOAD_BYTES = 10 * 1024 * 1024
SEGMENTATION_CONTENT_TYPES = {"image/png", "image/jpeg", "image/tiff"}
SEGMENTATION_EXTENSIONS = (".png", ".jpg", ".jpeg", ".tif", ".tiff")


def _get_engine():
    """Return the ML InferenceEngine, or None if not configured/available."""
    global _ENGINE, _ENGINE_TRIED
    if _ENGINE_TRIED:
        return _ENGINE
    _ENGINE_TRIED = True
    enc, tri = os.environ.get("AMAN_ML_ENCODER_CKPT"), os.environ.get("AMAN_ML_TRIAGE_CKPT")
    if enc and tri:
        try:
            from ml_engine.serving import InferenceEngine
            _ENGINE = InferenceEngine.from_checkpoints(
                enc, tri, device=os.environ.get("AMAN_ML_DEVICE", "cpu"))
        except Exception:  # noqa: BLE001 — never let model load break the API
            _ENGINE = None
    return _ENGINE


def _get_segmenter():
    """Build the segmentation model once; failed configuration may be retried."""
    global _SEGMENTER
    if _SEGMENTER is None:
        _SEGMENTER = MriSegmenter.from_environment()
    return _SEGMENTER


def _risk_level(severity: float, abstain: bool) -> str:
    if abstain:
        return "review"          # uncertain -> route to manual review (D2)
    if severity >= 0.70:
        return "high"
    if severity >= 0.40:
        return "medium"
    return "low"


class ScanAnalysisRequest(BaseModel):
    scan_type: str  # "ct" or "mri"
    patient_id: Optional[str] = None
    notes: Optional[str] = None


class ScanAnalysisResult(BaseModel):
    id: str
    scan_type: str
    status: str
    findings: List[str]
    confidence: float
    risk_level: str  # "low", "medium", "high"
    recommendations: List[str]
    processing_time_ms: int
    segmentation: Optional[dict] = None


class ScanHistory(BaseModel):
    id: str
    scan_type: str
    date: str
    risk_level: str
    status: str


@router.post("/analyze", response_model=ScanAnalysisResult)
async def analyze_scan(
    file: UploadFile = File(...),
    scan_type: str = "mri",
    patient_id: Optional[str] = None,
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """
    Upload and analyze CT/MRI scan.
    
    Supported formats: NIfTI for 3D triage; PNG/JPEG/TIFF for 2D segmentation.
    """
    require_patient_access_if_present(patient_id, current_user)

    filename = (file.filename or "").lower()
    is_nifti = filename.endswith((".nii", ".nii.gz"))
    is_segmentation_image = filename.endswith(SEGMENTATION_EXTENSIONS)
    if is_segmentation_image and file.content_type not in SEGMENTATION_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: PNG, JPEG, TIFF, or NIfTI",
        )
    if not is_nifti and not is_segmentation_image:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: PNG, JPEG, TIFF, or NIfTI",
        )

    if is_segmentation_image:
        image_bytes = await file.read(MAX_SEGMENTATION_UPLOAD_BYTES + 1)
        if len(image_bytes) > MAX_SEGMENTATION_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="MRI image exceeds the upload limit")
        try:
            input_tensor = decode_and_preprocess(image_bytes)
            t0 = time.time()
            segmentation = _get_segmenter().segment(input_tensor)
        except MalformedImageError as exc:
            raise HTTPException(status_code=422, detail="Malformed or unsupported MRI image") from exc
        except ModelNotConfiguredError as exc:
            raise HTTPException(status_code=503, detail="MRI segmentation model is not configured") from exc
        except IncompatibleCheckpointError as exc:
            raise HTTPException(status_code=503, detail="MRI segmentation checkpoint is incompatible") from exc
        except InferenceError as exc:
            raise HTTPException(status_code=422, detail="MRI segmentation inference failed") from exc

        area_percent = segmentation.positive_area_fraction * 100
        return ScanAnalysisResult(
            id=f"scan_{int(t0)}",
            scan_type="mri",
            status="completed",
            findings=[
                f"Model-produced segmentation region: {area_percent:.2f}% of the processed slice.",
                "Assistive output — requires radiologist sign-off (D2).",
            ],
            confidence=segmentation.max_probability,
            risk_level="review",
            recommendations=["Radiologist must review the source slice and segmentation mask."],
            processing_time_ms=int((time.time() - t0) * 1000),
            segmentation=segmentation.as_dict(),
        )

    engine = _get_engine()

    # Real ML inference when the engine is configured and we have a 3D volume.
    if engine is not None and is_nifti:
        t0 = time.time()
        try:
            from ml_engine.encoder.data import load_nifti
            suffix = ".nii.gz" if filename.endswith(".gz") else ".nii"
            with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
                tmp.write(await file.read())
                tmp.flush()
                vol = load_nifti(tmp.name, img_size=engine.encoder.cfg.img_size,
                                 in_channels=engine.encoder.cfg.in_channels)
            r = engine.triage_study(vol)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=422, detail=f"inference failed: {exc}")
        findings = [f"{name.replace('_', ' ')}: {p:.2f}" for name, p in r.per_finding.items()]
        if r.abstain:
            recs = ["Model abstained (uncertain) — route to radiologist for manual review."]
        elif r.severity >= 0.70:
            recs = [f"Critical finding flagged ({r.top_finding.replace('_', ' ')}) — prioritise review."]
        else:
            recs = ["No critical finding flagged — radiologist confirmation still required."]
        return ScanAnalysisResult(
            id=f"scan_{int(t0)}",
            scan_type=scan_type,
            status="completed",
            findings=findings + ["Assistive output — requires radiologist sign-off (D2)."],
            confidence=round(float(r.severity), 3),
            risk_level=_risk_level(r.severity, r.abstain),
            recommendations=recs,
            processing_time_ms=int((time.time() - t0) * 1000),
        )

    raise HTTPException(status_code=503, detail="MRI triage model is not configured")


@router.get("/history", response_model=List[ScanHistory])
async def get_scan_history(
    patient_id: Optional[str] = None,
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """Get history of all scans for current user"""
    require_patient_access_if_present(patient_id, current_user)
    # TODO: Implement with database
    return []


@router.get("/scan/{scan_id}", response_model=ScanAnalysisResult)
async def get_scan_result(scan_id: str):
    """Get specific scan result by ID"""
    # TODO: Implement with database
    raise HTTPException(status_code=404, detail="Scan not found")


@router.delete("/scan/{scan_id}")
async def delete_scan(scan_id: str):
    """Delete scan and its results"""
    # TODO: Implement with database
    return {"message": "Scan deleted"}


@router.get("/models")
async def get_available_models():
    """Get list of available ML models for analysis"""
    return {
        "models": [
            {
                "id": "brain_segmentation_v1",
                "name": "Brain Segmentation Model",
                "type": "segmentation",
                "accuracy": 0.94,
            },
            {
                "id": "alzheimer_detection_v1",
                "name": "Alzheimer Detection Model",
                "type": "classification",
                "accuracy": 0.91,
            },
            {
                "id": "tumor_detection_v1",
                "name": "Brain Tumor Detection",
                "type": "detection",
                "accuracy": 0.93,
            },
        ]
    }
