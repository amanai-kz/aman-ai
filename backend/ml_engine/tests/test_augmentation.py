"""Tests for synthetic augmentation: tagging/isolation, generators, ablation
(SCRUM-25, §7.1 Stage E, §7.5)."""
import numpy as np
import pytest

from ml_engine.augmentation import (
    SyntheticAugmentor, SyntheticSample, SYNTHETIC_TAG,
    NVGenerateMRBrainGenerator, ProceduralLesionGenerator,
    run_rare_class_ablation,
)
from ml_engine.augmentation.synth import assert_no_synthetic_in_patient_view


def _fake_generator(sequence, pathology, seed):
    return f"/tmp/synth/{pathology}_{sequence}_{seed}.nii.gz"


def test_generated_sample_is_tagged():
    aug = SyntheticAugmentor(_fake_generator)
    s = aug.generate(sequence="FLAIR", pathology="rare_tumor", seed=7)
    assert s.is_synthetic is True
    assert SYNTHETIC_TAG in s.tags
    assert s.patient_facing_allowed is False
    assert s.provenance["model"] == SYNTHETIC_TAG


def test_batch_generation_unique_ids():
    aug = SyntheticAugmentor(_fake_generator)
    batch = aug.generate_batch(sequence="T1", pathology="ich", n=5)
    assert len(batch) == 5
    assert len({s.sample_id for s in batch}) == 5


def test_cannot_construct_untagged_synthetic():
    with pytest.raises(ValueError):
        SyntheticSample(sample_id="x", sequence="T1", pathology="p",
                        volume_ref="r", tags=())  # missing tag


def test_no_backend_raises():
    with pytest.raises(RuntimeError):
        SyntheticAugmentor().generate(sequence="T1", pathology="p")


def test_patient_view_guard_blocks_synthetic():
    aug = SyntheticAugmentor(_fake_generator)
    syn = aug.generate(sequence="T2", pathology="rare", seed=1)
    real = {"study_id": "S1", "is_synthetic": False, "tags": ()}
    assert_no_synthetic_in_patient_view([real])          # ok
    with pytest.raises(AssertionError):
        assert_no_synthetic_in_patient_view([real, syn])  # leak -> blocked


# --- generators ------------------------------------------------------------- #
def test_procedural_generator_shape_and_range():
    gen = ProceduralLesionGenerator(size=24)
    vol = gen.generate(sequence="FLAIR", pathology="acute_infarct", seed=3)
    assert vol.shape == (24, 24, 24)
    assert vol.dtype == np.float32
    assert 0.0 <= float(vol.min()) and float(vol.max()) <= 1.0


def test_procedural_generator_deterministic():
    gen = ProceduralLesionGenerator(size=20)
    a = gen.generate(sequence="T1", pathology="mass_effect", seed=11)
    b = gen.generate(sequence="T1", pathology="mass_effect", seed=11)
    assert np.allclose(a, b)


def test_lesion_changes_volume():
    gen = ProceduralLesionGenerator(size=24)
    healthy = gen.generate(sequence="FLAIR", pathology="missing_modality", seed=5)
    lesion = gen.generate(sequence="FLAIR", pathology="acute_infarct", seed=5)
    assert float(np.abs(lesion - healthy).sum()) > 0.0   # lesion injected


def test_missing_modality_synthesis():
    gen = ProceduralLesionGenerator(size=20)
    t1 = gen.generate(sequence="T1", pathology="missing_modality", seed=2)
    flair = gen.synthesize_missing_modality(t1, source_seq="T1", target_seq="FLAIR")
    assert flair.shape == t1.shape
    assert not np.allclose(flair, t1)                    # contrast remapped


def test_generate_volume_returns_tagged_sample_and_array():
    aug = SyntheticAugmentor(volume_generator=ProceduralLesionGenerator(size=16))
    sample, vol = aug.generate_volume(sequence="SWI", pathology="intracranial_hemorrhage", seed=1)
    assert SYNTHETIC_TAG in sample.tags
    assert vol.shape == (16, 16, 16)


def test_nv_generate_backend_unavailable_without_weights():
    nv = NVGenerateMRBrainGenerator(weights_dir=None)
    assert nv.available() is False
    with pytest.raises(RuntimeError):
        nv.load()


# --- ablation (acceptance #3) ----------------------------------------------- #
def test_rare_class_ablation_shows_measurable_gain():
    out = run_rare_class_ablation(
        in_dim=64, n_train=2000, n_test=1500, n_synth=400, steps=250, seed=0,
    )
    # synthetic data tagged + isolated from any patient view (§7.5)
    assert out["synthetic_tag"] == SYNTHETIC_TAG
    assert out["synthetic_isolated_from_patient_view"] is True
    # augmentation must lift rare-class sensitivity (acceptance #3)
    assert out["augmented"]["sensitivity"] > out["baseline"]["sensitivity"]
    assert out["rare_class_gain"] is True
