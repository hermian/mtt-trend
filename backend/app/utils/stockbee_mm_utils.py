"""Stockbee Market Monitor — ~/.cache/db/stockbee_mm.db 조회."""

from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

_SELECT_COLS = """
    date,
    bo_up, bo_dn,
    five_d_r, ten_d_r,
    q_up_25p, q_dn_25p,
    m_up_25p, m_dn_25p, m_up_50p, m_dn_50p,
    d34_up_13p, d34_dn_13p,
    t2108, stock_count, kospi
"""


def get_stockbee_mm_db_path() -> Path:
    override = os.environ.get("STOCKBEE_MM_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".cache" / "db" / "stockbee_mm.db"


def _connect_ro(db_path: Path) -> Optional[sqlite3.Connection]:
    if not db_path.exists():
        logger.error(f"Stockbee MM SQLite DB가 존재하지 않습니다: {db_path}")
        return None
    conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='stockbee_mm'
        """
    )
    if cur.fetchone() is None:
        logger.error(f"stockbee_mm 테이블이 없습니다: {db_path}")
        conn.close()
        return None
    return conn


def list_stockbee_mm_years() -> Optional[List[int]]:
    """DB에 존재하는 연도 목록 (내림차순). DB 없으면 None."""
    db_path = get_stockbee_mm_db_path()
    conn = _connect_ro(db_path)
    if conn is None:
        return None
    try:
        rows = conn.execute(
            """
            SELECT DISTINCT CAST(substr(date, 1, 4) AS INTEGER) AS y
            FROM stockbee_mm
            WHERE length(date) >= 4
            ORDER BY y DESC
            """
        ).fetchall()
        return [int(r["y"]) for r in rows if r["y"] is not None]
    except Exception as e:
        logger.error(f"Stockbee MM years 조회 중 에러: {e}")
        return None
    finally:
        conn.close()


def load_stockbee_mm(
    year: Optional[int] = None,
    limit: Optional[int] = None,
) -> Optional[Tuple[List[dict], List[int]]]:
    """
    stockbee_mm 행을 날짜 내림차순으로 반환합니다.

    - year 지정: 해당 연도(YYYY-01-01 ~ YYYY-12-31)
    - year 미지정: DB 최신일 기준 최근 1년(캘린더)
    - limit: 선택적 상한 (테스트용). None이면 제한 없음(연도/1년 범위만)

    Returns: (rows, years) 또는 DB 문제 시 None
    """
    db_path = get_stockbee_mm_db_path()
    conn = _connect_ro(db_path)
    if conn is None:
        return None

    try:
        years_rows = conn.execute(
            """
            SELECT DISTINCT CAST(substr(date, 1, 4) AS INTEGER) AS y
            FROM stockbee_mm
            WHERE length(date) >= 4
            ORDER BY y DESC
            """
        ).fetchall()
        years = [int(r["y"]) for r in years_rows if r["y"] is not None]

        params: list = []
        where = ""
        if year is not None:
            where = "WHERE date >= ? AND date <= ?"
            params.extend([f"{int(year):04d}-01-01", f"{int(year):04d}-12-31"])
        else:
            max_row = conn.execute("SELECT MAX(date) AS d FROM stockbee_mm").fetchone()
            max_date_str = max_row["d"] if max_row else None
            if max_date_str:
                try:
                    max_dt = datetime.strptime(max_date_str[:10], "%Y-%m-%d")
                except ValueError:
                    max_dt = datetime.utcnow()
                start_dt = max_dt - timedelta(days=365)
                where = "WHERE date >= ?"
                params.append(start_dt.strftime("%Y-%m-%d"))

        sql = f"""
            SELECT {_SELECT_COLS}
            FROM stockbee_mm
            {where}
            ORDER BY date DESC
        """
        if limit is not None:
            lim = max(1, min(int(limit), 10_000))
            sql += " LIMIT ?"
            params.append(lim)

        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows], years
    except Exception as e:
        logger.error(f"Stockbee MM DB 조회 중 에러: {e}")
        return None
    finally:
        conn.close()
