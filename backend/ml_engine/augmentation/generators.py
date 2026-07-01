"""Synthetic brain-MRI volume generators (SCRUM-25, §7.1 Stage E).

Two interchangeable backends behind one :class:`VolumeGenerator` protocol:

* :class:`NVGenerateMRBrainGenerator` — the real NVIDIA 3D latent-diffusion
  model (``nvidia/NV-Generate-MR-Brain``). Heavy deps + gated weights, loaded
  lazily; only activates when explicitly configured (env ``AMAN_ML_NVGEN_DIR``).
  Governed by the NVIDIA Open Model Licence — verify commercial terms (§6.2).

* :class:`ProceduralLesionGenerator` — a dependency-light (numpy-only),
  fully-reproducible stand-in that injects a pathology-specific lesion into a
  brain phantom. It is NOT clinically realistic; its job is to make the Stage-E
  pipeline and the rare-class ablation runnable and unit-testable *without* the
  gated weights, with the **identical interface** so swapping in NV-Generate is
  a one-line config change.

Both produce a normalised ``float32`` volume of shape ``(D, H, W)`` in ``[0, 1]``
and support missing-modality synthesis (derive a target sequence from a source).
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

import numpy as np

SEQUENCES = ("T1", "T2", "FLAIR", "SWI")

# Per-sequence base-contrast multipliers for the procedural phantom. Rough,
# illustrative tissue/CSF relationships only — not physically calibrated.
_SEQ_CONTRAST: dict[str, tuple[float, float]] = {
    # (parenchyma_gain, csf_gain)
    "T1": (0.80, 0.20),
    "T2": (0.55, 0.95),
    "FLAIR": (0.60, 0.10),   # CSF suppressed
    "SWI": (0.45, 0.30),
}

# How each pathology marks the volume: (intensity_delta, relative_radius).
# Sign/magnitude are illustrative, chosen so the lesion is detectable, not
# physically exact.
_PATHOLOGY_SIGNATURE: dict[str, tuple[float, float]] = {
    "intracranial_hemorrhage": (+0.45, 0.12),   # focal hyperintense blob
    "mass_effect": (+0.30, 0.22),               # large blob (+ midline shift)
    "acute_infarct": (+0.40, 0.10),             # focal bright region
    "rare_tumor": (+0.50, 0.14),
    "missing_modality": (0.0, 0.0),
}


@runtime_checkable
class VolumeGenerator(Protocol):
    """A backend that synthesises a single 3D brain-MRI volume."""

    name: str

    def available(self) -> bool: ...

    def generate(self, *, sequence: str, pathology: str, seed: int) -> np.ndarray: ...


# --------------------------------------------------------------------------- #
# Procedural fallback
# --------------------------------------------------------------------------- #
def _brain_phantom(size: int, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """A smooth ellipsoidal 'brain': returns (noise, parenchyma, csf) fields."""
    rng = np.random.default_rng(seed)
    zz, yy, xx = np.mgrid[0:size, 0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2.0
    # anisotropic ellipsoid radii
    r = np.array([0.42, 0.46, 0.40]) * size
    d = (((zz - c) / r[0]) ** 2 + ((yy - c) / r[1]) ** 2 + ((xx - c) / r[2]) ** 2)
    brain = np.clip(1.0 - d, 0.0, 1.0)            # 1 in centre -> 0 at the edge
    csf = np.exp(-((d - 1.0) ** 2) / 0.02) * 0.6   # thin rim where d ~ 1
    noise = 0.03 * rng.standard_normal((size, size, size)).astype(np.float32)  # scanner noise
    return noise, brain.astype(np.float32), csf.astype(np.float32)


def _apply_sequence(brain: np.ndarray, csf: np.ndarray, sequence: str,
                    noise: np.ndarray) -> np.ndarray:
    pg, cg = _SEQ_CONTRAST.get(sequence, _SEQ_CONTRAST["T1"])
    vol = brain * pg + csf * cg + noise
    return np.clip(vol, 0.0, 1.0).astype(np.float32)


def _inject_lesion(vol: np.ndarray, pathology: str, seed: int) -> np.ndarray:
    delta, rel_r = _PATHOLOGY_SIGNATURE.get(pathology, (+0.4, 0.12))
    if delta == 0.0:
        return vol
    size = vol.shape[0]
    rng = np.random.default_rng(seed + 9973)
    # lesion centre biased into one hemisphere (off-midline)
    cz = rng.uniform(0.35, 0.65) * size
    cy = rng.uniform(0.35, 0.65) * size
    cx = rng.uniform(0.55, 0.72) * size            # right hemisphere
    rad = rel_r * size
    zz, yy, xx = np.mgrid[0:size, 0:size, 0:size].astype(np.float32)
    blob = np.exp(-(((zz - cz) ** 2 + (yy - cy) ** 2 + (xx - cx) ** 2) / (2 * rad ** 2)))
    out = np.clip(vol + delta * blob, 0.0, 1.0).astype(np.float32)
    if pathology == "mass_effect":
        # crude midline shift: roll the volume laterally to mimic displacement
        out = np.roll(out, shift=max(1, int(0.04 * size)), axis=2)
    return out


class ProceduralLesionGenerator:
    """Reproducible numpy stand-in for NV-Generate (no weights required)."""

    name = "procedural-fallback"

    def __init__(self, size: int = 48):
        self.size = int(size)

    def available(self) -> bool:
        return True

    def generate(self, *, sequence: str, pathology: str, seed: int) -> np.ndarray:
        if sequence not in SEQUENCES:
            raise ValueError(f"unknown sequence {sequence!r}; expected one of {SEQUENCES}")
        noise, brain, csf = _brain_phantom(self.size, seed)
        vol = _apply_sequence(brain, csf, sequence, noise)
        return _inject_lesion(vol, pathology, seed)

    def synthesize_missing_modality(self, source_vol: np.ndarray, *,
                                    source_seq: str, target_seq: str) -> np.ndarray:
        """Approximate a missing target sequence from an existing one.

        A deterministic per-sequence contrast remap (illustrative, not a learned
        translation) so the missing-modality path is runnable end-to-end.
        """
        if source_seq not in SEQUENCES or target_seq not in SEQUENCES:
            raise ValueError("source/target sequence must be one of " + str(SEQUENCES))
        sp, sc = _SEQ_CONTRAST[source_seq]
        tp, tc = _SEQ_CONTRAST[target_seq]
        # invert the source gain (approx) and re-apply the target gain
        parenchyma = np.clip(source_vol / max(sp, 1e-3), 0.0, 1.0)
        remapped = parenchyma * tp + (1.0 - parenchyma) * tc * 0.3
        return np.clip(remapped, 0.0, 1.0).astype(np.float32)


# --------------------------------------------------------------------------- #
# Real NVIDIA backend (gated)
# --------------------------------------------------------------------------- #
class NVGenerateMRBrainGenerator:
    """NV-Generate-MR-Brain 3D latent-diffusion backend (NVIDIA Open Model Licence).

    Activated only when the weights are present (``AMAN_ML_NVGEN_DIR`` or a local
    HuggingFace cache of ``nvidia/NV-Generate-MR-Brain``) and MONAI/torch are
    installed. Until then :meth:`available` is False and the augmentor falls back
    to the procedural generator, keeping the pipeline runnable.
    """

    name = "nv-generate-mr-brain"

    def __init__(self, weights_dir: str | None = None, device: str = "cuda"):
        import os
        self.weights_dir = weights_dir or os.environ.get("AMAN_ML_NVGEN_DIR")
        self.device = device
        self._pipeline = None

    def available(self) -> bool:
        import os
        if not self.weights_dir or not os.path.isdir(self.weights_dir):
            return False
        try:  # the real backend needs MONAI generative + torch
            import monai  # noqa: F401
            import torch  # noqa: F401
        except Exception:
            return False
        return True

    def load(self):  # pragma: no cover - requires NVIDIA weights + GPU
        """Lazily build the latent-diffusion sampler from the local weights."""
        if self._pipeline is not None:
            return self._pipeline
        if not self.available():
            raise RuntimeError(
                "NV-Generate-MR-Brain weights/deps not present. Set AMAN_ML_NVGEN_DIR "
                "to the local model dir and install MONAI generative + torch. "
                "Verify NVIDIA Open Model Licence terms for commercial use (§6.2)."
            )
        # MONAI MAISI / NV-Generate latent diffusion is wired here at the training
        # milestone; intentionally not imported above so the module loads anywhere.
        from monai.bundle import load as _load_bundle  # type: ignore
        self._pipeline = _load_bundle(self.weights_dir)  # placeholder wiring
        return self._pipeline

    def generate(self, *, sequence: str, pathology: str, seed: int) -> np.ndarray:  # pragma: no cover
        pipe = self.load()
        # The bundle's inference call returns a (D,H,W) volume; normalise to [0,1].
        vol = pipe(sequence=sequence, pathology=pathology, seed=seed)  # type: ignore
        vol = np.asarray(vol, dtype=np.float32)
        lo, hi = float(vol.min()), float(vol.max())
        return ((vol - lo) / (hi - lo + 1e-6)).astype(np.float32)


def default_generator(size: int = 48, prefer_nv: bool = True) -> VolumeGenerator:
    """Pick the best available backend: NV-Generate if configured, else fallback."""
    if prefer_nv:
        nv = NVGenerateMRBrainGenerator()
        if nv.available():
            return nv
    return ProceduralLesionGenerator(size=size)
