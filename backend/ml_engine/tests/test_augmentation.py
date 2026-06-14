"""Tests for synthetic-data tagging & isolation (SCRUM-25, §7.5)."""
import pytest

from ml_engine.augmentation import (
    SyntheticAugmentor, SyntheticSample, SYNTHETIC_TAG,
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
