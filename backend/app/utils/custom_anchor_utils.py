import logging
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from app.schemas import (
    CustomAnchorCreate,
    CustomAnchorUpdate,
    CustomAnchorResponse,
)

logger = logging.getLogger(__name__)


def _invalidate_cache():
    try:
        from app.utils.avwap_utils import invalidate_avwap_cache
        invalidate_avwap_cache()
    except Exception:
        pass



def _get_user_anchors_db_path() -> Path:
    override = os.environ.get("MTT_USER_ANCHORS_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    db_dir = Path.home() / ".cache" / "db"
    db_dir.mkdir(parents=True, exist_ok=True)
    return db_dir / "user_anchors.db"


def _init_db():
    db_path = _get_user_anchors_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS custom_avwap_anchors (
                    id TEXT PRIMARY KEY,
                    market_or_symbol TEXT NOT NULL,
                    anchor_date TEXT NOT NULL,
                    label TEXT,
                    color TEXT NOT NULL,
                    interval_mask TEXT DEFAULT 'ALL',
                    is_active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_custom_anchors_target 
                ON custom_avwap_anchors(market_or_symbol, is_active);
            """)
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to initialize user_anchors.db: {e}", exc_info=True)


TARGET_ALIAS_GROUPS = {
    "dow": ["dow", "dow30", "dji"],
    "dow30": ["dow", "dow30", "dji"],
    "dji": ["dow", "dow30", "dji"],
    "nasdaq": ["nasdaq", "nasdaq100", "ndx"],
    "nasdaq100": ["nasdaq", "nasdaq100", "ndx"],
    "ndx": ["nasdaq", "nasdaq100", "ndx"],
    "sp500": ["sp500", "s&p500", "spx", "snp500"],
    "s&p500": ["sp500", "s&p500", "spx", "snp500"],
    "spx": ["sp500", "s&p500", "spx", "snp500"],
    "snp500": ["sp500", "s&p500", "spx", "snp500"],
    "kospi": ["kospi"],
    "kosdaq": ["kosdaq"],
}


def get_target_aliases(target: str) -> List[str]:
    t = target.lower().strip()
    return TARGET_ALIAS_GROUPS.get(t, [t])


def normalize_anchor_date(date_str: str) -> str:
    """Normalize input date like 2026-3-27 or 2026/03/27 to standard YYYY-MM-DD format."""
    clean = date_str.strip().replace("/", "-").replace(".", "-")
    parts = clean.split("-")
    if len(parts) == 3:
        y, m, d = parts[0], parts[1].zfill(2), parts[2].zfill(2)
        return f"{y}-{m}-{d}"
    return clean


def get_custom_anchors(
    market_or_symbol: Optional[str] = None,
    include_inactive: bool = False
) -> List[CustomAnchorResponse]:
    """Retrieve custom anchors for a market/symbol (including all aliases) or all targets."""
    _init_db()
    db_path = _get_user_anchors_db_path()
    res: List[CustomAnchorResponse] = []
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM custom_avwap_anchors WHERE 1=1"
            params: List[Any] = []
            if market_or_symbol:
                aliases = get_target_aliases(market_or_symbol)
                placeholders = ",".join(["?"] * len(aliases))
                query += f" AND lower(market_or_symbol) IN ({placeholders})"
                params.extend(aliases)
            if not include_inactive:
                query += " AND is_active = 1"
            query += " ORDER BY anchor_date ASC, created_at ASC"
            cursor.execute(query, params)
            for row in cursor.fetchall():
                res.append(CustomAnchorResponse(
                    id=row["id"],
                    market_or_symbol=row["market_or_symbol"],
                    anchor_date=normalize_anchor_date(row["anchor_date"]),
                    label=row["label"],
                    color=row["color"],
                    interval_mask=row["interval_mask"] or "ALL",
                    is_active=bool(row["is_active"]),
                    created_at=str(row["created_at"]) if row["created_at"] else None,
                    updated_at=str(row["updated_at"]) if row["updated_at"] else None,
                ))
    except Exception as e:
        logger.error(f"Error fetching custom anchors: {e}", exc_info=True)
    return res


def create_custom_anchor(payload: CustomAnchorCreate) -> CustomAnchorResponse:
    """Create or update a custom anchor with normalized target and date."""
    _init_db()
    db_path = _get_user_anchors_db_path()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    target = payload.market_or_symbol.lower().strip()
    color = payload.color.strip() if payload.color else "#ec4899"
    interval_mask = (payload.interval_mask or "ALL").upper().strip()
    norm_date = normalize_anchor_date(payload.anchor_date)
    aliases = get_target_aliases(target)

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        placeholders = ",".join(["?"] * len(aliases))
        cursor.execute(
            f"SELECT id FROM custom_avwap_anchors WHERE lower(market_or_symbol) IN ({placeholders}) AND anchor_date = ?",
            (*aliases, norm_date)
        )
        row = cursor.fetchone()
        if row:
            anchor_id = row["id"]
            cursor.execute(
                """
                UPDATE custom_avwap_anchors
                SET label = ?, color = ?, interval_mask = ?, is_active = 1, updated_at = ?
                WHERE id = ?
                """,
                (payload.label, color, interval_mask, now_str, anchor_id)
            )
        else:
            anchor_id = f"anc_{uuid.uuid4().hex[:12]}"
            cursor.execute(
                """
                INSERT INTO custom_avwap_anchors (
                    id, market_or_symbol, anchor_date, label, color, interval_mask, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (anchor_id, target, norm_date, payload.label, color, interval_mask, now_str, now_str)
            )
        conn.commit()

    _invalidate_cache()

    return CustomAnchorResponse(
        id=anchor_id,
        market_or_symbol=target,
        anchor_date=norm_date,
        label=payload.label,
        color=color,
        interval_mask=interval_mask,
        is_active=True,
        created_at=now_str,
        updated_at=now_str,
    )



def update_custom_anchor(anchor_id: str, payload: CustomAnchorUpdate) -> Optional[CustomAnchorResponse]:
    """Update an existing custom anchor."""
    _init_db()
    db_path = _get_user_anchors_db_path()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM custom_avwap_anchors WHERE id = ?", (anchor_id,))
        row = cursor.fetchone()
        if not row:
            return None

        new_label = payload.label if payload.label is not None else row["label"]
        new_color = payload.color if payload.color is not None else row["color"]
        new_date = normalize_anchor_date(payload.anchor_date) if payload.anchor_date is not None else row["anchor_date"]
        new_mask = payload.interval_mask if payload.interval_mask is not None else row["interval_mask"]
        new_active = int(payload.is_active) if payload.is_active is not None else row["is_active"]

        cursor.execute(
            """
            UPDATE custom_avwap_anchors
            SET label = ?, color = ?, anchor_date = ?, interval_mask = ?, is_active = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_label, new_color, new_date, new_mask, new_active, now_str, anchor_id)
        )
        conn.commit()

        _invalidate_cache()

        return CustomAnchorResponse(
            id=anchor_id,
            market_or_symbol=row["market_or_symbol"],
            anchor_date=new_date,
            label=new_label,
            color=new_color,
            interval_mask=new_mask,
            is_active=bool(new_active),
            created_at=str(row["created_at"]),
            updated_at=now_str,
        )


def delete_custom_anchor(anchor_id: str) -> bool:
    """Delete a custom anchor by ID."""
    _init_db()
    db_path = _get_user_anchors_db_path()
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM custom_avwap_anchors WHERE id = ?", (anchor_id,))
        conn.commit()
        if cursor.rowcount > 0:
            _invalidate_cache()
            return True
        return False


def suppress_system_anchor(market_or_symbol: str, anchor_date: str) -> CustomAnchorResponse:
    """Suppress (hide/delete) a system preset anchor by recording is_active = 0 across aliases."""
    _init_db()
    db_path = _get_user_anchors_db_path()
    target = market_or_symbol.lower().strip()
    aliases = get_target_aliases(target)
    date_clean = normalize_anchor_date(anchor_date)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        placeholders = ",".join(["?"] * len(aliases))
        cursor.execute(
            f"SELECT * FROM custom_avwap_anchors WHERE lower(market_or_symbol) IN ({placeholders}) AND anchor_date = ?",
            (*aliases, date_clean)
        )
        row = cursor.fetchone()
        if row:
            anchor_id = row["id"]
            cursor.execute(
                "UPDATE custom_avwap_anchors SET is_active = 0, updated_at = ? WHERE id = ?",
                (now_str, anchor_id)
            )
        else:
            anchor_id = f"supp_{uuid.uuid4().hex[:10]}"
            cursor.execute(
                """
                INSERT INTO custom_avwap_anchors (
                    id, market_or_symbol, anchor_date, label, color, interval_mask, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'ALL', 0, ?, ?)
                """,
                (anchor_id, target, date_clean, "삭제된 시스템 앵커", "#6b7280", now_str, now_str)
            )
        conn.commit()

    _invalidate_cache()
    return CustomAnchorResponse(
        id=anchor_id,
        market_or_symbol=target,
        anchor_date=date_clean,
        label="삭제된 시스템 앵커",
        color="#6b7280",
        interval_mask="ALL",
        is_active=False,
        created_at=now_str,
        updated_at=now_str,
    )


def reset_all_anchors(market_or_symbol: str) -> bool:
    """Reset all custom additions and system suppressions across all target aliases."""
    _init_db()
    db_path = _get_user_anchors_db_path()
    aliases = get_target_aliases(market_or_symbol)
    placeholders = ",".join(["?"] * len(aliases))
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(f"DELETE FROM custom_avwap_anchors WHERE lower(market_or_symbol) IN ({placeholders})", aliases)
        conn.commit()
        _invalidate_cache()
        return True



