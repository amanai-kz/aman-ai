"""
Parser for Invivo (RU/KZ) blood analysis PDFs.
"""

from typing import Dict, List, Optional, Tuple
import re

ResultEntry = Dict[str, float | str | None]
ParsedResult = Dict[str, ResultEntry]

ALIASES: Dict[str, List[str]] = {
    "hemoglobin": ["hemoglobin", "гемоглобин"],
    "rbc": ["rbc", "эритроциты", "эритроциттер"],
    "wbc": ["wbc", "лейкоциты", "лейкоциттер"],
    "platelets": ["platelets", "plt", "тромбоциты", "тромбоциттер"],
    "glucose": ["glucose", "глюкоза"],
    "cholesterol": ["cholesterol", "холестерин"],
    "alt": ["alt", "алт"],
    "ast": ["ast", "аст"],
    "creatinine": ["creatinine", "креатинин"],
    "esr": ["esr", "соэ", "этж"],
}


def _empty_result() -> ParsedResult:
    return {
        key: {"value": None, "unit": None, "confidence": 0.0}
        for key in ALIASES.keys()
    }


def _parse_value_and_unit(line: str) -> Tuple[Optional[float], Optional[str]]:
    value_match = re.search(r"(\d+(?:[.,]\d+)?)", line)
    if not value_match:
        return None, None

    value_str = value_match.group(1).replace(",", ".")
    try:
        value = float(value_str)
    except ValueError:
        value = None

    unit_match = re.search(
        r"\d+(?:[.,]\d+)?\s*([a-zа-яёµ/%\^\d\*\/\.]+)",
        line,
        flags=re.IGNORECASE,
    )
    unit = unit_match.group(1).strip() if unit_match and unit_match.group(1) else None
    return value, unit


def _set_result(result: ParsedResult, key: str, value: Optional[float], unit: Optional[str], confidence: float) -> None:
    current = result[key]
    if value is None:
        return
    if current["confidence"] < confidence:
        result[key] = {"value": value, "unit": unit, "confidence": confidence}


def parse_invivo_blood(text: str) -> ParsedResult:
    """
    Parse Invivo blood analysis text (RU/KZ) into structured markers.
    """
    normalized_text = text or ""
    result = _empty_result()

    # ALT/AST combined pattern (e.g., "АЛТ/АСТ 23/18")
    alt_ast_pattern = re.compile(
        r"(?:алт|alt)\s*/\s*(?:аст|ast)[^\d]*(?P<alt>\d+(?:[.,]\d+)?)\s*/\s*(?P<ast>\d+(?:[.,]\d+)?)(?:\s*(?P<unit>[a-zа-яё/%\^\d\*\/\.]+))?",
        flags=re.IGNORECASE,
    )
    for match in alt_ast_pattern.finditer(normalized_text):
        unit = match.group("unit") or None
        alt_value = float(match.group("alt").replace(",", "."))
        ast_value = float(match.group("ast").replace(",", "."))
        _set_result(result, "alt", alt_value, unit, 1.0)
        _set_result(result, "ast", ast_value, unit, 1.0)

    lines = [line.strip() for line in normalized_text.splitlines() if line.strip()]
    alias_lower = {k: [alias.lower() for alias in v] for k, v in ALIASES.items()}

    # Line-based parsing (higher confidence)
    for line in lines:
        line_lower = line.lower()
        for key, aliases in alias_lower.items():
            if any(alias in line_lower for alias in aliases):
                value, unit = _parse_value_and_unit(line)
                _set_result(result, key, value, unit, 1.0)

    # Fallback search across whole text (lower confidence)
    for key, aliases in alias_lower.items():
        if result[key]["confidence"] > 0:
            continue
        alias_regex = "|".join(re.escape(a) for a in aliases)
        pattern = re.compile(
            rf"(?:{alias_regex})[^\d]*(\d+(?:[.,]\d+)?)(?:\s*([a-zа-яё/%\^\d\*\/\.]+))?",
            flags=re.IGNORECASE,
        )
        match = pattern.search(normalized_text)
        if not match:
            continue
        value = float(match.group(1).replace(",", "."))
        unit = match.group(2).strip() if match.group(2) else None
        _set_result(result, key, value, unit, 0.7)

    return result
