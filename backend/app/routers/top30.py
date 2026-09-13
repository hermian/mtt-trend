"""
시총 TOP 30 추적 대시보드 탭 엔드포인트.

GET /api/trend/top30?date=YYYY-MM-DD&market=all|kospi|kosdaq&compare_days=5
GET /api/trend/top30/dates
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas import (
    Top30DatesResponse,
    Top30MatrixItem,
    Top30MatrixResponse,
    Top30Response,
    Top30Stock,
    Top30DateRankings,
)
from app.utils.stock_heatmap_utils import get_rs_dir
from app.utils.cache_utils import cached_by_mtime
from app.utils.mtime_utils import file_mtime
from app.utils.top30_utils import available_dates, available_periods, compute_top30, compute_top30_matrix

router = APIRouter(prefix="/trend", tags=["top30"])


_ALLOWED_MARKETS = ("all", "kospi", "kosdaq")
_ALLOWED_COMPARE_DAYS = (1, 5, 20, 60)
_ALLOWED_TIMEFRAMES = ("daily", "weekly", "monthly")

# /top30 과 /top30/matrix 는 매 요청 RS 파티션 파켓을 다시 읽는다(실측 43ms / 17ms).
# 장 마감 후 1회 갱신되는 데이터라 rs 디렉터리 mtime 을 무효화 키로 쓴다
# (top30_utils._rs_index 와 같은 기준). 캐시 객체는 요청 간 공유되므로 변형하지 말 것.
_TOP30_CACHE: dict = {}
_TOP30_CACHE_MAX = 16
_TOP30_MATRIX_CACHE: dict = {}
_TOP30_MATRIX_CACHE_MAX = 8


@router.get("/top30/dates", response_model=Top30DatesResponse)
def list_top30_dates(
    timeframe: str = Query("daily", description="기간 단위: daily|weekly|monthly"),
):
    """조회 가능한 거래일/주차/월(파티션) 목록."""
    if timeframe not in _ALLOWED_TIMEFRAMES:
        raise HTTPException(422, detail=f"timeframe must be one of {list(_ALLOWED_TIMEFRAMES)}")
    dates = available_periods(get_rs_dir(), timeframe)
    return Top30DatesResponse(dates=dates)


@router.get("/top30/matrix", response_model=Top30MatrixResponse)
def get_top30_matrix(
    start_date: Optional[str] = Query(None, description="시작일/시작주/시작월"),
    end_date: Optional[str] = Query(None, description="종료일/종료주/종료월"),
    market: str = Query("all", description="시장 필터: all|kospi|kosdaq"),
    timeframe: str = Query("daily", description="기간 단위: daily|weekly|monthly"),
    limit: int = Query(30, description="랭킹 표시 개수 (기본 30)"),
):
    if market not in _ALLOWED_MARKETS:
        raise HTTPException(422, detail=f"market must be one of {list(_ALLOWED_MARKETS)}")
    if timeframe not in _ALLOWED_TIMEFRAMES:
        raise HTTPException(422, detail=f"timeframe must be one of {list(_ALLOWED_TIMEFRAMES)}")

    rs_dir = get_rs_dir()
    periods = available_periods(rs_dir, timeframe)
    if not periods:
        raise HTTPException(503, detail="시가총액 데이터(RS 파티션)가 없습니다")

    valid_start = start_date if (start_date and start_date in periods) else None
    valid_end = end_date if (end_date and end_date in periods) else None

    def _build() -> Top30MatrixResponse:
        result = compute_top30_matrix(rs_dir, valid_start, valid_end, market, timeframe, limit)
        return Top30MatrixResponse(
            market=market,
            timeframe=timeframe,
            dates=[
                Top30DateRankings(
                    date=d["date"],
                    rankings=[Top30MatrixItem(**r) for r in d["rankings"]],
                )
                for d in result["dates"]
            ],
        )

    return cached_by_mtime(
        _TOP30_MATRIX_CACHE,
        _TOP30_MATRIX_CACHE_MAX,
        (valid_start, valid_end, market, timeframe, limit),
        file_mtime(rs_dir),
        _build,
    )


@router.get("/top30", response_model=Top30Response)
def get_top30(
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

    def _build() -> Top30Response:
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

    return cached_by_mtime(
        _TOP30_CACHE,
        _TOP30_CACHE_MAX,
        # date 미지정이면 reference 가 최근일로 해석되므로 해석 후 값을 키로 쓴다.
        (reference, market, compare_days),
        file_mtime(rs_dir),
        _build,
    )
