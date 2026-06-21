"""Tests for DICOM ingestion + de-identification (data pipeline)."""
import pytest

torch = pytest.importorskip("torch")
pydicom = pytest.importorskip("pydicom")

from ml_engine.ingestion import deidentify, has_phi, pseudonymise, series_to_volume


def _phi_dataset():
    ds = pydicom.dataset.Dataset()
    ds.PatientName = "DOE^JOHN"
    ds.PatientID = "REAL-PATIENT-123"
    ds.PatientBirthDate = "19700101"
    ds.InstitutionName = "Almaty Central Hospital"
    ds.ReferringPhysicianName = "SMITH^JANE"
    ds.Modality = "MR"
    return ds


def test_pseudonymise_is_deterministic_and_opaque():
    a = pseudonymise("REAL-PATIENT-123")
    assert a == pseudonymise("REAL-PATIENT-123")        # stable
    assert "REAL-PATIENT-123" not in a and len(a) == 16  # opaque


def test_deidentify_strips_all_phi():
    ds = _phi_dataset()
    assert has_phi(ds)                                   # PHI present before
    pseudo = deidentify(ds)
    assert not has_phi(ds)                               # all PHI tags blanked
    assert ds.PatientID == pseudo and pseudo != "REAL-PATIENT-123"
    assert ds.PatientIdentityRemoved == "YES"


def _write_slice(path, z, pid="REAL-123"):
    import numpy as np
    from pydicom.dataset import FileDataset, FileMetaDataset
    from pydicom.uid import ExplicitVRLittleEndian, generate_uid, MRImageStorage

    fm = FileMetaDataset()
    fm.MediaStorageSOPClassUID = MRImageStorage
    fm.MediaStorageSOPInstanceUID = generate_uid()
    fm.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = FileDataset(str(path), {}, file_meta=fm, preamble=b"\0" * 128)
    ds.PatientName, ds.PatientID, ds.Modality = "DOE^JOHN", pid, "MR"
    ds.SeriesDescription, ds.InstanceNumber = "T1", z
    ds.ImagePositionPatient = [0, 0, float(z)]
    ds.PixelSpacing, ds.SliceThickness = [1.0, 1.0], 1.0
    ds.Rows = ds.Columns = 8
    ds.BitsAllocated = ds.BitsStored = 16
    ds.HighBit, ds.SamplesPerPixel, ds.PixelRepresentation = 15, 1, 0
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.PixelData = (np.random.rand(8, 8) * 255).astype("uint16").tobytes()
    try:
        ds.save_as(str(path), enforce_file_format=True)   # pydicom >= 3
    except TypeError:
        ds.save_as(str(path), write_like_original=False)  # pydicom < 3


def test_series_to_volume_deidentified(tmp_path):
    try:
        for z in range(4):
            _write_slice(tmp_path / f"s{z}.dcm", z)
    except Exception as exc:  # pydicom version quirks writing files
        pytest.skip(f"could not write test DICOM: {exc}")
    vol, manifest = series_to_volume(tmp_path, img_size=(16, 16, 16))
    assert vol.shape == (1, 16, 16, 16)
    assert manifest.deidentified and manifest.n_slices == 4
    assert manifest.license_cleared is False             # not cleared by default
    assert "REAL-123" not in manifest.pseudo_id
