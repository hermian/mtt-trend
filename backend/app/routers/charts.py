from typing import List, Optional
from datetime import datetime, timedelta
import random

from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ChartDataResponse, ChartDataPoint

router = APIRouter(prefix="/charts", tags=["charts"])

@router.get("/data", response_model=ChartDataResponse)
def get_chart_data(
    symbol: str = Query("KOSPI", description="Symbol or Theme name"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    indicators: Optional[str] = Query(None, description="Comma-separated indicators (e.g., rsi,macd)"),
    db: Session = Depends(get_db),
):
    """
    차트 렌더링을 위한 기술 지표 및 가격 데이터 반환.
    현재는 구현 단계이므로 더미 데이터를 반환합니다.
    """
    # TODO: DB 연동 및 실제 지표 계산 로직 구현 (scripts/ingest.py 확장 시)
    
    data_points = []
    base_date = datetime.now() - timedelta(days=100)
    base_price = 2500.0
    
    selected_indicators = indicators.split(",") if indicators else []
    
    for i in range(100):
        current_date = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        
        # 간단한 랜덤 워크 주가 생성
        change = random.uniform(-20, 20)
        open_p = base_price
        close_p = open_p + change
        high_p = max(open_p, close_p) + random.uniform(0, 10)
        low_p = min(open_p, close_p) - random.uniform(0, 10)
        
        indicator_data = {}
        for ind in selected_indicators:
            if ind.lower() == "rsi":
                indicator_data["rsi"] = random.uniform(30, 70)
            elif ind.lower() == "macd":
                indicator_data["macd"] = random.uniform(-5, 5)
            else:
                indicator_data[ind] = random.uniform(0, 100)
        
        data_points.append(ChartDataPoint(
            time=current_date,
            open=round(open_p, 2),
            high=round(high_p, 2),
            low=round(low_p, 2),
            close=round(close_p, 2),
            indicators=indicator_data if indicator_data else None
        ))
        
        base_price = close_p

    return ChartDataResponse(
        symbol=symbol,
        data=data_points
    )
