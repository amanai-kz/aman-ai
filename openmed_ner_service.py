"""
OpenMed Clinical NER Service for Blood Biomarker Extraction.
Replaces blood_nlp_extractor.py (regex-based) with OpenMed ML model.
SCRUM-OM-2
"""

import re
import time
import logging
from typing import Optional
from dataclasses import dataclass, asdict

import openmed

logger = logging.getLogger(__name__)

# Model selected in SCRUM-OM-1 research
OPENMED_MODEL = "OpenMed/OpenMed-PII-SuperClinical-Small-44M-v1"

# Reference ranges for status calculation
REFERENCE_RANGES = {
    "hemoglobin": (120, 160, "g/L"),
    "гемоглобин": (120, 160, "g/L"),
    "rbc": (3.8, 5.5, "10^12/L"),
    "wbc": (4.0, 10.0, "10^9/L"),
    "platelets": (150, 400, "10^9/L"),
    "glucose": (3.9, 6.1, "mmol/L"),
    "глюкоза": (3.9, 6.1, "mmol/L"),
    "cholesterol": (0, 5.2, "mmol/L"),
    "hdl": (1.0, 2.0, "mmol/L"),
    "ldl": (0, 3.0, "mmol/L"),
    "triglycerides": (0, 1.7, "mmol/L"),
    "alt": (0, 40, "U/L"),
    "ast": (0, 40, "U/L"),
    "creatinine": (53, 115, "μmol/L"),
    "urea": (2.5, 8.3, "mmol/L"),
    "tsh": (0.4, 4.0, "mIU/L"),
    "crp": (0, 5, "mg/L"),
}


@dataclass
class BiomarkerEntity:
    """Single extracted biomarker entity."""
    name: str
    value: Optional[float] = None
    unit: Optional[str] = None
    raw_text: str = ""
    confidence: float = 0.0
    status: Optional[str] = None


def _calculate_status(name: str, value: Optional[float]) -> Optional[str]:
    """Calculate normal/low/high status based on reference ranges."""
    if value is None:
        return None
    name_lower = name.lower()
    for key, (ref_min, ref_max, _) in REFERENCE_RANGES.items():
        if key in name_lower:
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
    return "unknown"


def _try_parse_float(text: str) -> Optional[float]:
    """Try to extract numeric value from text."""
    match = re.search(r"\d+(?:[.,]\d+)?", text)
    if match:
        try:
            return float(match.group().replace(",", "."))
        except ValueError:
            return None
    return None


def _extract_unit(text: str) -> Optional[str]:
    """Extract unit from text."""
    text_lower = text.lower()
    if "mmol" in text_lower or "ммоль" in text_lower:
        return "mmol/L"
    elif "g/l" in text_lower or "г/л" in text_lower:
        return "g/L"
    elif "u/l" in text_lower or "ед/л" in text_lower:
        return "U/L"
    elif "%" in text:
        return "%"
    elif "мг/л" in text_lower or "mg/l" in text_lower:
        return "mg/L"
    return None


# Regex patterns for direct extraction (fallback + complement to OpenMed)
BIOMARKER_PATTERNS = [
    (r"гемоглобин[^\d]*(\d+(?:[.,]\d+)?)\s*(г/л|g/l)?", "гемоглобин", "g/L"),
    (r"глюкоза[^\d]*(\d+(?:[.,]\d+)?)\s*(ммоль/л|mmol/l)?", "глюкоза", "mmol/L"),
    (r"\balt\b[^\d]*(\d+(?:[.,]\d+)?)\s*(u/l|ед/л)?", "alt", "U/L"),
    (r"\bast\b[^\d]*(\d+(?:[.,]\d+)?)\s*(u/l|ед/л)?", "ast", "U/L"),
    (r"холестерин[^\d]*(\d+(?:[.,]\d+)?)\s*(ммоль/л|mmol/l)?", "холестерин", "mmol/L"),
    (r"креатинин[^\d]*(\d+(?:[.,]\d+)?)\s*(мкмоль/л|μmol/l)?", "креатинин", "μmol/L"),
    (r"\bтsg\b|\bтТГ\b[^\d]*(\d+(?:[.,]\d+)?)", "tsh", "mIU/L"),
    (r"crp|срб[^\d]*(\d+(?:[.,]\d+)?)\s*(мг/л|mg/l)?", "crp", "mg/L"),
]


def extract_blood_biomarkers(text: str) -> list[BiomarkerEntity]:
    """
    Extract blood biomarker entities from text using OpenMed + regex fallback.

    Args:
        text: Raw text from blood analysis PDF

    Returns:
        List of BiomarkerEntity with name, value, unit, confidence, status
    """
    if not text or not text.strip():
        logger.warning("Empty text provided to extract_blood_biomarkers")
        return []

    biomarkers = []
    found_names = set()

    # Step 1: OpenMed NER for PII and medical entities
    try:
        t_start = time.time()
        result = openmed.extract_pii(text)
        latency = round(time.time() - t_start, 3)
        logger.info(f"OpenMed NER completed in {latency}s, found {len(result.entities)} entities")

        for entity in result.entities:
            raw = entity.text
            label = entity.label
            confidence = entity.confidence

            # Skip very short or common false positives
            if len(raw) < 3:
                continue

            value = _try_parse_float(raw)
            unit = _extract_unit(raw)

            biomarker = BiomarkerEntity(
                name=label,
                value=value,
                unit=unit,
                raw_text=raw,
                confidence=confidence,
                status=_calculate_status(raw, value),
            )
            biomarkers.append(biomarker)
            found_names.add(raw.lower()[:10])

    except Exception as e:
        logger.error(f"OpenMed extraction failed: {e}")

    # Step 2: Regex extraction for numeric biomarker values (complements OpenMed)
    for pattern, name, default_unit in BIOMARKER_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match and name not in found_names:
            raw_text = match.group(0)
            value_str = match.group(1) if match.lastindex and match.lastindex >= 1 else None
            value = float(value_str.replace(",", ".")) if value_str else None

            biomarker = BiomarkerEntity(
                name=name,
                value=value,
                unit=default_unit,
                raw_text=raw_text,
                confidence=0.85,
                status=_calculate_status(name, value),
            )
            biomarkers.append(biomarker)
            found_names.add(name)

    return biomarkers


def extract_blood_biomarkers_as_dict(text: str) -> dict:
    """
    Extract biomarkers and return as dict for API response.
    Drop-in replacement for blood_nlp_extractor.extract_blood_analysis().
    """
    biomarkers = extract_blood_biomarkers(text)

    entities = [asdict(b) for b in biomarkers]
    critical = [b for b in biomarkers if b.status and "critical" in b.status]
    warnings = [b for b in biomarkers if b.status in ("low", "high")]

    return {
        "markers": entities,
        "summary": {
            "total_found": len(biomarkers),
            "critical_count": len(critical),
            "warning_count": len(warnings),
        },
    }