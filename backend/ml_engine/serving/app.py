"""FastAPI inference service for the MRI AI engine (§7.5).

Exposes the trained models behind HTTP so the product can request triage flags
and draft reports for a study, while the radiologist remains in the loop
(assistive only, decision D2). Mountable standalone or as a sub-app of the main
FastAPI backend — it does not touch auth/DB, which the platform owns.

    uvicorn ml_engine.serving.app:create_default_app --factory
"""
import os
import tempfile
from typing import Optional

from .engine import InferenceEngine


def create_app(engine: Optional[InferenceEngine] = None):
    from fastapi import FastAPI, File, UploadFile, HTTPException

    from ..encoder.data import load_nifti
    from ..registry import ModelRegistry

    app = FastAPI(title="Aman AI — MRI Engine", version="1.0.0")
    state = {"engine": engine}

    def _engine() -> InferenceEngine:
        if state["engine"] is None:
            raise HTTPException(503, "no model loaded; set AMAN_ML_ENCODER_CKPT / "
                                     "AMAN_ML_TRIAGE_CKPT or attach an engine")
        return state["engine"]

    @app.get("/healthz")
    def healthz():
        return {"status": "ok", "model_loaded": state["engine"] is not None}

    @app.get("/models")
    def models():
        cards = ModelRegistry().list()
        return [{"model": c.model_id, "stage": c.stage,
                 "lifecycle": c.lifecycle.value, "locked": c.locked} for c in cards]

    def _volume_from_upload(file: UploadFile, engine: InferenceEngine):
        suffix = ".nii.gz" if file.filename and file.filename.endswith(".gz") else ".nii"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(file.file.read())
            tmp.flush()
            return load_nifti(tmp.name, img_size=engine.encoder.cfg.img_size,
                              in_channels=engine.encoder.cfg.in_channels)

    @app.post("/triage")
    def triage(file: UploadFile = File(...)):
        engine = _engine()
        try:
            vol = _volume_from_upload(file, engine)
        except Exception as exc:                       # noqa: BLE001
            raise HTTPException(400, f"could not read volume: {exc}")
        r = engine.triage_study(vol)
        return {"per_finding": r.per_finding, "severity": r.severity,
                "abstain": r.abstain, "top_finding": r.top_finding,
                "disclaimer": "assistive output — requires radiologist sign-off"}

    @app.post("/report")
    def report(file: UploadFile = File(...), prompt: str = "Findings:"):
        engine = _engine()
        if engine.report_generator is None:
            raise HTTPException(501, "report generator not loaded")
        vol = _volume_from_upload(file, engine)
        out = engine.report_study(vol, prompt=prompt)
        return {**out, "disclaimer": "draft — requires radiologist sign-off"}

    return app


def create_default_app():
    """Factory that loads checkpoints from ``AMAN_ML_*_CKPT`` env vars if set."""
    enc, tri = os.environ.get("AMAN_ML_ENCODER_CKPT"), os.environ.get("AMAN_ML_TRIAGE_CKPT")
    engine = None
    if enc and tri:
        engine = InferenceEngine.from_checkpoints(enc, tri,
                                                  device=os.environ.get("AMAN_ML_DEVICE", "cpu"))
    return create_app(engine)
