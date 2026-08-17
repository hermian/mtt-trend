"""
시총 TOP 30 추적 대시보드 탭 엔드포인트.

GET /api/trend/top30?date=YYYY-MM-DD&market=all|kospi|kosdaq&compare_days=5
GET /api/trend/top30/dates
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas import Top30DatesResponse, Top30Response, Top30Stock
from app.utils.stock_heatmap_utils import get_rs_dir
from app.utils.top30_utils import available_dates, compute_top30

router = APIRouter(prefix="/trend", tags=["top30"])

_ALLOWED_MARKETS = ("all", "kospi", "kosdaq")
_ALLOWED_COMPARE_DAYS = (1, 5, 20, 60)


@router.get("/top30/dates", response_model=Top30DatesResponse)
async def list_top30_dates():
    """조회 가능한 거래일(파티션) 목록."""
    dates = available_dates(get_rs_dir())
    return Top30DatesResponse(dates=dates)


@router.get("/top30", response_model=Top30Response)
async def get_top30(
    date: Optional[str] = Query(None, description="기준 조회일 (YYYY-MM-DD, 미지정 시 최근일)"),
    market: str = Query("all", description="시장 필터: all|kospi|kosdaq"),
    compare_days: int = Query(5, description="비교 기간(거래일): 1|5|20|60"),
):
    if market not in _ALLOWED_MARKETS:
        raise HTTPException(422, detail=f"market must be one of {list(_ALLOWED_MARKETS)}")
    if compare_days not in _ALLOWED_COMPARE_DAYS:
        raise HTTPException(422, detail=f"compare_days must be one of {list(_ALLOWED_COMPARE_DAYS)}")

    rs_dir = get_rs_dir()
    dates = available_dates(rs_dir)
    if not dates:
        raise HTTPException(503, detail="시가총액 데이터(RS 파티션)가 없습니다")

    reference = date if date is not None else dates[-1]
    if reference not in dates:
        raise HTTPException(422, detail=f"date {reference!r} 는 사용 가능한 거래일이 아닙니다")

    ref_idx = dates.index(reference)
    if ref_idx - compare_days >= 0:
        compare_date = dates[ref_idx - compare_days]
        window_dates = dates[ref_idx - compare_days : ref_idx + 1]
    else:
        # 데이터 시작 이전 → 순위 변동/신규 진입 정보 없는 graceful 처리
        compare_date = None
        window_dates = dates[: ref_idx + 1]

    result = compute_top30(rs_dir, reference, compare_date, market, window_dates)

    return Top30Response(
        date=reference,
        market=market,
        compare_days=compare_days,
        compare_date=result["compare_date"],
        compare_available=result["compare_available"],
        window_dates=window_dates,
        stocks=[Top30Stock(**s) for s in result["stocks"]],
    )