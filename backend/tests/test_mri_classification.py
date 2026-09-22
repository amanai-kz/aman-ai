import io

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.api.endpoints import mri_classification
from app.main import app
from app.services.mri_classification import (
    CLASS_NAMES,
    ClassificationError,
    ClassificationResult,
    IncompatibleCheckpointError,
    MalformedImageError,
    ModelNotConfiguredError,
    MriClassifier,
    TumorClassifier,
)


client = TestClient(app)

URL = "/api/v1/services/ct-mri/classify"


def auth_headers(
    *,
    patient_id: str = "patient-1",
):
    return {
        "X-Test-User-Id": "patient-user",
        "X-Test-Role": "PATIENT",
        "X-Test-Patient-Id": patient_id,
    }


def png_bytes():
    image = np.zeros(
        (32, 32, 3),
        dtype=np.uint8,
    )

    image[:, :, 1] = 127

    ok, encoded = cv2.imencode(
        ".png",
        image,
    )

    assert ok
    return encoded.tobytes()


def upload(
    content=None,
    *,
    patient_id="patient-1",
    headers=None,
    filename="scan.png",
    content_type="image/png",
):
    if content is None:
        content = png_bytes()

    return client.post(
        URL,
        params={
            "patient_id": patient_id
        },
        files={
            "file": (
                filename,
                io.BytesIO(content),
                content_type,
            )
        },
        headers=(
            auth_headers()
            if headers is None
            else headers
        ),
    )


def test_exact_classifier_architecture():
    assert CLASS_NAMES == ['glioma_tumor', 'meningioma_tumor', 'no_tumor', 'pituitary_tumor']

    state = TumorClassifier(
        num_classes=4
    ).state_dict()

    assert set(state) == {
        "features.0.weight",
        "features.0.bias",
        "features.3.weight",
        "features.3.bias",
        "classifier.0.weight",
        "classifier.0.bias",
        "classifier.2.weight",
        "classifier.2.bias",
    }

    assert tuple(
        state["classifier.0.weight"].shape
    ) == (128, 100352)

    assert tuple(
        state["classifier.2.weight"].shape
    ) == (4, 128)


def test_requires_authentication():
    response = upload(
        headers={},
    )

    assert response.status_code == 401


def test_patient_access_before_model(
    monkeypatch,
):
    def forbidden_model():
        raise AssertionError(
            "model accessed before authorization"
        )

    monkeypatch.setattr(
        mri_classification,
        "_get_classifier",
        forbidden_model,
    )

    response = upload(
        patient_id="patient-2",
        headers=auth_headers(
            patient_id="patient-1",
        ),
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("scan.gif", "image/gif"),
        ("scan.png", "application/pdf"),
        ("scan.exe", "image/png"),
    ],
)
def test_invalid_upload_type(
    filename,
    content_type,
):
    response = upload(
        filename=filename,
        content_type=content_type,
    )

    assert response.status_code == 400


def test_missing_checkpoint(
    monkeypatch,
):
    monkeypatch.delenv(
        "AMAN_MRI_CLASSIFICATION_CKPT",
        raising=False,
    )

    with pytest.raises(
        ModelNotConfiguredError
    ):
        MriClassifier.from_environment()


@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (
            ModelNotConfiguredError("secret path"),
            503,
            "MRI classification model is not configured",
        ),
        (
            IncompatibleCheckpointError("weights"),
            503,
            "MRI classification checkpoint is incompatible",
        ),
        (
            MalformedImageError("bad image"),
            422,
            "Malformed or unsupported MRI image",
        ),
        (
            ClassificationError("internal"),
            422,
            "MRI classification inference failed",
        ),
    ],
)
def test_errors_hide_internal_details(
    monkeypatch,
    error,
    status_code,
    detail,
):
    class Failure:
        def classify(self, _data):
            raise error

    monkeypatch.setattr(
        mri_classification,
        "_get_classifier",
        lambda: Failure(),
    )

    response = upload()

    assert response.status_code == status_code
    assert response.json()["detail"] == detail
    assert str(error) not in response.text


def test_authorized_result_is_transient_model_output(
    monkeypatch,
):
    class Fake:
        def classify(self, _data):
            return ClassificationResult(
                predicted_class=CLASS_NAMES[0],
                scores={
                    name: float(index)
                    for index, name
                    in enumerate(CLASS_NAMES)
                },
            )

    monkeypatch.setattr(
        mri_classification,
        "_get_classifier",
        lambda: Fake(),
    )

    response = upload()

    assert response.status_code == 200

    body = response.json()

    assert body["predicted_class"] == CLASS_NAMES[0]
    assert len(body["scores"]) == 4
    assert "not a diagnosis" in body["assistive_note"].lower()
