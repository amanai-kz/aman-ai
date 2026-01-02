"""Tests for the NLP-based blood analysis extractor."""

import pytest
from app.services.blood_nlp_extractor import (
    BloodNLPExtractor,
    extract_blood_analysis,
    MarkerResult,
)


@pytest.fixture
def extractor():
    return BloodNLPExtractor()


class TestBloodNLPExtractor:
    """Test suite for BloodNLPExtractor."""

    def test_extract_basic_cbc_russian(self, extractor):
        """Test extraction of basic CBC in Russian."""
        text = """
        ОБЩИЙ АНАЛИЗ КРОВИ
        Гемоглобин: 145 г/л (норма: 120-160)
        Эритроциты: 4.8 10^12/л
        Лейкоциты: 6.5 10^9/л
        Тромбоциты: 250 10^9/л
        СОЭ: 8 мм/ч
        """
        
        result = extractor.extract(text)
        
        assert result.hemoglobin is not None
        assert result.hemoglobin.value == 145.0
        assert result.hemoglobin.status == "normal"
        
        assert result.rbc is not None
        assert result.rbc.value == 4.8
        
        assert result.wbc is not None
        assert result.wbc.value == 6.5
        
        assert result.platelets is not None
        assert result.platelets.value == 250.0
        
        assert result.esr is not None
        assert result.esr.value == 8.0

    def test_extract_kazakh_aliases(self, extractor):
        """Test extraction with Kazakh language aliases."""
        text = """
        Эритроциттер: 4.6 10^12/л
        Лейкоциттер: 7.2 10^9/л
        ЭТЖ: 12 мм/ч
        """
        
        result = extractor.extract(text)
        
        assert result.rbc is not None
        assert result.rbc.value == 4.6
        
        assert result.wbc is not None
        assert result.wbc.value == 7.2
        
        assert result.esr is not None
        assert result.esr.value == 12.0

    def test_extract_combined_alt_ast(self, extractor):
        """Test extraction of combined ALT/AST pattern."""
        text = """
        Печёночные пробы:
        АЛТ/АСТ: 25/18 Ед/л
        """
        
        result = extractor.extract(text)
        
        assert result.alt is not None
        assert result.alt.value == 25.0
        
        assert result.ast is not None
        assert result.ast.value == 18.0

    def test_extract_lipid_panel(self, extractor):
        """Test extraction of lipid panel."""
        text = """
        ЛИПИДНЫЙ ПРОФИЛЬ
        Холестерин общий: 5.2 ммоль/л
        ЛПВП: 1.4 ммоль/л
        ЛПНП: 3.1 ммоль/л
        Триглицериды: 1.2 ммоль/л
        """
        
        result = extractor.extract(text)
        
        assert result.cholesterol is not None
        assert result.cholesterol.value == 5.2
        
        assert result.hdl is not None
        assert result.hdl.value == 1.4
        
        assert result.ldl is not None
        assert result.ldl.value == 3.1
        
        assert result.triglycerides is not None
        assert result.triglycerides.value == 1.2

    def test_extract_kidney_function(self, extractor):
        """Test extraction of kidney function markers."""
        text = """
        Креатинин: 85 мкмоль/л
        Мочевина: 5.5 ммоль/л
        Мочевая кислота: 320 мкмоль/л
        """
        
        result = extractor.extract(text)
        
        assert result.creatinine is not None
        assert result.creatinine.value == 85.0
        
        assert result.urea is not None
        assert result.urea.value == 5.5
        
        assert result.uric_acid is not None
        assert result.uric_acid.value == 320.0

    def test_extract_thyroid(self, extractor):
        """Test extraction of thyroid markers."""
        text = """
        ЩИТОВИДНАЯ ЖЕЛЕЗА
        ТТГ: 2.5 мМЕ/л
        Свободный Т4: 15.2 пмоль/л
        """
        
        result = extractor.extract(text)
        
        assert result.tsh is not None
        assert result.tsh.value == 2.5
        
        assert result.t4_free is not None
        assert result.t4_free.value == 15.2

    def test_extract_electrolytes(self, extractor):
        """Test extraction of electrolytes."""
        text = """
        Натрий: 140 ммоль/л
        Калий: 4.5 ммоль/л
        Железо: 18 мкмоль/л
        Ферритин: 120 нг/мл
        """
        
        result = extractor.extract(text)
        
        assert result.sodium is not None
        assert result.sodium.value == 140.0
        
        assert result.potassium is not None
        assert result.potassium.value == 4.5
        
        assert result.iron is not None
        assert result.iron.value == 18.0
        
        assert result.ferritin is not None
        assert result.ferritin.value == 120.0

    def test_extract_inflammation_markers(self, extractor):
        """Test extraction of inflammation markers."""
        text = """
        С-реактивный белок: 3.2 мг/л
        Прокальцитонин: 0.05 нг/мл
        """
        
        result = extractor.extract(text)
        
        assert result.crp is not None
        assert result.crp.value == 3.2
        
        assert result.procalcitonin is not None
        assert result.procalcitonin.value == 0.05

    def test_extract_vitamins(self, extractor):
        """Test extraction of vitamin levels."""
        text = """
        Витамин D: 45 нг/мл
        Витамин B12: 350 пг/мл
        Фолиевая кислота: 12.5 нг/мл
        """
        
        result = extractor.extract(text)
        
        assert result.vitamin_d is not None
        assert result.vitamin_d.value == 45.0
        
        assert result.vitamin_b12 is not None
        assert result.vitamin_b12.value == 350.0
        
        assert result.folate is not None
        assert result.folate.value == 12.5

    def test_status_calculation_normal(self, extractor):
        """Test that normal values get correct status."""
        text = "Гемоглобин: 140 г/л"
        
        result = extractor.extract(text)
        
        assert result.hemoglobin is not None
        assert result.hemoglobin.status == "normal"

    def test_status_calculation_high(self, extractor):
        """Test that high values get correct status."""
        text = "АЛТ: 65 Ед/л"  # Reference max is 40
        
        result = extractor.extract(text)
        
        assert result.alt is not None
        assert result.alt.status == "high"

    def test_status_calculation_low(self, extractor):
        """Test that low values get correct status."""
        text = "Гемоглобин: 100 г/л"  # Reference min is 120
        
        result = extractor.extract(text)
        
        assert result.hemoglobin is not None
        assert result.hemoglobin.status == "low"

    def test_status_calculation_critical(self, extractor):
        """Test that critical values get correct status."""
        text = "Гемоглобин: 70 г/л"  # Way below reference
        
        result = extractor.extract(text)
        
        assert result.hemoglobin is not None
        assert result.hemoglobin.status == "critical_low"

    def test_comma_decimal_separator(self, extractor):
        """Test handling of comma as decimal separator."""
        text = "Глюкоза: 5,8 ммоль/л"
        
        result = extractor.extract(text)
        
        assert result.glucose is not None
        assert result.glucose.value == 5.8

    def test_empty_text_returns_empty_result(self, extractor):
        """Test that empty text returns empty extraction."""
        result = extractor.extract("")
        
        assert result.hemoglobin is None
        assert result.rbc is None

    def test_english_aliases(self, extractor):
        """Test extraction with English aliases."""
        text = """
        Hemoglobin: 145 g/L
        RBC: 4.8 10^12/L
        WBC: 6.5 10^9/L
        Platelets: 250 10^9/L
        ESR: 8 mm/h
        """
        
        result = extractor.extract(text)
        
        assert result.hemoglobin is not None
        assert result.hemoglobin.value == 145.0
        
        assert result.rbc is not None
        assert result.wbc is not None
        assert result.platelets is not None
        assert result.esr is not None


class TestExtractBloodAnalysis:
    """Test the main extract_blood_analysis function."""

    def test_returns_markers_and_summary(self):
        """Test that function returns both markers and summary."""
        text = """
        Гемоглобин: 145 г/л
        АЛТ: 65 Ед/л
        """
        
        result = extract_blood_analysis(text)
        
        assert "markers" in result
        assert "summary" in result
        assert result["markers"]["hemoglobin"]["value"] == 145.0
        assert result["summary"]["found_markers"] >= 2
        assert result["summary"]["warning_count"] >= 1  # ALT is high

    def test_summary_counts_alerts(self):
        """Test that summary correctly counts alerts."""
        text = """
        Гемоглобин: 70 г/л
        АЛТ: 150 Ед/л
        Глюкоза: 5.0 ммоль/л
        """
        
        result = extract_blood_analysis(text)
        summary = result["summary"]
        
        assert summary["critical_count"] >= 1  # Hemoglobin critical low
        assert summary["warning_count"] >= 0


class TestCoagulationMarkers:
    """Test coagulation marker extraction."""

    def test_extract_coagulation(self):
        extractor = BloodNLPExtractor()
        text = """
        КОАГУЛОГРАММА
        Протромбиновое время: 12.5 сек
        МНО: 1.1
        АЧТВ: 32 сек
        Фибриноген: 3.2 г/л
        D-димер: 0.3 мкг/мл
        """
        
        result = extractor.extract(text)
        
        assert result.pt is not None
        assert result.pt.value == 12.5
        
        assert result.inr is not None
        assert result.inr.value == 1.1
        
        assert result.aptt is not None
        assert result.aptt.value == 32.0
        
        assert result.fibrinogen is not None
        assert result.fibrinogen.value == 3.2
        
        assert result.d_dimer is not None
        assert result.d_dimer.value == 0.3


class TestTumorMarkers:
    """Test tumor marker extraction."""

    def test_extract_tumor_markers(self):
        extractor = BloodNLPExtractor()
        text = """
        ОНКОМАРКЕРЫ
        ПСА: 2.5 нг/мл
        РЭА: 3.1 нг/мл
        АФП: 5.2 МЕ/мл
        СА-125: 18 Ед/мл
        СА 19-9: 25 Ед/мл
        """
        
        result = extractor.extract(text)
        
        assert result.psa is not None
        assert result.psa.value == 2.5
        
        assert result.cea is not None
        assert result.cea.value == 3.1
        
        assert result.afp is not None
        assert result.afp.value == 5.2
        
        assert result.ca125 is not None
        assert result.ca125.value == 18.0
        
        assert result.ca199 is not None
        assert result.ca199.value == 25.0




