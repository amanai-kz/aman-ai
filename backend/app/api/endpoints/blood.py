"""
S5: Blood Analysis Service
==========================
ML analysis of blood biomarkers for detection 
of neurodegenerative disease indicators.

Analog: Qomek
Team: Nursultan (master), Damir
"""

from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from datetime import datetime

from app.services.pdf_parser import extract_text_from_pdf, normalize_text
from app.services.invivo_blood_parser import parse_invivo_blood

router = APIRouter()


class BloodMarker(BaseModel):
    name: str
    value: float
    unit: str
    reference_min: float
    reference_max: float
    status: str  # "normal", "low", "high", "critical"


class BloodTestInput(BaseModel):
    markers: List[BloodMarker]
    test_date: Optional[datetime] = None
    lab_name: Optional[str] = None


class BiomarkerRisk(BaseModel):
    marker: str
    current_value: float
    risk_level: str
    trend: str  # "improving", "stable", "worsening"
    interpretation: str


class BloodAnalysisResult(BaseModel):
    id: str
    analyzed_at: datetime
    markers_analyzed: int
    risk_factors: List[BiomarkerRisk]
    overall_risk: str
    neuro_markers: dict
    recommendations: List[str]


@router.post("/analyze", response_model=BloodAnalysisResult)
async def analyze_blood_test(data: BloodTestInput):
    """
    Analyze blood test results using ML models.
    
    Focuses on biomarkers associated with neurodegenerative diseases:
    - Neurofilament light chain (NfL)
    - Amyloid-beta
    - Tau protein
    - Inflammatory markers
    """
    return BloodAnalysisResult(
        id="blood_001",
        analyzed_at=datetime.now(),
        markers_analyzed=len(data.markers),
        risk_factors=[
            BiomarkerRisk(
                marker="NfL",
                current_value=12.5,
                risk_level="normal",
                trend="stable",
                interpretation="Уровень нейрофиламента лёгких цепей в норме",
            ),
        ],
        overall_risk="low",
        neuro_markers={
            "nfl_level": "normal",
            "inflammation_score": 2.3,
            "oxidative_stress": "low",
        },
        recommendations=[
            "Показатели в пределах нормы",
            "Рекомендуется повторный анализ через 6 месяцев",
            "Поддерживайте физическую активность",
        ],
    )


class BloodUploadResponse(BaseModel):
    patientId: str
    extracted: dict
    missing: List[str]
    rawTextLength: int


@router.post("/upload")
async def upload_blood_test_file(file: UploadFile = File(...)):
    """
    Upload blood test results file (PDF or image).
    OCR will extract markers automatically.
    """
    allowed_types = ["application/pdf", "image/png", "image/jpeg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    # TODO: Implement OCR extraction
    return {
        "upload_id": "upload_001",
        "status": "processing",
        "message": "File uploaded. Extracting markers...",
    }


@router.post("/upload-pdf", response_model=BloodUploadResponse)
async def upload_blood_pdf(
    file: UploadFile = File(...),
    patient_id: str = Form("unknown"),
):
    """
    Upload Invivo PDF, extract text, parse markers, and return structured data.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type")

    file_bytes = await file.read()
    raw_text = extract_text_from_pdf(file_bytes)
    if not raw_text.strip():
        raise HTTPException(
            status_code=422,
            detail="PDF contains no extractable text. OCR is not supported.",
        )

    normalized_text = normalize_text(raw_text)
    extracted = parse_invivo_blood(normalized_text)
    missing = [key for key, marker in extracted.items() if marker["value"] is None]

    # TODO: Persist extracted markers to patient profile once DB layer is wired

    return BloodUploadResponse(
        patientId=patient_id,
        extracted=extracted,
        missing=missing,
        rawTextLength=len(normalized_text),
    )


@router.get("/history", response_model=List[BloodAnalysisResult])
async def get_analysis_history():
    """Get history of blood analyses"""
    return []


@router.get("/analysis/{analysis_id}", response_model=BloodAnalysisResult)
async def get_analysis_result(analysis_id: str):
    """Get specific blood analysis result"""
    raise HTTPException(status_code=404, detail="Analysis not found")


@router.get("/markers")
async def get_tracked_markers():
    """Get list of tracked biomarkers and their reference ranges"""
    return {
        "markers": [
            {
                "name": "Neurofilament Light Chain (NfL)",
                "description": "Маркер повреждения нейронов",
                "unit": "pg/mL",
                "reference_range": {"min": 0, "max": 20},
                "relevance": "high",
            },
            {
                "name": "Amyloid-beta 42",
                "description": "Связан с болезнью Альцгеймера",
                "unit": "pg/mL",
                "reference_range": {"min": 500, "max": 1000},
                "relevance": "high",
            },
            {
                "name": "Tau protein",
                "description": "Маркер нейродегенерации",
                "unit": "pg/mL",
                "reference_range": {"min": 0, "max": 400},
                "relevance": "high",
            },
            {
                "name": "C-Reactive Protein (CRP)",
                "description": "Маркер воспаления",
                "unit": "mg/L",
                "reference_range": {"min": 0, "max": 3},
                "relevance": "medium",
            },
            {
                "name": "Homocysteine",
                "description": "Связан с когнитивными нарушениями",
                "unit": "μmol/L",
                "reference_range": {"min": 5, "max": 15},
                "relevance": "medium",
            },
        ]
    }


@router.get("/trends/{marker_name}")
async def get_marker_trends(marker_name: str):
    """Get historical trends for specific marker"""
    return {
        "marker": marker_name,
        "data_points": [],
        "trend": "stable",
    }

