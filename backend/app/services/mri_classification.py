"""Native adapter for the supplied four-class MRI classifier.

The implementation reproduces the supplied prototype's model architecture
and preprocessing. Output is assistive/research decision support only.
"""

from __future__ import annotations

import io
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image, UnidentifiedImageError


CLASS_NAMES = ['glioma_tumor', 'meningioma_tumor', 'no_tumor', 'pituitary_tumor']

_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


class TumorClassifier(nn.Module):
    def __init__(self, num_classes):
        super(TumorClassifier, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2)
        )
        self.classifier = nn.Sequential(
            nn.Linear(32 * 56 * 56, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x


class ClassificationError(RuntimeError):
    """Base MRI classification runtime error."""


class ModelNotConfiguredError(ClassificationError):
    """Model configuration is absent or unavailable."""


class IncompatibleCheckpointError(ClassificationError):
    """Checkpoint does not strictly match the supplied architecture."""


class MalformedImageError(ValueError):
    """Uploaded bytes are not a decodable supported image."""


@dataclass(frozen=True)
class ClassificationResult:
    predicted_class: str
    scores: dict[str, float]
    score_type: str = "softmax_scores"

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def decode_and_preprocess(data: bytes):
    try:
        with Image.open(io.BytesIO(data)) as image:
            image = image.convert("RGB")
            tensor = _TRANSFORM(image)
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as exc:
        raise MalformedImageError(
            "image decoding failed"
        ) from exc

    if tuple(tensor.shape) != (3, 224, 224):
        raise MalformedImageError(
            "unexpected preprocessed image shape"
        )

    if not torch.isfinite(tensor).all():
        raise MalformedImageError(
            "preprocessed image contains non-finite values"
        )

    return tensor.unsqueeze(0)


class MriClassifier:
    def __init__(self, model, device: str):
        self._model = model
        self._device = device

    @classmethod
    def from_environment(cls):
        checkpoint_value = os.environ.get(
            "AMAN_MRI_CLASSIFICATION_CKPT",
            "",
        ).strip()

        if not checkpoint_value:
            raise ModelNotConfiguredError(
                "checkpoint is not configured"
            )

        checkpoint_path = Path(
            checkpoint_value
        )

        if not checkpoint_path.is_file():
            raise ModelNotConfiguredError(
                "configured checkpoint is unavailable"
            )

        device = os.environ.get(
            "AMAN_MRI_CLASSIFICATION_DEVICE",
            "cpu",
        ).strip() or "cpu"

        if (
            device.startswith("cuda")
            and not torch.cuda.is_available()
        ):
            raise ModelNotConfiguredError(
                "configured CUDA device is unavailable"
            )

        model = TumorClassifier(
            num_classes=len(CLASS_NAMES)
        )

        try:
            checkpoint = torch.load(
                checkpoint_path,
                map_location=device,
                weights_only=True,
            )

            state_dict = (
                checkpoint["model_state_dict"]
                if isinstance(checkpoint, dict)
                and "model_state_dict" in checkpoint
                else checkpoint
            )

            if not isinstance(state_dict, dict):
                raise TypeError(
                    "checkpoint has no usable state_dict"
                )

            model.load_state_dict(
                state_dict,
                strict=True,
            )

        except Exception as exc:
            raise IncompatibleCheckpointError(
                "checkpoint loading failed"
            ) from exc

        model.to(device)
        model.eval()

        return cls(
            model=model,
            device=device,
        )

    def classify(self, data: bytes):
        tensor = decode_and_preprocess(
            data
        ).to(self._device)

        try:
            with torch.inference_mode():
                output = self._model(
                    tensor
                )

            if tuple(output.shape) != (
                1,
                len(CLASS_NAMES),
            ):
                raise ValueError(
                    "unexpected classifier output shape"
                )

            scores = torch.softmax(output, dim=1)

            if not torch.isfinite(scores).all():
                raise ValueError(
                    "non-finite classifier output"
                )

            scores = (
                scores.detach()
                .cpu()[0]
            )

            predicted_index = int(
                torch.argmax(scores).item()
            )

        except Exception as exc:
            raise ClassificationError(
                "classifier inference failed"
            ) from exc

        return ClassificationResult(
            predicted_class=(
                CLASS_NAMES[
                    predicted_index
                ]
            ),
            scores={
                name: round(
                    float(scores[index].item()),
                    6,
                )
                for index, name
                in enumerate(CLASS_NAMES)
            },
        )
