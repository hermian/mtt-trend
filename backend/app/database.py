"""
Database engine and session management.
SQLite database stored at backend/db/trends.sqlite.
"""

import os
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Resolve DB path relative to this file's location (backend/app/database.py)
_BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = _BASE_DIR / "db" / "trends.sqlite"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables() -> None:
    """Create all tables and indexes defined in models."""
    from app.models import ThemeDaily, ThemeStockDaily  # noqa: F401 - trigger metadata
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # Ensure indexes exist
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_td_date ON theme_daily(date)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_tsd_stock ON theme_stock_daily(stock_name, date)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_tsd_theme_date ON theme_stock_daily(theme_name, date)"
        ))
        # SPEC-MTT-006: 인덱스 추가 - first_seen_date 기반 조회 성능 최적화
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_stock_first_seen ON theme_stock_daily(stock_name, date, data_source)"
        ))

        # Migrate: add data_source column if it doesn't exist (for existing DBs)
        for table, col, default in [
            ("theme_daily", "data_source", "52w_high"),
            ("theme_stock_daily", "data_source", "52w_high"),
        ]:
            try:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN data_source TEXT NOT NULL DEFAULT '{default}'"
                ))
            except Exception:
                pass  # Column already exists

        conn.commit()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
