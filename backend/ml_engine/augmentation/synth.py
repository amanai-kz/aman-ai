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
        Optional callable ``(sequence, pathology, seed) -> volume_ref`` — a thin
        hook that yields a URI/path for the generated volume (used in tests).
    volume_generator
        Optional :class:`~ml_engine.augmentation.generators.VolumeGenerator`
        backend (NV-Generate or the procedural fallback) that synthesises the
        actual voxel array. Takes precedence over ``generator_fn`` for
        :meth:`generate_volume`. If neither is given, :meth:`load_backend` wires
        the best available backend on demand.
    """

    def __init__(self, generator_fn: Optional[Callable[[str, str, int], str]] = None,
                 *, volume_generator: Optional[object] = None):
        self._generator_fn = generator_fn
        self._volume_generator = volume_generator

    def load_backend(self, *, size: int = 48, prefer_nv: bool = True):
        """Attach the best available volume backend (NV-Generate if configured,
        else the reproducible procedural fallback)."""
        from .generators import default_generator
        self._volume_generator = default_generator(size=size, prefer_nv=prefer_nv)
        return self._volume_generator

    def _ref(self, sequence: str, pathology: str, seed: int) -> str:
        if self._generator_fn is not None:
            return self._generator_fn(sequence, pathology, seed)
        if self._volume_generator is not None:
            backend = getattr(self._volume_generator, "name", "volume-generator")
            return f"mem://synthetic/{backend}/{pathology}/{sequence}/{seed}"
        raise RuntimeError("no generator backend attached; call load_backend() or pass a generator")

    def generate(self, *, sequence: str, pathology: str, seed: int = 0,
                 idx: int = 0) -> SyntheticSample:
        volume_ref = self._ref(sequence, pathology, seed)
        return SyntheticSample(
            sample_id=f"syn-{uuid.uuid5(uuid.NAMESPACE_OID, f'{pathology}:{sequence}:{seed}:{idx}')}",
            sequence=sequence, pathology=pathology, volume_ref=volume_ref,
            provenance={"model": SYNTHETIC_TAG, "seed": seed, "backend": getattr(
                self._volume_generator, "name", "generator_fn"),
                "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat()},
        )

    def generate_batch(self, *, sequence: str, pathology: str, n: int,
                       base_seed: int = 0) -> list[SyntheticSample]:
        return [self.generate(sequence=sequence, pathology=pathology,
                              seed=base_seed + i, idx=i) for i in range(n)]

    def generate_volume(self, *, sequence: str, pathology: str, seed: int = 0,
                        idx: int = 0):
        """Synthesise the actual voxel volume *and* its tagged record.

        Returns ``(SyntheticSample, np.ndarray)``. Requires a ``volume_generator``
        backend (call :meth:`load_backend` first, or pass one to the constructor).
        """
        if self._volume_generator is None:
            self.load_backend()
        vol = self._volume_generator.generate(sequence=sequence, pathology=pathology, seed=seed)
        return self.generate(sequence=sequence, pathology=pathology, seed=seed, idx=idx), vol

    def synthesize_missing_modality(self, source_volume, *, source_seq: str, target_seq: str):
        """Derive a missing target sequence from an existing volume (Stage E)."""
        if self._volume_generator is None:
            self.load_backend()
        fn = getattr(self._volume_generator, "synthesize_missing_modality", None)
        if fn is None:
            raise NotImplementedError(f"{getattr(self._volume_generator, 'name', '?')} "
                                      "has no missing-modality synthesis")
        return fn(source_volume, source_seq=source_seq, target_seq=target_seq)
