"""SQLite-backed persistence for the model registry (SCRUM-27).

Uses only the standard library (``sqlite3``) so the registry runs anywhere with
no extra dependency. Model cards are stored as JSON blobs keyed by ``model_id``;
an append-only ``audit`` table records every lifecycle action (NFR-07).
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterator, Optional

from .models import ModelCard


class RegistryStore:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.db_path))
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS models (
                model_id    TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                version     TEXT NOT NULL,
                stage       TEXT,
                lifecycle   TEXT NOT NULL,
                card        TEXT NOT NULL,
                updated_at  TEXT
            );
            CREATE TABLE IF NOT EXISTS audit (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                model_id    TEXT NOT NULL,
                action      TEXT NOT NULL,
                detail      TEXT,
                at          TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_models_lifecycle ON models(lifecycle);
            CREATE INDEX IF NOT EXISTS idx_audit_model ON audit(model_id);
            """
        )
        self._conn.commit()

    # ---- model cards -------------------------------------------------------
    def upsert(self, card: ModelCard) -> None:
        self._conn.execute(
            """INSERT INTO models (model_id, name, version, stage, lifecycle, card, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(model_id) DO UPDATE SET
                 stage=excluded.stage, lifecycle=excluded.lifecycle,
                 card=excluded.card, updated_at=excluded.updated_at""",
            (
                card.model_id, card.name, card.version, card.stage,
                card.lifecycle.value, json.dumps(card.to_dict()), card.updated_at,
            ),
        )
        self._conn.commit()

    def get(self, model_id: str) -> Optional[ModelCard]:
        row = self._conn.execute(
            "SELECT card FROM models WHERE model_id = ?", (model_id,)
        ).fetchone()
        return ModelCard.from_dict(json.loads(row["card"])) if row else None

    def list(self, *, name: Optional[str] = None, lifecycle: Optional[str] = None,
             stage: Optional[str] = None) -> list[ModelCard]:
        q = "SELECT card FROM models WHERE 1=1"
        params: list[Any] = []
        if name:
            q += " AND name = ?"; params.append(name)
        if lifecycle:
            q += " AND lifecycle = ?"; params.append(lifecycle)
        if stage:
            q += " AND stage = ?"; params.append(stage)
        q += " ORDER BY updated_at DESC"
        rows = self._conn.execute(q, params).fetchall()
        return [ModelCard.from_dict(json.loads(r["card"])) for r in rows]

    def delete(self, model_id: str) -> None:
        self._conn.execute("DELETE FROM models WHERE model_id = ?", (model_id,))
        self._conn.commit()

    # ---- audit -------------------------------------------------------------
    def audit(self, model_id: str, action: str, detail: str, at: str) -> None:
        self._conn.execute(
            "INSERT INTO audit (model_id, action, detail, at) VALUES (?, ?, ?, ?)",
            (model_id, action, detail, at),
        )
        self._conn.commit()

    def audit_log(self, model_id: Optional[str] = None) -> list[dict[str, Any]]:
        if model_id:
            rows = self._conn.execute(
                "SELECT * FROM audit WHERE model_id = ? ORDER BY id", (model_id,)
            ).fetchall()
        else:
            rows = self._conn.execute("SELECT * FROM audit ORDER BY id").fetchall()
        return [dict(r) for r in rows]

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "RegistryStore":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()
