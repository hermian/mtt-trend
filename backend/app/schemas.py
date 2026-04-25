from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Optional

# --- Common/General Schemas ---
class DatesResponse(BaseModel):
    dates: List[str]

# --- Chart Schemas ---
class ChartDataPoint(BaseModel):
    time: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[float] = 0
    indicators: Optional[Dict[str, float]] = None

class ChartDataResponse(BaseModel):
    symbol: str
    data: List[ChartDataPoint]

# --- Theme Schemas ---
class ThemeDailyItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    date: str
    theme_name: str
    data_source: str
    stock_count: Optional[int] = None
    avg_rs: Optional[float] = None
    change_sum: Optional[float] = None
    volume_sum: Optional[float] = None

class ThemeDailyResponse(BaseModel):
    date: str
    themes: List[ThemeDailyItem]

class ThemeSurgingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
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

class ThemeHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    date: str
    theme_name: str
    avg_rs: Optional[float] = None
    stock_count: Optional[int] = None
    change_sum: Optional[float] = None

class ThemeHistoryResponse(BaseModel):
    theme_name: str
    days: int
    history: List[ThemeHistoryItem]

class ThemeStockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    stock_name: str
    rs_score: Optional[float] = None
    change_pct: Optional[float] = None

class ThemeStocksResponse(BaseModel):
    theme_name: str
    date: str
    stocks: List[ThemeStockItem]

# --- Stock Schemas ---
class PersistentStockItem(BaseModel):
    stock_name: str
    appearance_count: int
    avg_rs: Optional[float] = None
    themes: List[str]
    change_pct: Optional[float] = None
    theme_rs_change: Optional[float] = None

class PersistentStocksResponse(BaseModel):
    days: int
    min_appearances: int
    stocks: List[PersistentStockItem]

class GroupActionItem(BaseModel):
    stock_name: str
    rs_score: Optional[float] = None
    change_pct: Optional[float] = None
    theme_name: str
    theme_rs_change: Optional[float] = None
    first_seen_date: Optional[str] = None
    status_threshold: int

class GroupActionResponse(BaseModel):
    date: str
    stocks: List[GroupActionItem]

class IntersectionStockItem(BaseModel):
    stock_name: str
    rs_score_52w: Optional[float] = None
    rs_score_mtt: Optional[float] = None
    change_pct_52w: Optional[float] = None
    change_pct_mtt: Optional[float] = None

class IntersectionThemeItem(BaseModel):
    theme_name: str
    intersection_stock_count: int
    avg_rs_52w: Optional[float] = None
    avg_rs_mtt: Optional[float] = None
    stock_count_52w: Optional[int] = None
    stock_count_mtt: Optional[int] = None
    intersection_stocks: List[IntersectionStockItem]

class IntersectionResponse(BaseModel):
    date: str
    theme_count: int
    total_stock_count: int
    themes: List[IntersectionThemeItem]
