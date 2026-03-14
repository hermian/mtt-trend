"""
Pydantic response schemas for the 52-week high theme trend dashboard API.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Shared config
# ---------------------------------------------------------------------------

class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# /api/dates
# ---------------------------------------------------------------------------

class DatesResponse(BaseModel):
    dates: List[str]


# ---------------------------------------------------------------------------
# /api/themes/daily
# ---------------------------------------------------------------------------

class ThemeDailyItem(_Base):
    date: str
    theme_name: str
    stock_count: Optional[int] = None
    avg_rs: Optional[float] = None
    change_sum: Optional[float] = None
    volume_sum: Optional[float] = None


class ThemeDailyResponse(BaseModel):
    date: str
    themes: List[ThemeDailyItem]


# ---------------------------------------------------------------------------
# /api/themes/surging
# ---------------------------------------------------------------------------

class ThemeSurgingItem(_Base):
    date: str
    theme_name: str
    stock_count: Optional[int] = None
    avg_rs: Optional[float] = None
    avg_rs_5d: Optional[float] = None
    rs_change: Optional[float] = None
    change_sum: Optional[float] = None
    volume_sum: Optional[float] = None


class ThemeSurgingResponse(BaseModel):
    date: str
    threshold: float
    themes: List[ThemeSurgingItem]


# ---------------------------------------------------------------------------
# /api/themes/{name}/history
# ---------------------------------------------------------------------------

class ThemeHistoryItem(_Base):
    date: str
    theme_name: str
    avg_rs: Optional[float] = None
    stock_count: Optional[int] = None
    change_sum: Optional[float] = None


class ThemeHistoryResponse(BaseModel):
    theme_name: str
    days: int
    history: List[ThemeHistoryItem]


# ---------------------------------------------------------------------------
# /api/stocks/persistent
# ---------------------------------------------------------------------------

class PersistentStockItem(BaseModel):
    stock_name: str
    appearance_count: int
    avg_rs: Optional[float] = None
    themes: List[str]


class PersistentStocksResponse(BaseModel):
    days: int
    min_appearances: int
    stocks: List[PersistentStockItem]


# ---------------------------------------------------------------------------
# /api/stocks/group-action
# ---------------------------------------------------------------------------

class GroupActionItem(BaseModel):
    stock_name: str
    rs_score: Optional[int] = None
    change_pct: Optional[float] = None
    theme_name: str
    theme_rs_change: Optional[float] = None
    first_seen_date: Optional[str] = None
    status_threshold: int = 5  # @MX:NOTE: 상태 분류 임계값 (기본값 5)


class GroupActionResponse(BaseModel):
    date: str
    stocks: List[GroupActionItem]
