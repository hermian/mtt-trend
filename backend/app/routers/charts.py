from typing import Optional
from fastapi import APIRouter, Query
from app.schemas import ChartDataResponse
from app.utils.chart_utils import load_chart_data

router = APIRouter(prefix="/charts", tags=["charts"])

@router.get("/data", response_model=ChartDataResponse)
async def get_chart_data(
    symbol: str = Query("kodex_leverage", description="차트 종목명 (kodex_leverage, kosdaq_leverage 등)"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    KODEX/KOSDAQ 레버리지 실제 시장 데이터를 반환합니다.
    """
    data = load_chart_data(symbol, start_date, end_date)
    
    if data:
        return data
    
    # 데이터 로드 실패 시 빈 데이터 반환 (에러 방지)
    return ChartDataResponse(symbol=symbol.upper(), data=[])
