from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas import StockHeatmapResponse
from app.utils.cache_utils import cached_by_mtime
from app.utils.mtime_utils import newest_mtime
from app.utils.stock_heatmap_utils import (
    PERIOD_TRADING_DAYS,
    VALID_COLOR_BY,
    VALID_GROUPINGS,
    VALID_SIZE_BY,
    PriceDbLockedError,
    shape_heatmap,
    stock_heatmap_sources,
)

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

_STOCK_HEATMAP_CACHE: dict = {}
_STOCK_HEATMAP_CACHE_MAX = 32


@router.get("/stocks", response_model=StockHeatmapResponse)
def get_stock_heatmap(
    grouping: str = Query(
        "sector",
        description="그룹 기준: sector | industry | theme | theme2 | kospi | kosdaq",
    ),
    period: str = Query("1M", description="수익률 기간: 1D | 5D | 1M | 3M | 6M | 12M | CUSTOM"),
    size_by: str = Query("marcap", description="크기 기준: marcap (시가총액) | trade_value (거래대금)"),
    color_by: str = Query("return", description="색상 기준: return (주가 수익률) | trade_value_growth (거래대금 증가율)"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    marcap_min: Optional[float] = Query(None, description="시가총액 하한 (억원)"),
    marcap_max: Optional[float] = Query(None, description="시가총액 상한 (억원)"),
    trade_value_min: Optional[float] = Query(None, description="최소 거래대금 하한 (억원)"),
    min_trade_value_growth: Optional[float] = Query(None, description="최소 거래대금 증가율 하한 (%)"),
    min_ret: Optional[float] = Query(None, description="최소 수익률 (%)"),
    min_rs: Optional[int] = Query(None, description="최소 RS Rating (0~99)"),
    mmt: Optional[str] = Query(None, description="MMT 필터 (복수 선택 시 콤마 구분: 예: '1,2,3' 또는 '-2,1')"),
    limit: int = Query(0, ge=0, description="표시 개수: 0=전체, 그 외=상위 N"),
):
    """
    한국 주식 히트맵 데이터.

    최신 RS 유니버스(~/.cache/db/rs) 기준으로 그룹별(섹터/WICS 산업/테마/테마2/KOSPI/KOSDAQ)
    종목 목록과 선택 기간(또는 시작일~종료일 지정)의 수익률·RS·시가총액·거래대금을 반환합니다.
    """
    # Sanitize query parameter defaults if called directly outside FastAPI injection
    if not isinstance(size_by, str):
        size_by = "marcap"
    if not isinstance(color_by, str):
        color_by = "return"
    if not isinstance(start_date, str):
        start_date = None
    if not isinstance(end_date, str):
        end_date = None
    if not isinstance(marcap_min, (int, float)):
        marcap_min = None
    if not isinstance(marcap_max, (int, float)):
        marcap_max = None
    if not isinstance(trade_value_min, (int, float)):
        trade_value_min = None
    if not isinstance(min_trade_value_growth, (int, float)):
        min_trade_value_growth = None
    if not isinstance(min_ret, (int, float)):
        min_ret = None
    if not isinstance(min_rs, int):
        min_rs = None
    if not isinstance(mmt, str):
        mmt = None
    if not isinstance(limit, int):
        limit = 0

    if grouping not in VALID_GROUPINGS:
        raise HTTPException(
            status_code=400,
            detail=f"grouping must be one of {list(VALID_GROUPINGS)}",
        )
    if size_by not in VALID_SIZE_BY:
        raise HTTPException(
            status_code=400,
            detail=f"size_by must be one of {list(VALID_SIZE_BY)}",
        )
    if color_by not in VALID_COLOR_BY:
        raise HTTPException(
            status_code=400,
            detail=f"color_by must be one of {list(VALID_COLOR_BY)}",
        )
    if start_date:
        period = "CUSTOM"
    if period != "CUSTOM" and period not in PERIOD_TRADING_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"period must be one of {list(PERIOD_TRADING_DAYS)} or CUSTOM",
        )
    cache_key = (
        grouping,
        period,
        size_by,
        color_by,
        start_date,
        end_date,
        marcap_min,
        marcap_max,
        trade_value_min,
        min_trade_value_growth,
        min_ret,
        min_rs,
        mmt,
        limit,
    )
    try:
        return cached_by_mtime(
            _STOCK_HEATMAP_CACHE,
            _STOCK_HEATMAP_CACHE_MAX,
            cache_key,
            newest_mtime(*stock_heatmap_sources()),
            lambda: shape_heatmap(
                grouping=grouping,
                period=period,
                size_by=size_by,
                color_by=color_by,
                start_date=start_date,
                end_date=end_date,
                marcap_min=marcap_min,
                marcap_max=marcap_max,
                trade_value_min=trade_value_min,
                min_trade_value_growth=min_trade_value_growth,
                min_ret=min_ret,
                min_rs=min_rs,
                mmt=mmt,
                limit=limit,
            ),
            should_cache=bool,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"데이터 파일을 찾을 수 없습니다: {e}")
    except PriceDbLockedError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

