from app.services.invivo_blood_parser import parse_invivo_blood


def test_parse_invivo_ru_with_combined_alt_ast():
    text = (
        "Гемоглобин 145 г/л\n"
        "Эритроциты 4,8 10^12/л\n"
        "АЛТ/АСТ 23/18\n"
        "СОЭ 12 мм/ч\n"
    )

    result = parse_invivo_blood(text)

    assert result["hemoglobin"]["value"] == 145.0
    assert result["hemoglobin"]["unit"] == "г/л"
    assert result["hemoglobin"]["confidence"] == 1.0

    assert result["rbc"]["value"] == 4.8
    assert result["rbc"]["unit"] == "10^12/л"

    assert result["alt"]["value"] == 23.0
    assert result["ast"]["value"] == 18.0

    assert result["esr"]["value"] == 12.0
    assert result["esr"]["unit"] == "мм/ч"


def test_parse_invivo_kz_aliases_and_commas():
    text = (
        "Эритроциттер 4,6 10^12/л\n"
        "Лейкоциттер 7,2 10^9/л\n"
        "ALT 30\n"
        "AST 18\n"
    )

    result = parse_invivo_blood(text)

    assert result["rbc"]["value"] == 4.6
    assert result["wbc"]["value"] == 7.2
    assert result["alt"]["value"] == 30.0
    assert result["ast"]["value"] == 18.0

    for key in ["rbc", "wbc", "alt", "ast"]:
        assert result[key]["confidence"] == 1.0
