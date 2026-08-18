from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Optional, Any, Union

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
    indicators: Optional[Dict[str, Any]] = None

class ChartDataResponse(BaseModel):
    symbol: str
    data: List[ChartDataPoint]

# --- Macro Schemas ---
class MacroDataPoint(BaseModel):
    date: str
    sp500: Optional[float] = None
    nasdaq100: Optional[float] = None
    dow30: Optional[float] = None
    kospi: Optional[float] = None
    high_yield: Optional[float] = None
    cnn_fgi: Optional[float] = None
    kr_fgi: Optional[float] = None
    vix: Optional[float] = None
    vkospi: Optional[float] = None
    pcr: Optional[float] = None
    move: Optional[float] = None
    vxsmh: Optional[float] = None        # Cboe SMH Volatility Index → index_ohlcv(index_name='vxsmh')
    vxn: Optional[float] = None          # Cboe Nasdaq 100 Volatility Index → index_ohlcv(index_name='vxn')
    us_2y: Optional[float] = None
    us_10y: Optional[float] = None
    us_spread: Optional[float] = None
    kr_10y: Optional[float] = None
    usdkrw: Optional[float] = None
    usdjpy: Optional[float] = None
    usdcny: Optional[float] = None
    eurusd: Optional[float] = None
    dxy: Optional[float] = None
    fed_funds: Optional[float] = None
    bok_base: Optional[float] = None
    wti: Optional[float] = None          # Investing CL → index_ohlcv
    brent: Optional[float] = None        # Investing LCO → index_ohlcv
    wti_fred: Optional[float] = None     # FRED DCOILWTICO → fred_macro
    brent_fred: Optional[float] = None   # FRED DCOILBRENTEU → fred_macro
    copper: Optional[float] = None       # Yahoo HG=F → index_ohlcv
    gold: Optional[float] = None         # Yahoo GC=F → index_ohlcv
    silver: Optional[float] = None       # Yahoo SI=F → index_ohlcv
    m2: Optional[float] = None           # FRED M2SL (월간 M2 통화량, 십억 달러) → fred_macro
    gdp: Optional[float] = None          # FRED GDP (명목 GDP, 십억 달러) → fred_macro
    gdp_real: Optional[float] = None     # FRED GDPC1 (실질 GDP, 십억 달러) → fred_macro
    export_avg: Optional[float] = None   # kr_export_avg (FinJump 주간, 조회 시 ffill)
    ism_pmi: Optional[float] = None      # Investing ISM_PMI(발표일 원본) → 조회 시 참조월 정규화+ffill
    credit_kospi: Optional[float] = None       # KOSPI 신용잔고 (조원) — kofia_credit_loan
    credit_kosdaq: Optional[float] = None      # KOSDAQ 신용잔고 (조원) — kofia_credit_loan
    credit_kospi_pct: Optional[float] = None   # KOSPI 신용잔고/시가총액 (%)
    credit_kosdaq_pct: Optional[float] = None  # KOSDAQ 신용잔고/시가총액 (%)
    forced_sell: Optional[float] = None        # 미수금 반대매매 금액 (억원) — kofia_stock_money
    forced_sell_ratio: Optional[float] = None  # 미수금 대비 반대매매 비중 (%)

class MacroDataResponse(BaseModel):
    data: List[MacroDataPoint]


# --- Valuation Bands (PER/PBR) ---
class ValuationBandPoint(BaseModel):
    date: str
    close: Optional[float] = None
    per: Optional[float] = None
    pbr: Optional[float] = None
    div_yd: Optional[float] = None
    bands: Dict[str, Optional[float]]


class ValuationBandsResponse(BaseModel):
    index_name: str
    mode: str  # 'pbr' | 'per'
    multiples: List[float]
    data: List[ValuationBandPoint]


# --- Stockbee Market Monitor ---
class StockbeeMmRow(BaseModel):
    date: str
    bo_up: Optional[float] = None
    bo_dn: Optional[float] = None
    five_d_r: Optional[float] = None
    ten_d_r: Optional[float] = None
    q_up_25p: Optional[float] = None
    q_dn_25p: Optional[float] = None
    m_up_25p: Optional[float] = None
    m_dn_25p: Optional[float] = None
    m_up_50p: Optional[float] = None
    m_dn_50p: Optional[float] = None
    d34_up_13p: Optional[float] = None
    d34_dn_13p: Optional[float] = None
    t2108: Optional[float] = None
    stock_count: Optional[float] = None
    kospi: Optional[float] = None


class StockbeeMmResponse(BaseModel):
    data: List[StockbeeMmRow]
    years: List[int] = []


# --- Market Flow Schemas ---
class MarketFlowPoint(BaseModel):
    date: str
    time: str
    kospi_price: Optional[float] = None
    kospi200_price: Optional[float] = None
    kosdaq_price: Optional[float] = None
    kq150_price: Optional[float] = None
    kospi_foreigner: Optional[float] = None
    kospi_institution: Optional[float] = None
    kospi_individual: Optional[float] = None
    kospi_program: Optional[float] = None
    kosdaq_foreigner: Optional[float] = None
    kosdaq_institution: Optional[float] = None
    kosdaq_individual: Optional[float] = None
    future_foreigner: Optional[float] = None
    future_institution: Optional[float] = None
    future_individual: Optional[float] = None
    emini_nasdaq_price: Optional[float] = None

class MarketFlowResponse(BaseModel):
    data: List[MarketFlowPoint]


# --- Foreign Spot/Futures Flow Schemas (#12) ---
class ForeignFlowPoint(BaseModel):
    date: str
    net: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    ma120: Optional[float] = None
    kospi: Optional[float] = None


class ForeignFlowResponse(BaseModel):
    etf: bool
    data: List[ForeignFlowPoint]


# --- WICS Ranking Schemas ---
class WicsMonthResponse(BaseModel):
    months: List[str]
class WicsWeekResponse(BaseModel):
    weeks: List[str]

class WicsTopStockItem(BaseModel):
    stock_name: str
    stock_code: str
    stock_12m_return: Optional[float] = None
    sector_weight: Optional[float] = None
    marcap: Optional[float] = None
    rank_in_sector: int

class WicsRankingItem(BaseModel):
    WICS: str
    Rank_EW: int
    Rank_MC: int
    EW_12m_Return: Optional[float] = None
    MC_12m_Return: Optional[float] = None
    Top2_Share: Optional[float] = None
    Display_EW: Optional[str] = None
    Display_MC: Optional[str] = None
    top_stocks: Optional[List[WicsTopStockItem]] = None

class WicsMonthRankings(BaseModel):
    YearMonth: str
    rankings: List[WicsRankingItem]

class WicsRankingsResponse(BaseModel):
    months: List[WicsMonthRankings]

class WicsIndexPoint(BaseModel):
    date: str
    EW_Index: Optional[float] = None
    MC_Index: Optional[float] = None

class WicsIndexResponse(BaseModel):
    WICS: str
    data: List[WicsIndexPoint]


class WicsIndexOhlcPoint(BaseModel):
    time: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None


class WicsIndexSectorSeries(BaseModel):
    WICS: str
    points: List[WicsIndexOhlcPoint]


class WicsIndexAllResponse(BaseModel):
    tf: str
    weight: str
    sectors: List[WicsIndexSectorSeries]


class WicsIndexMetaResponse(BaseModel):
    sectors: List[str]
    min_date: Optional[str] = None
    max_date: Optional[str] = None


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

# --- Stock Heatmap Schemas ---
class HeatmapStockItem(BaseModel):
    code: str
    name: str
    market: Optional[str] = None
    marcap: float  # 억원
    ret: Optional[float] = None  # 선택 기간 수익률 (%)
    rs: Optional[int] = None
    mmt: Optional[int] = None
    weight: float  # ∛(시가총액), 트리맵 면적 가중치


class HeatmapGroupItem(BaseModel):
    name: str
    stock_count: int
    avg_return: Optional[float] = None  # 구성종목 단순평균 수익률 (%)
    rs: Optional[int] = None  # 구성종목 RS 평균
    weight: float  # 구성종목 weight 합계
    stocks: List[HeatmapStockItem]


class StockHeatmapResponse(BaseModel):
    as_of_date: Optional[str] = None
    as_of_time: Optional[str] = None
    grouping: str
    period: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    effective_start_date: Optional[str] = None
    effective_end_date: Optional[str] = None
    marcap_min: Optional[float] = None
    marcap_max: Optional[float] = None
    min_ret: Optional[float] = None
    min_rs: Optional[int] = None
    mmt: Optional[Union[str, List[int], int]] = None
    limit: int = 0
    stock_count: int
    groups: List[HeatmapGroupItem]


# --- AVWAP Chart Schemas ---
class AvwapPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    change_pct: Optional[float] = None
    
    # Dynamic MA overlays (e.g. EMA_10, SMA_50, etc.)
    ma: Dict[str, Optional[float]] = {}
    
    vol_ma: Optional[float] = None
    amount: Optional[float] = None          # 거래대금 (조원)
    amount_sma50: Optional[float] = None    # 거래대금 SMA (조원)
    bb_upper: Optional[float] = None
    vix_fix: Optional[float] = None
    rsi: Optional[float] = None
    mdd: Optional[float] = None
    h52_chg: Optional[float] = None
    dd_52w: Optional[float] = None
    dd_3y: Optional[float] = None
    
    vwap: Optional[float] = None
    hvwap: Optional[float] = None
    lvwap: Optional[float] = None


class AvwapAnchorValue(BaseModel):
    date: str
    value: float


class AvwapAnchorSeries(BaseModel):
    id: str
    name: str
    anchor_date: str
    color: str
    values: List[AvwapAnchorValue]


class StockSearchResult(BaseModel):
    code: str
    name: str
    market: str


class AvwapChartResponse(BaseModel):
    market: str
    symbol: Optional[str] = None
    name: Optional[str] = None
    interval: str
    amount_unit: str = "조원"
    points: List[AvwapPoint]
    anchors: List[AvwapAnchorSeries]
    preset_dates: List[str]


class CustomAnchorCreate(BaseModel):
    market_or_symbol: str
    anchor_date: str
    label: Optional[str] = None
    color: str = "#ec4899"
    interval_mask: str = "ALL"


class CustomAnchorUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    anchor_date: Optional[str] = None
    interval_mask: Optional[str] = None
    is_active: Optional[bool] = None


class CustomAnchorResponse(BaseModel):
    id: str
    market_or_symbol: str
    anchor_date: str
    label: Optional[str] = None
    color: str
    interval_mask: str = "ALL"
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# --- 시총 TOP 30 (Market Cap Ranking) ---
class Top30Stock(BaseModel):
    code: str
    name: str
    market: str
    marcap: Optional[float] = None  # 천억원 단위
    rank: int
    previous_rank: Optional[int] = None
    rank_delta: Optional[int] = None  # previous_rank - rank (양수 = 상승)
    new_entrant: bool = False
    series: List[Optional[int]] = []  # window 날짜별 TOP30 랭킹 (없으면 null)


class Top30Response(BaseModel):
    date: str
    market: str
    compare_days: int
    compare_date: Optional[str] = None
    compare_available: bool = True
    window_dates: List[str] = []
    stocks: List[Top30Stock]


class Top30DatesResponse(BaseModel):
    dates: List[str]


class Top30MatrixItem(BaseModel):
    code: str
    name: str
    market: str
    marcap: Optional[float] = None  # 천억원 단위
    rank: int
    previous_rank: Optional[int] = None
    rank_delta: Optional[int] = None  # previous_rank - rank (양수 = 상승)
    new_entrant: bool = False
    sector: Optional[str] = None


class Top30DateRankings(BaseModel):
    date: str
    rankings: List[Top30MatrixItem]


class Top30MatrixResponse(BaseModel):
    market: str
    timeframe: str = "daily"
    dates: List[Top30DateRankings]


# --- 종목/ETF 수익률 비교 (Return Comparison) ---
class ReturnComparisonItem(BaseModel):
    code: str
    name: Optional[str] = None
    market: Optional[str] = None  # KOSPI, KOSDAQ, ETF, US, US_ETF, etc.
    type: Optional[str] = None    # stock, etf, us_stock, us_etf


class ReturnComparisonRequest(BaseModel):
    items: List[ReturnComparisonItem]
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD


class ReturnDataPoint(BaseModel):
    date: str
    close: float
    return_pct: float  # 누적 수익률 (%)


class ReturnSeries(BaseModel):
    code: str
    name: str
    market: str
    type: str
    currency: str  # KRW or USD
    color: Optional[str] = None
    data: List[ReturnDataPoint] = []


class ReturnStatistics(BaseModel):
    code: str
    name: str
    start_price: Optional[float] = None
    end_price: Optional[float] = None
    currency: str = "KRW"
    return_1w: Optional[float] = None
    return_1m: Optional[float] = None
    return_3m: Optional[float] = None
    return_6m: Optional[float] = None
    return_1y: Optional[float] = None
    return_ytd: Optional[float] = None
    period_return: Optional[float] = None
    max_return: Optional[float] = None
    min_return: Optional[float] = None
    mean_return: Optional[float] = None
    volatility: Optional[float] = None


class CorrelationMatrix(BaseModel):
    labels: List[str]
    matrix: List[List[Optional[float]]]


class RollingCorrelationPoint(BaseModel):
    date: str
    corr: float


class RollingCorrelationPair(BaseModel):
    pair: str
    data: List[RollingCorrelationPoint] = []


class ReturnComparisonResponse(BaseModel):
    start_date: str
    end_date: str
    series: List[ReturnSeries] = []
    statistics: List[ReturnStatistics] = []
    correlations: Dict[str, Optional[CorrelationMatrix]] = {}
    rolling_correlations: Dict[str, List[RollingCorrelationPair]] = {}


