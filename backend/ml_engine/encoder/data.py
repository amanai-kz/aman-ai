"""Real 3D MRI volume datasets (NIfTI) for training the model stages.

Replaces the synthetic placeholder with genuine brain-MRI volumes. The loader
reads NIfTI (``.nii`` / ``.nii.gz``), resamples to the encoder's ``img_size``,
and applies per-volume intensity standardisation (z-score) — the same contract
``SyntheticMRIVolumes`` exposes, so any train loop swaps data with one flag.

``fetch_ixi_tiny`` pulls TorchIO's **IXITiny** — a small, openly licensed subset
of the IXI brain-MRI dataset (CC BY-SA 3.0) — so training runs on real volumes
today. For the *production* model, point ``--data-dir`` at the
commercially-cleared partner dataset (decision D10); nothing else changes.
"""
from __future__ import annotations

import glob
import os
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import Dataset


def load_nifti(path: str | Path, img_size=(128, 128, 128), in_channels: int = 1) -> torch.Tensor:
    """Load one NIfTI file -> standardised ``(C, D, H, W)`` tensor."""
    import nibabel as nib  # lazy
    arr = nib.load(str(path)).get_fdata(dtype="float32")
    vol = torch.from_numpy(arr)
    while vol.ndim < 3:
        vol = vol.unsqueeze(-1)
    vol = vol[..., 0] if vol.ndim == 4 else vol
    vol = vol.reshape(vol.shape[0], vol.shape[1], vol.shape[2])
    vol = F.interpolate(vol[None, None], size=tuple(img_size), mode="trilinear",
                        align_corners=False)[0]
    if in_channels > 1:
        vol = vol.expand(in_channels, *tuple(img_size)).contiguous()
    return (vol - vol.mean()) / (vol.std() + 1e-6)


class NiftiVolumeDataset(Dataset):
    """Folder of NIfTI volumes -> standardised ``(C, D, H, W)`` tensors."""

    def __init__(self, root: str | Path, img_size=(128, 128, 128),
                 in_channels: int = 1, pattern: str = "**/*.nii*",
                 cache: bool = True):
        self.paths = sorted(glob.glob(os.path.join(str(root), pattern), recursive=True))
        if not self.paths:
            raise FileNotFoundError(f"no NIfTI volumes under {root} (pattern {pattern})")
        self.img_size = tuple(img_size)
        self.in_channels = in_channels
        self._cache: dict[int, torch.Tensor] = {} if cache else None

    def __len__(self) -> int:
        return len(self.paths)

    def __getitem__(self, idx: int) -> torch.Tensor:
        if self._cache is not None and idx in self._cache:
            return self._cache[idx]
        import nibabel as nib  # lazy: keep nibabel optional
        arr = nib.load(self.paths[idx]).get_fdata(dtype="float32")
        vol = torch.from_numpy(arr)
        while vol.ndim < 3:
            vol = vol.unsqueeze(-1)
        vol = vol[..., :1] if vol.ndim == 4 else vol      # drop extra modalities
        vol = vol.reshape(vol.shape[0], vol.shape[1], vol.shape[2])
        vol = F.interpolate(vol[None, None], size=self.img_size, mode="trilinear",
                            align_corners=False)[0]        # (1, D, H, W)
        if self.in_channels > 1:
            vol = vol.expand(self.in_channels, *self.img_size).contiguous()
        vol = (vol - vol.mean()) / (vol.std() + 1e-6)
        if self._cache is not None:
            self._cache[idx] = vol
        return vol


def fetch_ixi_tiny(dest: str | Path) -> str:
    """Download TorchIO's IXITiny (real open brain-MRI T1 subset).

    Returns the directory of ``.nii.gz`` image volumes, suitable for
    :class:`NiftiVolumeDataset`.
    """
    import torchio as tio  # lazy
    dest = Path(dest)
    tio.datasets.IXITiny(str(dest), download=True)
    image_dir = dest / "image"
    if not image_dir.exists():
        # some torchio versions nest differently; fall back to a recursive search
        image_dir = dest
    return str(image_dir)
