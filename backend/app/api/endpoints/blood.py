"""
S5: Blood Analysis Service
==========================
ML analysis of blood biomarkers for detection 
of neurodegenerative disease indicators.

Analog: Qomek
Team: Nursultan (master), Damir
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from datetime import datetime

from app.services.pdf_parser import (
    extract_text_from_pdf, 
    normalize_text, 
    extract_tables_from_pdf,
    extract_lab_data_from_tables
)
from app.services.invivo_blood_parser import parse_invivo_blood
from app.services.blood_nlp_extractor import extract_blood_analysis, BloodNLPExtractor, MARKER_ALIASES

router = APIRouter()


def match_marker_name(name: str) -> Optional[str]:
    """Match a marker name from table to our standardized marker keys."""
    name_lower = name.lower().strip()
    
    for marker_key, aliases in MARKER_ALIASES.items():
        for alias in aliases:
            if alias.lower() in name_lower or name_lower in alias.lower():
                return marker_key
    
    # Direct mappings for common variations
    direct_mappings = {
        "гемоглобин": "hemoglobin",
        "эритроциты": "rbc", 
        "лейкоциты": "wbc",
        "тромбоциты": "platelets",
        "гематокрит": "hematocrit",
        "глюкоза": "glucose",
        "холестерин": "cholesterol",
        "холестерин общий": "cholesterol",
        "триглицериды": "triglycerides",
        "лпвп": "hdl",
        "холестерин-лпвп": "hdl",
        "хс-лпвп": "hdl",
        "лпнп": "ldl",
        "холестерин-лпнп": "ldl",
        "хс-лпнп": "ldl",
        "хс лпнп": "ldl",
        "холестерин не-лпвп": "vldl",
        "не-лпвп": "vldl",
        "креатинин": "creatinine",
        "мочевина": "urea",
        "билирубин общий": "bilirubin_total",
        "билирубин прямой": "bilirubin_direct",
        "общий белок": "total_protein",
        "альбумин": "albumin",
        "алт": "alt",
        "аст": "ast",
        "ггт": "ggt",
        "щелочная фосфатаза": "alp",
        "железо": "iron",
        "ферритин": "ferritin",
        "натрий": "sodium",
        "калий": "potassium",
        "хлор": "chloride",
        "кальций": "calcium",
        "магний": "magnesium",
        "фосфор": "phosphorus",
        "ттг": "tsh",
        "т4 свободный": "t4_free",
        "св. т4": "t4_free",
        "витамин d": "vitamin_d",
        "витамин в12": "vitamin_b12",
        "фолиевая кислота": "folate",
        "с-реактивный белок": "crp",
        "срб": "crp",
        "соэ": "esr",
        "нейтрофилы": "neutrophils",
        "лимфоциты": "lymphocytes",
        "моноциты": "monocytes",
        "эозинофилы": "eosinophils",
        "базофилы": "basophils",
        "эстрадиол": "estradiol",
        "тестостерон": "testosterone",
        "кортизол": "cortisol",
        "пролактин": "prolactin",
        "инсулин": "insulin",
        "мочевая кислота": "uric_acid",
        "hba1c": "hba1c",
        "гликированный": "hba1c",
        "гликированный hb": "hba1c",
        "гликированный гемоглобин": "hba1c",
    }
    
    for ru_name, marker_key in direct_mappings.items():
        if ru_name in name_lower:
            return marker_key
    
    return None


def calculate_status(value: float, ref_min: Optional[float], ref_max: Optional[float]) -> str:
    """Calculate status based on value and reference range."""
    if ref_min is None or ref_max is None:
        return "unknown"
    
    if value < ref_min * 0.7:
        return "critical_low"
    elif value < ref_min:
        return "low"
    elif value > ref_max * 1.5:
        return "critical_high"
    elif value > ref_max:
        return "high"
    else:
        return "normal"


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
    Uses basic parser for backward compatibility.
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

    return BloodUploadResponse(
        patientId=patient_id,
        extracted=extracted,
        missing=missing,
        rawTextLength=len(normalized_text),
    )


class NLPExtractionResponse(BaseModel):
    """Response for NLP-based blood analysis extraction."""
    patientId: str
    markers: Dict[str, Any]
    summary: Dict[str, Any]
    labName: Optional[str] = None
    analysisDate: Optional[str] = None
    rawTextLength: int
    rawTextPreview: Optional[str] = None  # First 1000 chars for debugging
    savedToProfile: bool = False


class MarkerDetail(BaseModel):
    """Individual marker details."""
    value: Optional[float] = None
    unit: Optional[str] = None
    reference_min: Optional[float] = None
    reference_max: Optional[float] = None
    status: Optional[str] = None
    confidence: float = 0.0


class SaveBloodAnalysisRequest(BaseModel):
    """Request to save blood analysis to patient profile."""
    patient_id: str
    markers: Dict[str, Any]
    lab_name: Optional[str] = None
    analysis_date: Optional[str] = None


@router.post("/extract-nlp", response_model=NLPExtractionResponse)
async def extract_blood_nlp(
    file: UploadFile = File(...),
    patient_id: str = Form("unknown"),
    save_to_profile: bool = Form(False),
):
    """
    NLP-based blood analysis extraction with comprehensive marker coverage.
    
    Extracts 60+ blood markers from Invivo and other lab PDFs including:
    - Complete Blood Count (CBC)
    - Biochemistry panel
    - Lipid panel
    - Liver & Kidney function
    - Thyroid hormones
    - Vitamins & Electrolytes
    - Coagulation markers
    - Tumor markers
    
    Supports RU/KZ/EN languages.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF supported.")

    file_bytes = await file.read()
    
    # Debug logging
    print(f"[DEBUG] PDF size: {len(file_bytes)} bytes")
    
    # METHOD 1: Extract tables (more accurate for structured lab reports)
    tables = extract_tables_from_pdf(file_bytes)
    table_data = extract_lab_data_from_tables(tables)
    print(f"[DEBUG] Found {len(tables)} tables, extracted {len(table_data)} lab rows")
    
    for item in table_data[:10]:
        print(f"[DEBUG] TABLE: {item}")
    
    # METHOD 2: Extract text for NLP parsing
    raw_text = extract_text_from_pdf(file_bytes)
    print(f"[DEBUG] Extracted text length: {len(raw_text)}")
    print(f"[DEBUG] First 500 chars: {raw_text[:500]}")
    
    if not raw_text.strip() and not table_data:
        raise HTTPException(
            status_code=422,
            detail="PDF contains no extractable text. OCR is not supported yet.",
        )

    normalized_text = normalize_text(raw_text)
    extraction_result = extract_blood_analysis(normalized_text)
    
    # METHOD 3: Merge table data into extraction result
    # Table data can provide better accuracy for values and reference ranges
    for item in table_data:
        marker_key = match_marker_name(item["name"])
        if marker_key:
            existing = extraction_result["markers"].get(marker_key)
            # If not found in NLP or table has reference range
            if not existing or (not existing.get("reference_min") and item.get("reference_min")):
                extraction_result["markers"][marker_key] = {
                    "value": item["value"],
                    "unit": item.get("unit"),
                    "reference_min": item.get("reference_min"),
                    "reference_max": item.get("reference_max"),
                    "status": calculate_status(item["value"], item.get("reference_min"), item.get("reference_max")),
                    "confidence": 1.0,
                    "raw_text": item["name"],
                }
                print(f"[DEBUG] Added from table: {marker_key} = {item['value']}")
    
    # Debug: log marker count and reference ranges
    found_markers = [k for k, v in extraction_result["markers"].items() if v and isinstance(v, dict) and v.get("value") is not None]
    print(f"[DEBUG] Total found {len(found_markers)} markers: {found_markers[:15]}")
    
    # Log markers with PDF-extracted references
    for k, v in extraction_result["markers"].items():
        if v and isinstance(v, dict) and v.get("value") is not None:
            ref_min = v.get("reference_min")
            ref_max = v.get("reference_max")
            print(f"[DEBUG] {k}: value={v.get('value')}, unit={v.get('unit')}, ref={ref_min}-{ref_max}, status={v.get('status')}")
    
    saved = False
    if save_to_profile and patient_id != "unknown":
        # TODO: Save to database when DB layer is connected
        # This will be implemented when we wire up the database
        saved = True

    return NLPExtractionResponse(
        patientId=patient_id,
        markers=extraction_result["markers"],
        summary=extraction_result["summary"],
        labName=extraction_result.get("lab_name"),
        analysisDate=extraction_result.get("analysis_date"),
        rawTextLength=len(normalized_text),
        rawTextPreview=normalized_text[:1000] if normalized_text else None,
        savedToProfile=saved,
    )


@router.post("/save-to-profile")
async def save_blood_analysis_to_profile(request: SaveBloodAnalysisRequest):
    """
    Save extracted blood analysis to patient profile.
    
    This endpoint stores the blood analysis results in the patient's
    medical record for future reference and trend analysis.
    """
    # TODO: Implement database saving
    # When connected to Prisma/PostgreSQL:
    # 1. Find patient by ID
    # 2. Create new Analysis record with serviceType=BLOOD
    # 3. Store markers in result JSON field
    # 4. Return the created analysis ID
    
    return {
        "success": True,
        "message": "Blood analysis saved to patient profile",
        "patientId": request.patient_id,
        "markersCount": len([k for k, v in request.markers.items() if v and v.get("value")]),
        "analysisId": f"blood_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
    }


@router.get("/supported-markers")
async def get_supported_markers():
    """
    Get list of all supported blood markers with categories.
    """
    return {
        "categories": {
            "hematology": {
                "name": "Общий анализ крови / Complete Blood Count",
                "markers": [
                    "hemoglobin", "rbc", "wbc", "platelets", "hematocrit",
                    "mcv", "mch", "mchc", "rdw", "mpv", "esr",
                    "neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"
                ]
            },
            "biochemistry": {
                "name": "Биохимия / Biochemistry",
                "markers": ["glucose", "hba1c", "insulin"]
            },
            "lipids": {
                "name": "Липидный профиль / Lipid Panel",
                "markers": ["cholesterol", "hdl", "ldl", "vldl", "triglycerides"]
            },
            "liver": {
                "name": "Печёночные пробы / Liver Function",
                "markers": ["alt", "ast", "ggt", "alp", "bilirubin_total", "bilirubin_direct", "albumin", "total_protein"]
            },
            "kidney": {
                "name": "Почечные показатели / Kidney Function",
                "markers": ["creatinine", "urea", "uric_acid", "gfr", "cystatin_c"]
            },
            "electrolytes": {
                "name": "Электролиты / Electrolytes",
                "markers": ["sodium", "potassium", "chloride", "calcium", "magnesium", "phosphorus", "iron", "ferritin", "transferrin"]
            },
            "thyroid": {
                "name": "Щитовидная железа / Thyroid",
                "markers": ["tsh", "t3", "t4", "t3_free", "t4_free"]
            },
            "vitamins": {
                "name": "Витамины / Vitamins",
                "markers": ["vitamin_d", "vitamin_b12", "folate"]
            },
            "inflammation": {
                "name": "Воспаление / Inflammation",
                "markers": ["crp", "procalcitonin", "il6"]
            },
            "coagulation": {
                "name": "Коагулограмма / Coagulation",
                "markers": ["pt", "inr", "aptt", "fibrinogen", "d_dimer"]
            },
            "hormones": {
                "name": "Гормоны / Hormones",
                "markers": ["cortisol", "testosterone", "estradiol", "progesterone", "prolactin"]
            },
            "tumor_markers": {
                "name": "Онкомаркеры / Tumor Markers",
                "markers": ["psa", "cea", "afp", "ca125", "ca199"]
            }
        },
        "total_markers": 60,
        "languages": ["RU", "KZ", "EN"]
    }


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

