import sys
from pathlib import Path

# Make `import ml_engine...` work when tests run from anywhere in the repo.
BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import pytest

from ml_engine.config import MLEngineSettings, EvalGates


@pytest.fixture
def tmp_settings(tmp_path) -> MLEngineSettings:
    """Isolated registry DB + artifacts per test."""
    return MLEngineSettings(
        artifacts_root=tmp_path / "artifacts",
        registry_db=tmp_path / "registry.db",
    )


@pytest.fixture
def lenient_gates() -> EvalGates:
    """Gates low enough that the synthetic 'good model' fixture passes."""
    return EvalGates(
        radgraph_f1_min=0.30, chexbert_f1_min=0.40,
        triage_sensitivity_min=0.90, triage_auroc_min=0.70,
        ece_max=0.30, fairness_max_gap=0.50,
    )
