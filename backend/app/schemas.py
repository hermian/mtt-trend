"""
Pydantic response schemas for the 52-week high theme trend dashboard API.
"""

from __future__ import annotations

from typing import List, Optional, Dict
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# /api/charts/data
# ---------------------------------------------------------------------------

class ChartDataPoint(BaseModel):
    time: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    # 동적 지표 필드 (RSI, MACD 등)
    indicators: Optional[Dict[str, float]] = None


class ChartDataResponse(BaseModel):
    symbol: str
    data: List[ChartDataPoint]


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
    # SPEC-MTT-017: 등락률 (조회 윈도우 내 가장 최신 날짜 기준)
    change_pct: Optional[float] = None
    # SPEC-MTT-017: 테마RS변화 (소속 테마들의 RS변화량 평균)
    theme_rs_change: Optional[float] = None


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


# ---------------------------------------------------------------------------
# /api/themes/{name}/stocks
# ---------------------------------------------------------------------------

class ThemeStockItem(_Base):
    stock_name: str
    rs_score: Optional[int] = None
    change_pct: Optional[float] = None


class ThemeStocksResponse(BaseModel):
    theme_name: str
    date: str
    stocks: List[ThemeStockItem]


# ---------------------------------------------------------------------------
# /api/intersection
# ---------------------------------------------------------------------------

class IntersectionStockItem(BaseModel):
    stock_name: str
    rs_score_52w: Optional[int] = None
    rs_score_mtt: Optional[int] = None
    change_pct_52w: Optional[float] = None
    change_pct_mtt: Optional[float] = None


class IntersectionThemeItem(BaseModel):
    theme_name: str
    intersection_stock_count: int
    avg_rs_52w: Optional[float] = None
    avg_rs_mtt: Optional[float] = None
    stock_count_52w: int
    stock_count_mtt: int
    intersection_stocks: List[IntersectionStockItem]


class IntersectionResponse(BaseModel):
    date: str
    theme_count: int
    total_stock_count: int
    themes: List[IntersectionThemeItem]
