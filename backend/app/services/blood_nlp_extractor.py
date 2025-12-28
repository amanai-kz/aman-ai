"""
NLP-based Blood Analysis Extractor for Invivo and other lab PDFs.
Supports RU/KZ/EN languages with comprehensive marker coverage.
"""

import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum


class MarkerCategory(str, Enum):
    HEMATOLOGY = "hematology"
    BIOCHEMISTRY = "biochemistry"
    LIPIDS = "lipids"
    LIVER = "liver"
    KIDNEY = "kidney"
    THYROID = "thyroid"
    VITAMINS = "vitamins"
    INFLAMMATION = "inflammation"
    COAGULATION = "coagulation"
    ELECTROLYTES = "electrolytes"
    HORMONES = "hormones"


@dataclass
class MarkerResult:
    value: Optional[float] = None
    unit: Optional[str] = None
    reference_min: Optional[float] = None
    reference_max: Optional[float] = None
    status: Optional[str] = None  # normal, low, high, critical
    confidence: float = 0.0
    raw_text: Optional[str] = None


@dataclass
class BloodAnalysisExtraction:
    # === HEMATOLOGY (Complete Blood Count) ===
    hemoglobin: Optional[MarkerResult] = None          # Гемоглобин
    rbc: Optional[MarkerResult] = None                 # Эритроциты
    wbc: Optional[MarkerResult] = None                 # Лейкоциты
    platelets: Optional[MarkerResult] = None           # Тромбоциты
    hematocrit: Optional[MarkerResult] = None          # Гематокрит
    mcv: Optional[MarkerResult] = None                 # Средний объем эритроцита
    mch: Optional[MarkerResult] = None                 # Среднее содержание гемоглобина
    mchc: Optional[MarkerResult] = None                # Средняя концентрация гемоглобина
    rdw: Optional[MarkerResult] = None                 # Ширина распределения эритроцитов
    mpv: Optional[MarkerResult] = None                 # Средний объем тромбоцита
    esr: Optional[MarkerResult] = None                 # СОЭ
    
    # WBC Differential
    neutrophils: Optional[MarkerResult] = None         # Нейтрофилы
    lymphocytes: Optional[MarkerResult] = None         # Лимфоциты
    monocytes: Optional[MarkerResult] = None           # Моноциты
    eosinophils: Optional[MarkerResult] = None         # Эозинофилы
    basophils: Optional[MarkerResult] = None           # Базофилы
    
    # === BIOCHEMISTRY ===
    glucose: Optional[MarkerResult] = None             # Глюкоза
    hba1c: Optional[MarkerResult] = None               # Гликированный гемоглобин
    insulin: Optional[MarkerResult] = None             # Инсулин
    
    # === LIPID PANEL ===
    cholesterol: Optional[MarkerResult] = None         # Общий холестерин
    hdl: Optional[MarkerResult] = None                 # ЛПВП
    ldl: Optional[MarkerResult] = None                 # ЛПНП
    vldl: Optional[MarkerResult] = None                # ЛПОНП
    triglycerides: Optional[MarkerResult] = None       # Триглицериды
    
    # === LIVER FUNCTION ===
    alt: Optional[MarkerResult] = None                 # АЛТ
    ast: Optional[MarkerResult] = None                 # АСТ
    ggt: Optional[MarkerResult] = None                 # ГГТ
    alp: Optional[MarkerResult] = None                 # Щелочная фосфатаза
    bilirubin_total: Optional[MarkerResult] = None     # Общий билирубин
    bilirubin_direct: Optional[MarkerResult] = None    # Прямой билирубин
    albumin: Optional[MarkerResult] = None             # Альбумин
    total_protein: Optional[MarkerResult] = None       # Общий белок
    
    # === KIDNEY FUNCTION ===
    creatinine: Optional[MarkerResult] = None          # Креатинин
    urea: Optional[MarkerResult] = None                # Мочевина
    uric_acid: Optional[MarkerResult] = None           # Мочевая кислота
    gfr: Optional[MarkerResult] = None                 # СКФ
    cystatin_c: Optional[MarkerResult] = None          # Цистатин С
    
    # === ELECTROLYTES ===
    sodium: Optional[MarkerResult] = None              # Натрий
    potassium: Optional[MarkerResult] = None           # Калий
    chloride: Optional[MarkerResult] = None            # Хлор
    calcium: Optional[MarkerResult] = None             # Кальций
    magnesium: Optional[MarkerResult] = None           # Магний
    phosphorus: Optional[MarkerResult] = None          # Фосфор
    iron: Optional[MarkerResult] = None                # Железо
    ferritin: Optional[MarkerResult] = None            # Ферритин
    transferrin: Optional[MarkerResult] = None         # Трансферрин
    
    # === THYROID ===
    tsh: Optional[MarkerResult] = None                 # ТТГ
    t3: Optional[MarkerResult] = None                  # Т3
    t4: Optional[MarkerResult] = None                  # Т4
    t3_free: Optional[MarkerResult] = None             # Свободный Т3
    t4_free: Optional[MarkerResult] = None             # Свободный Т4
    
    # === VITAMINS ===
    vitamin_d: Optional[MarkerResult] = None           # Витамин D
    vitamin_b12: Optional[MarkerResult] = None         # Витамин B12
    folate: Optional[MarkerResult] = None              # Фолиевая кислота
    
    # === INFLAMMATION ===
    crp: Optional[MarkerResult] = None                 # С-реактивный белок
    procalcitonin: Optional[MarkerResult] = None       # Прокальцитонин
    il6: Optional[MarkerResult] = None                 # Интерлейкин-6
    
    # === COAGULATION ===
    pt: Optional[MarkerResult] = None                  # Протромбиновое время
    inr: Optional[MarkerResult] = None                 # МНО
    aptt: Optional[MarkerResult] = None                # АЧТВ
    fibrinogen: Optional[MarkerResult] = None          # Фибриноген
    d_dimer: Optional[MarkerResult] = None             # D-димер
    
    # === HORMONES ===
    cortisol: Optional[MarkerResult] = None            # Кортизол
    testosterone: Optional[MarkerResult] = None        # Тестостерон
    estradiol: Optional[MarkerResult] = None           # Эстрадиол
    progesterone: Optional[MarkerResult] = None        # Прогестерон
    prolactin: Optional[MarkerResult] = None           # Пролактин
    
    # === TUMOR MARKERS ===
    psa: Optional[MarkerResult] = None                 # ПСА
    cea: Optional[MarkerResult] = None                 # РЭА
    afp: Optional[MarkerResult] = None                 # АФП
    ca125: Optional[MarkerResult] = None               # СА-125
    ca199: Optional[MarkerResult] = None               # СА 19-9
    
    # Metadata
    lab_name: Optional[str] = None
    analysis_date: Optional[str] = None
    patient_name: Optional[str] = None


# Comprehensive aliases for all markers (RU/KZ/EN)
MARKER_ALIASES: Dict[str, List[str]] = {
    # Hematology
    "hemoglobin": ["hemoglobin", "hgb", "hb", "гемоглобин", "гемоглобин"],
    "rbc": ["rbc", "erythrocytes", "red blood cells", "эритроциты", "эритроциттер", "эр."],
    "wbc": ["wbc", "leukocytes", "white blood cells", "лейкоциты", "лейкоциттер", "лейк."],
    "platelets": ["platelets", "plt", "thrombocytes", "тромбоциты", "тромбоциттер"],
    "hematocrit": ["hematocrit", "hct", "ht", "гематокрит"],
    "mcv": ["mcv", "mean cell volume", "средний объем эритроцита", "ср. объем эритр."],
    "mch": ["mch", "mean cell hemoglobin", "ср. содерж. гемоглобина", "ср. сод. hb"],
    "mchc": ["mchc", "ср. конц. гемоглобина"],
    "rdw": ["rdw", "rdw-cv", "rdw-sd", "ширина распределения"],
    "mpv": ["mpv", "mean platelet volume", "средний объем тромбоцита"],
    "esr": ["esr", "sed rate", "соэ", "этж", "скорость оседания"],
    
    # WBC Differential
    "neutrophils": ["neutrophils", "neut", "neu", "нейтрофилы", "нейтрофил"],
    "lymphocytes": ["lymphocytes", "lymph", "lym", "лимфоциты", "лимфоцит"],
    "monocytes": ["monocytes", "mono", "моноциты", "моноцит"],
    "eosinophils": ["eosinophils", "eos", "эозинофилы", "эозинофил"],
    "basophils": ["basophils", "baso", "базофилы", "базофил"],
    
    # Biochemistry
    "glucose": ["glucose", "glu", "глюкоза", "глюк.", "сахар крови", "қан қанты"],
    "hba1c": ["hba1c", "a1c", "гликированный гемоглобин", "гликогемоглобин", "гликированный hb", "гликированный", "hba1c (гликированный"],
    "insulin": ["insulin", "инсулин"],
    
    # Lipids
    "cholesterol": ["cholesterol", "chol", "холестерин", "общий холестерин", "холестерол"],
    "hdl": ["hdl", "hdl-c", "hdl cholesterol", "лпвп", "лпвп-холестерин", "хс-лпвп", "холестерин-лпвп"],
    "ldl": ["ldl", "ldl-c", "ldl cholesterol", "лпнп", "лпнп-холестерин", "хс-лпнп", "холестерин-лпнп", "хс лпнп"],
    "vldl": ["vldl", "лпонп", "холестерин не-лпвп", "не-лпвп"],
    "triglycerides": ["triglycerides", "tg", "триглицериды", "триг."],
    
    # Liver
    "alt": ["alt", "sgpt", "alanine aminotransferase", "алт", "аланинаминотрансфераза"],
    "ast": ["ast", "sgot", "aspartate aminotransferase", "аст", "аспартатаминотрансфераза"],
    "ggt": ["ggt", "gamma-gt", "ггт", "гамма-глутамилтрансфераза"],
    "alp": ["alp", "alkaline phosphatase", "щелочная фосфатаза", "щф"],
    "bilirubin_total": ["total bilirubin", "tbil", "билирубин общий", "общий билирубин"],
    "bilirubin_direct": ["direct bilirubin", "dbil", "билирубин прямой", "прямой билирубин"],
    "albumin": ["albumin", "alb", "альбумин"],
    "total_protein": ["total protein", "tp", "общий белок", "белок общий"],
    
    # Kidney
    "creatinine": ["creatinine", "crea", "cr", "креатинин"],
    "urea": ["urea", "bun", "мочевина"],
    "uric_acid": ["uric acid", "ua", "мочевая кислота"],
    "gfr": ["gfr", "egfr", "скф", "скорость клубочковой фильтрации"],
    "cystatin_c": ["cystatin c", "cystatin", "цистатин с", "цистатин"],
    
    # Electrolytes
    "sodium": ["sodium", "na", "натрий"],
    "potassium": ["potassium", "k", "калий"],
    "chloride": ["chloride", "cl", "хлор", "хлориды", "хлор na"],
    "calcium": ["calcium", "ca", "кальций"],
    "magnesium": ["magnesium", "mg", "магний"],
    "phosphorus": ["phosphorus", "phos", "p", "фосфор"],
    "iron": ["iron", "fe", "железо", "сывороточное железо"],
    "ferritin": ["ferritin", "ферритин"],
    "transferrin": ["transferrin", "трансферрин"],
    
    # Thyroid
    "tsh": ["tsh", "thyroid stimulating hormone", "ттг", "тиреотропный гормон"],
    "t3": ["t3", "triiodothyronine", "т3", "трийодтиронин"],
    "t4": ["t4", "thyroxine", "т4", "тироксин"],
    "t3_free": ["free t3", "ft3", "св. т3", "свободный т3"],
    "t4_free": ["free t4", "ft4", "св. т4", "свободный т4"],
    
    # Vitamins
    "vitamin_d": ["vitamin d", "vit d", "25-oh vitamin d", "витамин d", "витамин д", "25-он витамин д"],
    "vitamin_b12": ["vitamin b12", "b12", "cobalamin", "витамин в12", "в12", "кобаламин"],
    "folate": ["folate", "folic acid", "фолиевая кислота", "фолат"],
    
    # Inflammation
    "crp": ["crp", "c-reactive protein", "срб", "с-реактивный белок", "с-реактивный протеин"],
    "procalcitonin": ["procalcitonin", "pct", "прокальцитонин"],
    "il6": ["il-6", "il6", "interleukin-6", "интерлейкин-6", "ил-6"],
    
    # Coagulation
    "pt": ["pt", "prothrombin time", "протромбиновое время", "птв"],
    "inr": ["inr", "мно", "международное нормализованное отношение"],
    "aptt": ["aptt", "ptt", "ачтв", "активированное частичное тромбопластиновое время"],
    "fibrinogen": ["fibrinogen", "фибриноген"],
    "d_dimer": ["d-dimer", "d dimer", "д-димер", "d-димер"],
    
    # Hormones
    "cortisol": ["cortisol", "кортизол"],
    "testosterone": ["testosterone", "тестостерон"],
    "estradiol": ["estradiol", "e2", "эстрадиол"],
    "progesterone": ["progesterone", "прогестерон"],
    "prolactin": ["prolactin", "пролактин"],
    
    # Tumor markers
    "psa": ["psa", "prostate specific antigen", "пса", "простатический специфический антиген"],
    "cea": ["cea", "carcinoembryonic antigen", "рэа", "раково-эмбриональный антиген"],
    "afp": ["afp", "alpha-fetoprotein", "афп", "альфа-фетопротеин"],
    "ca125": ["ca-125", "ca125", "ca 125", "са-125", "са125"],
    "ca199": ["ca-19-9", "ca19-9", "ca199", "ca 19-9", "са-19-9", "са19-9"],
}

# Reference ranges (approximate, may vary by lab)
REFERENCE_RANGES: Dict[str, Tuple[float, float, str]] = {
    "hemoglobin": (120, 160, "g/L"),
    "rbc": (3.8, 5.5, "10^12/L"),
    "wbc": (4.0, 10.0, "10^9/L"),
    "platelets": (150, 400, "10^9/L"),
    "hematocrit": (36, 48, "%"),
    "mcv": (80, 100, "fL"),
    "mch": (27, 33, "pg"),
    "mchc": (320, 360, "g/L"),
    "esr": (0, 20, "mm/h"),
    "glucose": (3.9, 6.1, "mmol/L"),
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


class BloodNLPExtractor:
    """NLP-based blood analysis extractor with pattern matching."""
    
    def __init__(self):
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for efficient matching."""
        self.alias_patterns: Dict[str, re.Pattern] = {}
        
        for marker, aliases in MARKER_ALIASES.items():
            # Create pattern that matches any alias followed by value
            alias_pattern = "|".join(re.escape(a) for a in aliases)
            # Pattern: alias followed by optional colon/space, then number
            pattern = re.compile(
                rf"(?P<alias>{alias_pattern})\s*[:\-]?\s*(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>[a-zа-яёµ%\^\d\*\/\.\-]+)?",
                flags=re.IGNORECASE
            )
            self.alias_patterns[marker] = pattern
        
        # Combined ALT/AST pattern
        self.alt_ast_pattern = re.compile(
            r"(?:алт|alt)\s*/\s*(?:аст|ast)[^\d]*(?P<alt>\d+(?:[.,]\d+)?)\s*/\s*(?P<ast>\d+(?:[.,]\d+)?)",
            flags=re.IGNORECASE
        )
        
        # Reference range patterns - multiple formats
        # Pattern 1: "норма: 3.9-6.1" or "ref: 3.9 - 6.1"
        self.ref_range_pattern_labeled = re.compile(
            r"(?:норма|ref|reference|референс|нормасы)[:\s]*(?P<min>\d+(?:[.,]\d+)?)\s*[-–—]\s*(?P<max>\d+(?:[.,]\d+)?)",
            flags=re.IGNORECASE
        )
        
        # Pattern 2: Just a range at end of line "3.9 - 6.1" or "(3.9-6.1)"
        self.ref_range_pattern_simple = re.compile(
            r"(?:\()?(?P<min>\d+(?:[.,]\d+)?)\s*[-–—]\s*(?P<max>\d+(?:[.,]\d+)?)(?:\))?(?:\s*(?:ммоль|мкмоль|г|мг|ед|u|g|mg|mmol)?(?:/л|/l)?)?$",
            flags=re.IGNORECASE
        )
        
        # Pattern 3: "< 5.0" or "> 2.0" for single-bound references  
        self.ref_range_pattern_single = re.compile(
            r"(?P<op>[<>≤≥])\s*(?P<val>\d+(?:[.,]\d+)?)",
            flags=re.IGNORECASE
        )
        
        # Combined pattern for inline search
        self.ref_range_pattern = re.compile(
            r"(?:(?:норма|ref|reference|референс|нормасы)[:\s]*)?(?P<min>\d+(?:[.,]\d+)?)\s*[-–—]\s*(?P<max>\d+(?:[.,]\d+)?)",
            flags=re.IGNORECASE
        )
        
        # Lab name patterns
        self.lab_patterns = [
            re.compile(r"invivo", flags=re.IGNORECASE),
            re.compile(r"олимп", flags=re.IGNORECASE),
            re.compile(r"synlab", flags=re.IGNORECASE),
            re.compile(r"kdl", flags=re.IGNORECASE),
            re.compile(r"медицинская лаборатория", flags=re.IGNORECASE),
        ]
        
        # Date pattern
        self.date_pattern = re.compile(
            r"(?:дата|date)[:\s]*(?P<date>\d{1,2}[./]\d{1,2}[./]\d{2,4})",
            flags=re.IGNORECASE
        )
    
    def extract(self, text: str) -> BloodAnalysisExtraction:
        """
        Extract all blood markers from text using NLP patterns.
        
        Args:
            text: Normalized text from PDF
            
        Returns:
            BloodAnalysisExtraction with all found markers
        """
        if not text:
            return BloodAnalysisExtraction()
        
        result = BloodAnalysisExtraction()
        text_lower = text.lower()
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        
        # Extract metadata
        result.lab_name = self._extract_lab_name(text)
        result.analysis_date = self._extract_date(text)
        
        # Handle combined ALT/AST pattern first
        for match in self.alt_ast_pattern.finditer(text):
            alt_value = self._parse_float(match.group("alt"))
            ast_value = self._parse_float(match.group("ast"))
            
            if alt_value is not None:
                result.alt = MarkerResult(
                    value=alt_value,
                    unit="U/L",
                    confidence=1.0,
                    raw_text=match.group(0)
                )
                self._add_reference_and_status(result.alt, "alt")
            
            if ast_value is not None:
                result.ast = MarkerResult(
                    value=ast_value,
                    unit="U/L",
                    confidence=1.0,
                    raw_text=match.group(0)
                )
                self._add_reference_and_status(result.ast, "ast")
        
        # Line-by-line extraction (higher confidence)
        for line in lines:
            line_lower = line.lower()
            
            for marker, pattern in self.alias_patterns.items():
                # Skip if already found with high confidence
                existing = getattr(result, marker, None)
                if existing and existing.confidence >= 1.0:
                    continue
                
                match = pattern.search(line)
                if match:
                    value = self._parse_float(match.group("value"))
                    unit = match.group("unit") if match.lastgroup == "unit" else None
                    
                    if value is not None:
                        marker_result = MarkerResult(
                            value=value,
                            unit=self._normalize_unit(unit),
                            confidence=1.0,
                            raw_text=line
                        )
                        
                        # FIRST: Extract reference range from same line (after the value)
                        value_end_pos = match.end()
                        line_after_value = line[value_end_pos:]
                        
                        # Try labeled pattern first (норма: X-Y)
                        ref_match = self.ref_range_pattern_labeled.search(line_after_value)
                        if ref_match:
                            marker_result.reference_min = self._parse_float(ref_match.group("min"))
                            marker_result.reference_max = self._parse_float(ref_match.group("max"))
                        else:
                            # Try simple range pattern (X - Y at end)
                            ref_match = self.ref_range_pattern_simple.search(line_after_value)
                            if ref_match:
                                ref_min = self._parse_float(ref_match.group("min"))
                                ref_max = self._parse_float(ref_match.group("max"))
                                # Sanity check: reference range should be plausible
                                if ref_min is not None and ref_max is not None and ref_min < ref_max:
                                    marker_result.reference_min = ref_min
                                    marker_result.reference_max = ref_max
                            else:
                                # Try single bound (< X or > X)
                                single_match = self.ref_range_pattern_single.search(line_after_value)
                                if single_match:
                                    op = single_match.group("op")
                                    val = self._parse_float(single_match.group("val"))
                                    if val is not None:
                                        if op in "<≤":
                                            marker_result.reference_min = 0
                                            marker_result.reference_max = val
                                        elif op in ">≥":
                                            marker_result.reference_min = val
                                            marker_result.reference_max = val * 10  # Rough upper bound
                        
                        # THEN: Add defaults if not found in PDF, and calculate status
                        self._add_reference_and_status(marker_result, marker)
                        
                        setattr(result, marker, marker_result)
        
        # Fallback: search entire text (lower confidence)
        for marker, pattern in self.alias_patterns.items():
            existing = getattr(result, marker, None)
            if existing and existing.confidence > 0:
                continue
            
            match = pattern.search(text)
            if match:
                value = self._parse_float(match.group("value"))
                unit = match.group("unit") if match.lastgroup == "unit" else None
                
                if value is not None:
                    marker_result = MarkerResult(
                        value=value,
                        unit=self._normalize_unit(unit),
                        confidence=0.7,
                        raw_text=match.group(0)
                    )
                    self._add_reference_and_status(marker_result, marker)
                    setattr(result, marker, marker_result)
        
        return result
    
    def _parse_float(self, value_str: Optional[str]) -> Optional[float]:
        """Parse float from string, handling comma as decimal separator."""
        if not value_str:
            return None
        try:
            return float(value_str.replace(",", "."))
        except (ValueError, AttributeError):
            return None
    
    def _normalize_unit(self, unit: Optional[str]) -> Optional[str]:
        """Normalize unit strings."""
        if not unit:
            return None
        
        unit = unit.strip().lower()
        
        # Common normalizations
        normalizations = {
            "г/л": "g/L",
            "ммоль/л": "mmol/L",
            "мкмоль/л": "μmol/L",
            "ед/л": "U/L",
            "мм/ч": "mm/h",
            "мкг/л": "μg/L",
            "нг/мл": "ng/mL",
            "пг/мл": "pg/mL",
            "%": "%",
        }
        
        return normalizations.get(unit, unit)
    
    def _add_reference_and_status(self, marker_result: MarkerResult, marker_key: str):
        """Add reference range (from PDF first, fallback to defaults) and calculate status."""
        # Only use defaults if PDF didn't provide reference ranges
        if marker_key in REFERENCE_RANGES:
            ref_min, ref_max, default_unit = REFERENCE_RANGES[marker_key]
            
            # Use PDF-extracted refs if available, otherwise use defaults
            if marker_result.reference_min is None:
                marker_result.reference_min = ref_min
            if marker_result.reference_max is None:
                marker_result.reference_max = ref_max
            if marker_result.unit is None:
                marker_result.unit = default_unit
        
        # Calculate status based on reference range
        if marker_result.value is not None and marker_result.reference_min is not None and marker_result.reference_max is not None:
            if marker_result.value < marker_result.reference_min * 0.7:
                marker_result.status = "critical_low"
            elif marker_result.value < marker_result.reference_min:
                marker_result.status = "low"
            elif marker_result.value > marker_result.reference_max * 1.5:
                marker_result.status = "critical_high"
            elif marker_result.value > marker_result.reference_max:
                marker_result.status = "high"
            else:
                marker_result.status = "normal"
        elif marker_result.value is not None:
            # No reference range - mark as unknown
            marker_result.status = "unknown"
    
    def _extract_lab_name(self, text: str) -> Optional[str]:
        """Extract laboratory name from text."""
        for pattern in self.lab_patterns:
            if pattern.search(text):
                return pattern.pattern
        return None
    
    def _extract_date(self, text: str) -> Optional[str]:
        """Extract analysis date from text."""
        match = self.date_pattern.search(text)
        if match:
            return match.group("date")
        return None
    
    def to_dict(self, extraction: BloodAnalysisExtraction) -> Dict[str, Any]:
        """Convert extraction to dictionary for JSON serialization."""
        result = {}
        
        for field_name in extraction.__dataclass_fields__:
            value = getattr(extraction, field_name)
            if value is not None:
                if isinstance(value, MarkerResult):
                    result[field_name] = asdict(value)
                else:
                    result[field_name] = value
        
        return result
    
    def get_summary(self, extraction: BloodAnalysisExtraction) -> Dict[str, Any]:
        """Get summary of extraction with counts and alerts."""
        total = 0
        found = 0
        alerts = []
        
        for field_name in extraction.__dataclass_fields__:
            if field_name in ["lab_name", "analysis_date", "patient_name"]:
                continue
            
            total += 1
            value = getattr(extraction, field_name)
            
            if value is not None and isinstance(value, MarkerResult) and value.value is not None:
                found += 1
                
                if value.status in ["critical_low", "critical_high"]:
                    alerts.append({
                        "marker": field_name,
                        "value": value.value,
                        "unit": value.unit,
                        "status": value.status,
                        "severity": "critical"
                    })
                elif value.status in ["low", "high"]:
                    alerts.append({
                        "marker": field_name,
                        "value": value.value,
                        "unit": value.unit,
                        "status": value.status,
                        "severity": "warning"
                    })
        
        return {
            "total_markers": total,
            "found_markers": found,
            "extraction_rate": round(found / total * 100, 1) if total > 0 else 0,
            "alerts": alerts,
            "critical_count": len([a for a in alerts if a["severity"] == "critical"]),
            "warning_count": len([a for a in alerts if a["severity"] == "warning"]),
        }


# Global extractor instance
extractor = BloodNLPExtractor()


def extract_blood_analysis(text: str) -> Dict[str, Any]:
    """
    Main entry point for blood analysis extraction.
    
    Args:
        text: Normalized text from PDF
        
    Returns:
        Dictionary with extracted markers and summary
    """
    extraction = extractor.extract(text)
    
    return {
        "markers": extractor.to_dict(extraction),
        "summary": extractor.get_summary(extraction),
        "lab_name": extraction.lab_name,
        "analysis_date": extraction.analysis_date,
    }

