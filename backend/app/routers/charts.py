import os
import sqlite3
from typing import Optional
from fastapi import APIRouter, Query
from app.schemas import ChartDataResponse, MacroDataResponse, MacroDataPoint
from app.utils.chart_utils import load_chart_data
from app.utils.above_ma_utils import load_above_ma_data

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

@router.get("/above-ma", response_model=ChartDataResponse)
async def get_above_ma_chart_data(
    market: str = Query("KOSPI", description="시장 구분 (KOSPI, KOSPI200, KOSDAQ, KOSDAQ150)"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Above MA 실시간 지표 데이터를 반환합니다 (정전 시 누락 데이터 보간 포함).
    """
    data = load_above_ma_data(market, start_date, end_date)
    
    if data:
        return data
    
    # 데이터 로드 실패 시 빈 데이터 반환 (에러 방지)
    return ChartDataResponse(symbol=market.upper(), data=[])

@router.get("/macro", response_model=MacroDataResponse)
async def get_macro_chart_data(
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)")
):
    """
    ~/.cache/db/macro.db에서 SP500, High Yield Spread (BAMLH0A0HYM2), CNN Fear & Greed Index 데이터를 반환합니다.
    """
    db_path = os.path.expanduser("~/.cache/db/macro.db")
    if not os.path.exists(db_path):
        return MacroDataResponse(data=[])

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
        SELECT 
            COALESCE(s.date, h.date, f.date) as date,
            s.close as sp500,
            h.value as high_yield,
            f.value as cnn_fgi
        FROM (
            SELECT date, close FROM index_ohlcv WHERE index_name = 'sp500'
        ) s
        FULL OUTER JOIN (
            SELECT date, value FROM fred_macro WHERE series_id = 'BAMLH0A0HYM2'
        ) h ON s.date = h.date
        FULL OUTER JOIN (
            SELECT date, value FROM cnn_fear_greed
        ) f ON COALESCE(s.date, h.date) = f.date
        WHERE 1=1
    """
    params = []
    if start_date:
        query += " AND COALESCE(s.date, h.date, f.date) >= ?"
        params.append(start_date)
    if end_date:
        query += " AND COALESCE(s.date, h.date, f.date) <= ?"
        params.append(end_date)

    query += " ORDER BY date ASC"

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()

        result = []
        for row in rows:
            result.append(MacroDataPoint(
                date=row[0],
                sp500=row[1],
                high_yield=row[2],
                cnn_fgi=row[3]
            ))
        return MacroDataResponse(data=result)
    except Exception as e:
        print(f"Error loading macro data: {e}")
        return MacroDataResponse(data=[])
    finally:
        conn.close()
