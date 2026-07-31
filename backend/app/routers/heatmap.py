from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas import StockHeatmapResponse
from app.utils.stock_heatmap_utils import (
    PERIOD_TRADING_DAYS,
    VALID_GROUPINGS,
    shape_heatmap,
)

router = APIRouter(prefix="/heatmap", tags=["heatmap"])


@router.get("/stocks", response_model=StockHeatmapResponse)
async def get_stock_heatmap(
    grouping: str = Query("sector", description="그룹 기준: sector | industry | theme"),
    period: str = Query("1M", description="수익률 기간: 1D | 5D | 1M | 3M | 6M | 12M"),
    marcap_min: Optional[float] = Query(None, description="시가총액 하한 (억원)"),
    marcap_max: Optional[float] = Query(None, description="시가총액 상한 (억원)"),
    limit: int = Query(0, ge=0, description="표시 개수: 0=전체, 그 외=시가총액 상위 N"),
):
    """
    한국 주식 히트맵 데이터.

    최신 RS 유니버스(~/.cache/db/rs) 기준으로 그룹별(섹터/WICS 산업/테마)
    종목 목록과 선택 기간의 수익률·RS·시가총액을 반환합니다.
    """
    if grouping not in VALID_GROUPINGS:
        raise HTTPException(
            status_code=400,
            detail=f"grouping must be one of {list(VALID_GROUPINGS)}",
        )
    if period not in PERIOD_TRADING_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"period must be one of {list(PERIOD_TRADING_DAYS)}",
        )
    try:
        return shape_heatmap(
            grouping=grouping,
            period=period,
            marcap_min=marcap_min,
            marcap_max=marcap_max,
            limit=limit,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"데이터 파일을 찾을 수 없습니다: {e}")
