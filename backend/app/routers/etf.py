from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.utils.etf_heatmap_utils import load_etf_heatmap_data

router = APIRouter(prefix="/etf", tags=["etf"])

@router.get("/heatmap")
async def get_etf_heatmap(
    market: str = Query("KR", description="시장 구분 ('KR', 'US')"),
    date: Optional[str] = Query(None, description="기준일 (YYYY-MM-DD, 기본값: 최신일)")
):
    """
    ETF 대시보드 히트맵 데이터를 반환합니다.
    """
    if market not in ["KR", "US"]:
        raise HTTPException(status_code=400, detail="Only 'KR' and 'US' markets are supported currently.")
    try:
        data = load_etf_heatmap_data(market, date)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
