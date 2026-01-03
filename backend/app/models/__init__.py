"""ORM models."""

from app.db import Base
from app.models.encounter import Encounter

__all__ = ["Base", "Encounter"]
