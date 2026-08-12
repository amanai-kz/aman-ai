import io

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.api.endpoints import ct_mri
from app.main import app
from app.services.mri_segmentation import (
    IncompatibleCheckpointError,
    InferenceError,
    ModelNotConfiguredError,
    MriSegmenter,
    SegmentationResult,
    decode_and_preprocess,
)


client = TestClient(app)
URL = "/api/v1/services/ct-mri/analyze"


def auth_headers(
    *, patient_id: str = "patient-1", assigned_patient_ids: str | None = None
) -> dict[str, str]:
    headers = {
        "X-Test-User-Id": "patient-user",
        "X-Test-Role": "PATIENT",
        "X-Test-Patient-Id": patient_id,
    }
    if assigned_patient_ids:
        headers["X-Test-Assigned-Patient-Ids"] = assigned_patient_ids
    return headers


def png_bytes(width: int = 12, height: int = 8) -> bytes:
    image = np.zeros((height, width, 3), dtype=np.uint8)
    image[:, :, 1] = 127
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def upload(
    content: bytes,
    *,
    filename: str = "slice.png",
    content_type: str = "image/png",
    patient_id: str = "patient-1",
    headers: dict[str, str] | None = None,
):
    return client.post(
        URL,
        params={"patient_id": patient_id},
        files={"file": (filename, io.BytesIO(content), content_type)},
        headers=auth_headers() if headers is None else headers,
    )


def test_analyze_requires_authentication():
    response = upload(png_bytes(), headers={})
    assert response.status_code == 401


def test_segmenter_reports_missing_checkpoint_configuration(monkeypatch):
    monkeypatch.delenv("AMAN_MRI_SEGMENTATION_CKPT", raising=False)
    with pytest.raises(ModelNotConfiguredError):
        MriSegmenter.from_environment()


def test_analyze_rejects_unauthorized_patient_before_model_access(monkeypatch):
    def forbidden_model_access():
        raise AssertionError("model must not be accessed before authorization")

    monkeypatch.setattr(ct_mri, "_get_segmenter", forbidden_model_access)
    response = upload(
        png_bytes(),
        patient_id="patient-2",
        headers=auth_headers(patient_id="patient-1"),
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("slice.gif", "image/gif"),
        ("slice.png", "application/pdf"),
        ("slice.exe", "image/png"),
    ],
)
def test_analyze_rejects_invalid_format(filename, content_type):
    response = upload(png_bytes(), filename=filename, content_type=content_type)
    assert response.status_code == 400


def test_analyze_rejects_malformed_image(monkeypatch):
    monkeypatch.setattr(ct_mri, "_get_segmenter", lambda: object())
    response = upload(b"not an image")
    assert response.status_code == 422
    assert response.json()["detail"] == "Malformed or unsupported MRI image"


def test_analyze_rejects_oversized_input(monkeypatch):
    monkeypatch.setattr(ct_mri, "MAX_SEGMENTATION_UPLOAD_BYTES", 8)
    response = upload(b"123456789")
    assert response.status_code == 413


@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (ModelNotConfiguredError("missing"), 503, "MRI segmentation model is not configured"),
        (IncompatibleCheckpointError("bad weights"), 503, "MRI segmentation checkpoint is incompatible"),
        (InferenceError("GPU failed"), 422, "MRI segmentation inference failed"),
    ],
)
def test_analyze_maps_model_failures_without_exposing_internal_details(
    monkeypatch, error, status_code, detail
):
    class FailingSegmenter:
        def segment(self, _tensor):
            raise error

    monkeypatch.setattr(ct_mri, "_get_segmenter", lambda: FailingSegmenter())
    response = upload(png_bytes())
    assert response.status_code == status_code
    assert response.json()["detail"] == detail
    assert str(error) not in response.text


def test_success_returns_mask_metadata_for_clinician_review(monkeypatch):
    result = SegmentationResult(
        mask_png_base64="iVBORw0KGgo=",
        width=256,
        height=256,
        positive_pixel_count=512,
        positive_area_fraction=0.0078125,
        max_probability=0.91,
        mean_positive_probability=0.73,
        threshold=0.5,
    )

    class Segmenter:
        def segment(self, tensor):
            assert tuple(tensor.shape) == (1, 3, 256, 256)
            return result

    monkeypatch.setattr(ct_mri, "_get_segmenter", lambda: Segmenter())
    response = upload(png_bytes())
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["risk_level"] == "review"
    assert body["confidence"] == 0.91
    assert body["segmentation"] == {
        "mask_png_base64": "iVBORw0KGgo=",
        "width": 256,
        "height": 256,
        "positive_pixel_count": 512,
        "positive_area_fraction": 0.0078125,
        "max_probability": 0.91,
        "mean_positive_probability": 0.73,
        "threshold": 0.5,
    }
    assert body["findings"] == [
        "Model-produced segmentation region: 0.78% of the processed slice.",
        "Assistive output — requires radiologist sign-off (D2).",
    ]


def test_preprocessing_preserves_source_bgr_channel_order_and_scales_values():
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    image[:, :] = [255, 128, 0]
    ok, encoded = cv2.imencode(".png", image)
    assert ok

    tensor = decode_and_preprocess(encoded.tobytes())

    assert tuple(tensor.shape) == (1, 3, 256, 256)
    assert float(tensor[0, 0, 0, 0]) == pytest.approx(1.0)
    assert float(tensor[0, 1, 0, 0]) == pytest.approx(128 / 255)
    assert float(tensor[0, 2, 0, 0]) == pytest.approx(0.0)
