from typing import List, Optional
from datetime import datetime, timedelta
import random

from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ChartDataResponse, ChartDataPoint
from app.utils.chart_utils import load_kodex_leverage_data

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
    """
    # KODEX 레버리지 전용 처리 (CSV 데이터 소스)
    # 대소문자 구분 없이 'kodex'와 'leverage'가 포함되면 실제 데이터 로드 시도
    target_symbol = symbol.lower()
    if "kodex" in target_symbol and "leverage" in target_symbol:
        csv_data = load_kodex_leverage_data(start_date=start_date, end_date=end_date)
        if csv_data:
            # 명시적으로 DUMMY 문구 제거 확인
            csv_data.symbol = "KODEX LEVERAGE"
            return csv_data
    
    # 그 외 종목은 더미 데이터를 반환 (구현 대기 중)
    data_points = []
    # 오늘 날짜를 기준으로 최근 100개 데이터 생성
    now = datetime.now()
    base_date = now - timedelta(days=100)
    # KOSPI(2500)와 KODEX(100,000) 사이의 중첩을 피하기 위해 더미 베이스 가격 조정
    upper_symbol = symbol.upper()
    if "KODEX" in upper_symbol or "LEVERAGE" in upper_symbol:
        base_price = 100000.0
    elif "KOSPI" in upper_symbol:
        base_price = 2500.0
    else:
        base_price = 5000.0
    
    # 지표 목록 정의 (요청이 없더라도 기본적으로 시뮬레이션 데이터 생성)
    requested_indicators = indicators.split(",") if indicators else []
    # 차트 설정에 있는 모든 지표 리스트 (ID 기준)
    all_indicator_ids = ["sma10", "sma20", "sma50", "sma200", "adr14", "adr20", "rsi", "macd"]
    
    for i in range(100):
        current_date = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        
        # 간단한 랜덤 워크 주가 생성
        change = random.uniform(-20, 20)
        open_p = base_price
        close_p = open_p + change
        high_p = max(open_p, close_p) + random.uniform(0, 10)
        low_p = min(open_p, close_p) - random.uniform(0, 10)
        
        indicator_data = {}
        # 모든 지표에 대해 더미 데이터 생성 (데이터 단절 방지)
        for ind_id in all_indicator_ids:
            if "rsi" in ind_id:
                indicator_data[ind_id] = random.uniform(30, 70)
            elif "macd" in ind_id:
                indicator_data[ind_id] = random.uniform(-5, 5)
            elif "sma" in ind_id:
                indicator_data[ind_id] = random.uniform(40, 90)
            elif "adr" in ind_id:
                indicator_data[ind_id] = random.uniform(70, 130)
            else:
                indicator_data[ind_id] = random.uniform(0, 100)
        
        data_points.append(ChartDataPoint(
            time=current_date,
            open=round(open_p, 2),
            high=round(high_p, 2),
            low=round(low_p, 2),
            close=round(close_p, 2),
            indicators=indicator_data
        ))
        
        base_price = close_p

    return ChartDataResponse(
        symbol=f"[DUMMY] {symbol}",
        data=data_points
    )
