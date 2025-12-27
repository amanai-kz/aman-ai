from fastapi.testclient import TestClient
from app.main import app
from app.api.endpoints import blood


client = TestClient(app)


def test_upload_pdf_returns_parsed_markers(monkeypatch):
    sample_text = "Гемоглобин 140 г/л\nАЛТ/АСТ 20/18"
    monkeypatch.setattr(blood, "extract_text_from_pdf", lambda _: sample_text)

    response = client.post(
        "/api/v1/services/blood/upload-pdf",
        files={"file": ("test.pdf", b"dummy", "application/pdf")},
        data={"patient_id": "patient-123"},
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["patientId"] == "patient-123"
    assert payload["extracted"]["hemoglobin"]["value"] == 140.0
    assert payload["extracted"]["alt"]["value"] == 20.0
    assert payload["extracted"]["ast"]["value"] == 18.0
    assert "hemoglobin" not in payload["missing"]
    assert "alt" not in payload["missing"]
    assert "ast" not in payload["missing"]
    assert payload["rawTextLength"] == len(sample_text)


def test_upload_pdf_without_text_returns_422(monkeypatch):
    monkeypatch.setattr(blood, "extract_text_from_pdf", lambda _: "")

    response = client.post(
        "/api/v1/services/blood/upload-pdf",
        files={"file": ("test.pdf", b"dummy", "application/pdf")},
        data={"patient_id": "p-1"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "PDF contains no extractable text. OCR is not supported."
