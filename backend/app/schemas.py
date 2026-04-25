from pydantic import BaseModel
from typing import List, Dict, Optional

# --- Common/General Schemas ---
class DatesResponse(BaseModel):
    dates: List[str]

# --- Chart Schemas ---
class ChartDataPoint(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = 0
    indicators: Optional[Dict[str, float]] = None

class ChartDataResponse(BaseModel):
    symbol: str
    data: List[ChartDataPoint]

# --- Theme Schemas ---
class ThemeDailyItem(BaseModel):
    name: str
    count: int
    avg_change: float
    stocks: List[str]

class ThemeDailyResponse(BaseModel):
    date: str
    source: str
    themes: List[ThemeDailyItem]

class ThemeSurgingItem(BaseModel):
    name: str
    count: int
    avg_change: float
    prev_count: Optional[int] = 0

class ThemeSurgingResponse(BaseModel):
    date: str
    themes: List[ThemeSurgingItem]

class ThemeHistoryItem(BaseModel):
    date: str
    count: int
    avg_change: float

class ThemeHistoryResponse(BaseModel):
    name: str
    history: List[ThemeHistoryItem]

class ThemeStockItem(BaseModel):
    symbol: str
    name: str
    change_pct: float
    rank: int

class ThemeStocksResponse(BaseModel):
    theme_name: str
    date: str
    stocks: List[ThemeStockItem]

# --- Stock Schemas ---
class PersistentStockItem(BaseModel):
    symbol: str
    name: str
    appearances: int
    dates: List[str]
    last_change: float

class PersistentStocksResponse(BaseModel):
    days: int
    min_appearances: int
    stocks: List[PersistentStockItem]

class GroupActionItem(BaseModel):
    symbol: str
    name: str
    themes: List[str]
    change_pct: float

class GroupActionResponse(BaseModel):
    date: str
    stocks: List[GroupActionItem]

class IntersectionStockItem(BaseModel):
    symbol: str
    name: str
    themes: List[str]

class IntersectionThemeItem(BaseModel):
    name: str
    count: int

class IntersectionResponse(BaseModel):
    date: str
    themes: List[IntersectionThemeItem]
    stocks: List[IntersectionStockItem]
