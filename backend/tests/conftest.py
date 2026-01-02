import os
import asyncio
import sys
from pathlib import Path

# Use a local SQLite database for tests to avoid external dependencies
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")


# Ensure backend package is importable during tests
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def pytest_sessionstart(session):  # noqa: D401
    """Clean test database file before running the suite."""
    db_file = Path("./test.db")
    try:
        from app import models
        from app.db import engine

        asyncio.run(engine.dispose())

        async def _drop_all():
            async with engine.begin() as conn:
                await conn.run_sync(models.Base.metadata.drop_all)

        asyncio.run(_drop_all())
    except Exception:
        pass
    if db_file.exists():
        try:
            db_file.unlink()
        except PermissionError:
            pass
    from app.db import init_db

    asyncio.run(init_db())
