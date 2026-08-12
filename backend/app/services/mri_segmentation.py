"""Opt-in 2D MRI segmentation inference adapted from the external prototype."""

from __future__ import annotations

import base64
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np


IMAGE_SIZE = 256
DEFAULT_THRESHOLD = 0.5


class SegmentationError(RuntimeError):
    """Base class for safe MRI segmentation failures."""


class ModelNotConfiguredError(SegmentationError):
    """The checkpoint or required runtime is unavailable."""


class IncompatibleCheckpointError(SegmentationError):
    """The configured checkpoint does not match the expected architecture."""


class InferenceError(SegmentationError):
    """The configured model failed while processing an input."""


class MalformedImageError(ValueError):
    """Uploaded bytes cannot be decoded into a supported image."""


@dataclass(frozen=True)
class SegmentationResult:
    mask_png_base64: str
    width: int
    height: int
    positive_pixel_count: int
    positive_area_fraction: float
    max_probability: float
    mean_positive_probability: float | None
    threshold: float

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def decode_and_preprocess(image_bytes: bytes):
    """Decode an image and reproduce the prototype's BGR, 0..1 tensor input."""
    try:
        import torch
    except ImportError as exc:
        raise ModelNotConfiguredError("PyTorch is unavailable") from exc

    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_UNCHANGED)
    if image is None or image.size == 0:
        raise MalformedImageError("image decoding failed")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    elif image.ndim == 3 and image.shape[2] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    elif image.ndim != 3 or image.shape[2] != 3:
        raise MalformedImageError("unsupported image channel layout")

    resized = cv2.resize(image, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_LINEAR)
    contiguous = np.ascontiguousarray(resized.transpose(2, 0, 1))
    return torch.from_numpy(contiguous).float().div(255.0).unsqueeze(0)


class MriSegmenter:
    """EfficientNet-B7 U-Net loader and inference adapter."""

    def __init__(self, model, device: str, threshold: float = DEFAULT_THRESHOLD):
        self._model = model
        self._device = device
        self._threshold = threshold

    @classmethod
    def from_environment(cls) -> "MriSegmenter":
        checkpoint_value = os.environ.get("AMAN_MRI_SEGMENTATION_CKPT", "").strip()
        if not checkpoint_value:
            raise ModelNotConfiguredError("AMAN_MRI_SEGMENTATION_CKPT is unset")
        checkpoint_path = Path(checkpoint_value)
        if not checkpoint_path.is_file():
            raise ModelNotConfiguredError("configured checkpoint does not exist")

        try:
            import segmentation_models_pytorch as smp
            import torch
        except ImportError as exc:
            raise ModelNotConfiguredError("segmentation runtime dependencies are unavailable") from exc

        requested_device = os.environ.get("AMAN_MRI_SEGMENTATION_DEVICE", "cpu")
        if requested_device.startswith("cuda") and not torch.cuda.is_available():
            raise ModelNotConfiguredError("configured CUDA device is unavailable")

        model = smp.Unet(
            encoder_name="efficientnet-b7",
            encoder_weights=None,
            in_channels=3,
            classes=1,
            activation="sigmoid",
        )
        try:
            checkpoint = torch.load(
                checkpoint_path,
                map_location=requested_device,
                weights_only=True,
            )
            state_dict = (
                checkpoint["model_state_dict"]
                if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint
                else checkpoint
            )
            if not isinstance(state_dict, dict):
                raise TypeError("checkpoint does not contain a state dictionary")
            model.load_state_dict(state_dict, strict=True)
        except Exception as exc:
            raise IncompatibleCheckpointError("checkpoint loading failed") from exc

        model.to(requested_device)
        model.eval()
        return cls(model, requested_device)

    def segment(self, input_tensor) -> SegmentationResult:
        try:
            import torch

            with torch.inference_mode():
                prediction = self._model(input_tensor.to(self._device)).detach().cpu()[0, 0]
            probabilities = prediction.numpy()
            if probabilities.shape != (IMAGE_SIZE, IMAGE_SIZE) or not np.isfinite(probabilities).all():
                raise ValueError("model returned invalid probabilities")
            mask = (probabilities > self._threshold).astype(np.uint8)
            encoded_ok, encoded_mask = cv2.imencode(".png", mask * 255)
            if not encoded_ok:
                raise ValueError("mask encoding failed")
        except Exception as exc:
            raise InferenceError("model inference failed") from exc

        positive = mask.astype(bool)
        positive_count = int(positive.sum())
        return SegmentationResult(
            mask_png_base64=base64.b64encode(encoded_mask.tobytes()).decode("ascii"),
            width=IMAGE_SIZE,
            height=IMAGE_SIZE,
            positive_pixel_count=positive_count,
            positive_area_fraction=round(positive_count / mask.size, 8),
            max_probability=round(float(probabilities.max()), 6),
            mean_positive_probability=(
                round(float(probabilities[positive].mean()), 6) if positive_count else None
            ),
            threshold=self._threshold,
        )
