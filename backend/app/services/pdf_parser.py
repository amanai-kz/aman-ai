"""
PDF text extraction and normalization utilities.
"""

from io import BytesIO
import re
from typing import List

import pdfplumber

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover - fallback may be unavailable in tests
    fitz = None  # type: ignore


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract text from PDF using pdfplumber with PyMuPDF as fallback.
    """
    text_parts: List[str] = []
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                if page_text:
                    text_parts.append(page_text)
    except Exception:
        # Extraction errors should not break the fallback path
        pass

    extracted = "\n".join(text_parts).strip()
    if extracted or fitz is None:
        return extracted

    fallback_parts: List[str] = []
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:  # type: ignore
            for page in doc:
                page_text = page.get_text("text") or ""
                if page_text:
                    fallback_parts.append(page_text)
    except Exception:
        return extracted

    return "\n".join(fallback_parts).strip()


def normalize_text(text: str) -> str:
    """
    Normalize extracted text to simplify parsing.
    - remove carriage returns
    - merge hyphenated line breaks (a-\nb -> ab)
    - collapse excessive spaces
    - convert decimal comma to dot for digit patterns
    """
    if not text:
        return ""

    normalized = text.replace("\r", "")
    normalized = re.sub(r"(\w)-\n(\w)", r"\1\2", normalized)
    normalized = normalized.replace("\t", " ")
    normalized = re.sub(r"[ ]{2,}", " ", normalized)
    normalized = re.sub(r"(?P<int>\d+),(?P<dec>\d+)", r"\g<int>.\g<dec>", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()
    return normalized
