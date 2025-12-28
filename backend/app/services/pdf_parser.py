"""
PDF text extraction and normalization utilities.
"""

from io import BytesIO
import re
from typing import List, Dict, Any, Optional

import pdfplumber

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover - fallback may be unavailable in tests
    fitz = None  # type: ignore


def extract_tables_from_pdf(file_bytes: bytes) -> List[List[List[str]]]:
    """
    Extract tables from PDF for structured data parsing.
    Returns list of tables, where each table is a list of rows.
    """
    tables = []
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            total_pages = len(pdf.pages)
            print(f"[DEBUG] PDF has {total_pages} pages")
            
            for page_num, page in enumerate(pdf.pages, 1):
                print(f"[DEBUG] Processing page {page_num}/{total_pages}")
                page_tables = page.extract_tables() or []
                print(f"[DEBUG] Page {page_num}: found {len(page_tables)} tables")
                
                for table_idx, table in enumerate(page_tables):
                    if table:
                        # Clean up cells
                        cleaned_table = []
                        for row in table:
                            if row:
                                cleaned_row = [str(cell).strip() if cell else "" for cell in row]
                                if any(cleaned_row):  # Skip empty rows
                                    cleaned_table.append(cleaned_row)
                        if cleaned_table:
                            tables.append(cleaned_table)
                            print(f"[DEBUG] Page {page_num}, Table {table_idx+1}: {len(cleaned_table)} rows")
    except Exception as e:
        print(f"[DEBUG] Table extraction error: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"[DEBUG] Total tables extracted: {len(tables)}")
    return tables


def extract_lab_data_from_tables(tables: List[List[List[str]]]) -> List[Dict[str, Any]]:
    """
    Extract lab marker data from tables.
    Looks for rows with: marker_name, value, unit, reference_range
    """
    results = []
    
    for table in tables:
        for row in table:
            if len(row) < 2:
                continue
            
            # Try to identify columns
            marker_data = parse_lab_row(row)
            if marker_data:
                results.append(marker_data)
    
    return results


def parse_lab_row(row: List[str]) -> Optional[Dict[str, Any]]:
    """
    Parse a single row from lab table.
    Typical formats:
    - [marker, value, unit, reference]
    - [marker, value, reference]
    - [marker, value unit, reference]
    """
    if len(row) < 2:
        return None
    
    # First non-empty cell is likely the marker name
    marker_name = None
    value = None
    unit = None
    ref_min = None
    ref_max = None
    
    for i, cell in enumerate(row):
        cell = cell.strip()
        if not cell:
            continue
        
        # Try to extract numeric value
        num_match = re.search(r'^(\d+(?:[.,]\d+)?)\s*([a-zа-яёµ%\^\d\*\/\.\-]*)?$', cell, re.IGNORECASE)
        if num_match and value is None:
            value = float(num_match.group(1).replace(',', '.'))
            if num_match.group(2):
                unit = num_match.group(2).strip()
            continue
        
        # Try to extract reference range
        ref_match = re.search(r'(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)', cell)
        if ref_match:
            ref_min = float(ref_match.group(1).replace(',', '.'))
            ref_max = float(ref_match.group(2).replace(',', '.'))
            continue
        
        # Single-bound reference (< X or > X)
        single_ref = re.search(r'[<>≤≥]\s*(\d+(?:[.,]\d+)?)', cell)
        if single_ref:
            bound = float(single_ref.group(1).replace(',', '.'))
            if '<' in cell or '≤' in cell:
                ref_min = 0
                ref_max = bound
            else:
                ref_min = bound
                ref_max = bound * 10
            continue
        
        # If we haven't found a marker name yet, this might be it
        if marker_name is None and len(cell) > 1 and not cell.isdigit():
            marker_name = cell
    
    if marker_name and value is not None:
        return {
            "name": marker_name,
            "value": value,
            "unit": unit,
            "reference_min": ref_min,
            "reference_max": ref_max,
        }
    
    return None


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract text from PDF using pdfplumber with PyMuPDF as fallback.
    """
    text_parts: List[str] = []
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            total_pages = len(pdf.pages)
            print(f"[DEBUG] Text extraction: PDF has {total_pages} pages")
            
            for page_num, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text() or ""
                text_len = len(page_text)
                print(f"[DEBUG] Page {page_num}/{total_pages}: extracted {text_len} chars")
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        print(f"[DEBUG] pdfplumber error: {e}")
        import traceback
        traceback.print_exc()

    extracted = "\n".join(text_parts).strip()
    total_chars = len(extracted)
    print(f"[DEBUG] pdfplumber total: {total_chars} chars from {len(text_parts)} pages")
    
    if extracted or fitz is None:
        return extracted

    # Fallback to PyMuPDF
    print("[DEBUG] Trying PyMuPDF fallback...")
    fallback_parts: List[str] = []
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:  # type: ignore
            for page_num, page in enumerate(doc, 1):
                page_text = page.get_text("text") or ""
                print(f"[DEBUG] PyMuPDF page {page_num}: {len(page_text)} chars")
                if page_text:
                    fallback_parts.append(page_text)
    except Exception as e:
        print(f"[DEBUG] PyMuPDF error: {e}")
        return extracted

    fallback_text = "\n".join(fallback_parts).strip()
    print(f"[DEBUG] PyMuPDF total: {len(fallback_text)} chars")
    return fallback_text


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
