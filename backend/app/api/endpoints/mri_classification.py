"""Authenticated MRI classification endpoint."""

from __future__ import annotations

import time

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel

from app.core.auth import (
    CurrentUserContext,
    get_current_user_context,
    require_patient_access,
)
from app.services.mri_classification import (
    ClassificationError,
    IncompatibleCheckpointError,
    MalformedImageError,
    ModelNotConfiguredError,
    MriClassifier,
)


router = APIRouter()

_CLASSIFIER = None

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/tiff",
}

ALLOWED_EXTENSIONS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".tif",
    ".tiff",
)


def _get_classifier():
    global _CLASSIFIER

    if _CLASSIFIER is None:
        _CLASSIFIER = (
            MriClassifier
            .from_environment()
        )

    return _CLASSIFIER


class ClassificationResponse(BaseModel):
    predicted_class: str
    scores: dict[str, float]
    score_type: str
    processing_time_ms: int
    assistive_note: str
    score_note: str


@router.post(
    "/classify",
    response_model=ClassificationResponse,
)
async def classify_mri(
    file: UploadFile = File(...),
    patient_id: str = "",
    current_user: CurrentUserContext = Depends(
        get_current_user_context
    ),
):
    # Important: authorize before loading/accessing the model.
    require_patient_access(
        patient_id,
        current_user,
    )

    filename = (
        file.filename or ""
    ).lower()

    if (
        not filename.endswith(
            ALLOWED_EXTENSIONS
        )
        or file.content_type
        not in ALLOWED_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid MRI image type. "
                "Allowed: PNG, JPEG, TIFF"
            ),
        )

    data = await file.read(
        MAX_UPLOAD_BYTES + 1
    )

    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="MRI image exceeds the upload limit",
        )

    started = time.perf_counter()

    try:
        result = (
            _get_classifier()
            .classify(data)
        )

    except MalformedImageError as exc:
        raise HTTPException(
            status_code=422,
            detail="Malformed or unsupported MRI image",
        ) from exc

    except ModelNotConfiguredError as exc:
        raise HTTPException(
            status_code=503,
            detail="MRI classification model is not configured",
        ) from exc

    except IncompatibleCheckpointError as exc:
        raise HTTPException(
            status_code=503,
            detail="MRI classification checkpoint is incompatible",
        ) from exc

    except ClassificationError as exc:
        raise HTTPException(
            status_code=422,
            detail="MRI classification inference failed",
        ) from exc

    return ClassificationResponse(
        predicted_class=(
            result.predicted_class
        ),
        scores=result.scores,
        score_type=result.score_type,
        processing_time_ms=int(
            (
                time.perf_counter()
                - started
            )
            * 1000
        ),
        assistive_note=(
            "Assistive research/decision-support output only. "
            "This result is not a diagnosis."
        ),
        score_note=(
            "Scores are model outputs. "
            "They are not validated clinical probabilities."
        ),
    )
