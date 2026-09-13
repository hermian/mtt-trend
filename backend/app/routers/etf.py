from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.utils.cache_utils import cached_by_mtime
from app.utils.etf_heatmap_utils import etf_heatmap_sources, load_etf_heatmap_data
from app.utils.mtime_utils import newest_mtime

router = APIRouter(prefix="/etf", tags=["etf"])

# 시장별 응답을 mtime 키로 캐시한다. 이 핸들러는 177개 ETF x 10개 기간 + 6개 지수 x 10개
# = 1,856회의 개별 sqlite 점조회를 돌린다(인덱스 적용 후 실측 ~107ms). 장 마감 후 1회
# 갱신되는 데이터라 mtime 무효화로 충분하고, 반복 요청은 캐시 히트로 사라진다.
# 키에 date 를 포함하므로 과거 기준일 조회도 섞이지 않는다.
_ETF_HEATMAP_CACHE: dict = {}
_ETF_HEATMAP_CACHE_MAX = 4


@router.get("/heatmap")
def get_etf_heatmap(
    market: str = Query("KR", description="시장 구분 ('KR', 'US', 'GLOBAL')"),
    date: Optional[str] = Query(None, description="기준일 (YYYY-MM-DD, 기본값: 최신일)")
):
    """
    ETF 대시보드 히트맵 데이터를 반환합니다.
    """
    if market not in ["KR", "US", "GLOBAL"]:
        raise HTTPException(status_code=400, detail="Only 'KR', 'US', and 'GLOBAL' markets are supported currently.")
    try:
        return cached_by_mtime(
            _ETF_HEATMAP_CACHE,
            _ETF_HEATMAP_CACHE_MAX,
            (market, date),
            newest_mtime(*etf_heatmap_sources(market)),
            lambda: load_etf_heatmap_data(market, date),
            # 빈 결과는 캐시하지 않는다(일시적 실패가 mtime 변경까지 눌러앉는 것을 방지).
            should_cache=bool,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
