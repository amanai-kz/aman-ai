"""NV-Generate-MR-Brain synthetic augmentation (SCRUM-25, §7.1 Stage E, §7.5).

The generation backend (NVIDIA 3D latent-diffusion model) needs heavy deps and
weights, so it is loaded lazily. The **tagging / isolation** guarantees — which
keep synthetic data from ever being shown as a patient finding — are pure-Python
and always enforced, so they are unit-testable without the model.
"""
from __future__ import annotations

import datetime as _dt
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Sequence

SYNTHETIC_TAG = "synthetic:nv-generate-mr-brain"


@dataclass(frozen=True)
class SyntheticSample:
    """A generated volume record. ``is_synthetic`` is always True and the tag is
    embedded so downstream code (training loaders, report UI) can hard-filter it
    out of any patient-facing surface."""

    sample_id: str
    sequence: str                     # T1 / T2 / FLAIR / SWI
    pathology: str                    # rare class being synthesised
    volume_ref: str                   # path/URI to the generated volume
    is_synthetic: bool = True
    tags: tuple[str, ...] = (SYNTHETIC_TAG,)
    provenance: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.is_synthetic:
            raise ValueError("SyntheticSample.is_synthetic must be True")
        if SYNTHETIC_TAG not in self.tags:
            raise ValueError("SyntheticSample must carry the synthetic tag")

    @property
    def patient_facing_allowed(self) -> bool:
        """Hard invariant: synthetic data is never patient-facing (§7.5)."""
        return False


def assert_no_synthetic_in_patient_view(records: Sequence[Any]) -> None:
    """Guard for any patient-facing pipeline: raise if a synthetic record leaks."""
    for r in records:
        tags = getattr(r, "tags", ()) or (r.get("tags", ()) if isinstance(r, dict) else ())
        is_syn = getattr(r, "is_synthetic", False) or (
            r.get("is_synthetic", False) if isinstance(r, dict) else False)
        if is_syn or SYNTHETIC_TAG in tuple(tags):
            raise AssertionError("synthetic sample leaked into a patient-facing view (§7.5 violation)")


class SyntheticAugmentor:
    """Generates tagged synthetic volumes for rare classes / missing modalities.

    Parameters
    ----------
    generator_fn
        Optional callable ``(sequence, pathology, seed) -> volume_ref``. If
        omitted, :meth:`load_backend` must wire the real NV-Generate pipeline
        before :meth:`generate` is called.
    """

    def __init__(self, generator_fn: Optional[Callable[[str, str, int], str]] = None):
        self._generator_fn = generator_fn

    def load_backend(self):  # pragma: no cover - requires NVIDIA model + weights
        """Wire the NV-Generate-MR-Brain latent-diffusion backend (MONAI/torch)."""
        raise NotImplementedError(
            "NV-Generate backend wired at the training milestone; "
            "verify NVIDIA Open Model Licence terms for commercial use (§6.2)."
        )

    def generate(self, *, sequence: str, pathology: str, seed: int = 0,
                 idx: int = 0) -> SyntheticSample:
        if self._generator_fn is None:
            raise RuntimeError("no generator backend attached; call load_backend() or pass generator_fn")
        volume_ref = self._generator_fn(sequence, pathology, seed)
        return SyntheticSample(
            sample_id=f"syn-{uuid.uuid5(uuid.NAMESPACE_OID, f'{pathology}:{sequence}:{seed}:{idx}')}",
            sequence=sequence, pathology=pathology, volume_ref=volume_ref,
            provenance={"model": SYNTHETIC_TAG, "seed": seed,
                        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat()},
        )

    def generate_batch(self, *, sequence: str, pathology: str, n: int,
                       base_seed: int = 0) -> list[SyntheticSample]:
        return [self.generate(sequence=sequence, pathology=pathology,
                              seed=base_seed + i, idx=i) for i in range(n)]
