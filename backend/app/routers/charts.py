import os
import sqlite3
from typing import Optional
from fastapi import APIRouter, Query
from app.schemas import (
    ChartDataResponse,
    MacroDataResponse,
    MacroDataPoint,
    WicsMonthResponse,
    WicsWeekResponse,
    WicsRankingsResponse,
    WicsMonthRankings,
    WicsRankingItem,
    WicsIndexResponse,
    WicsIndexPoint,
)
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

def get_stock_master_db_path() -> str:
    override = os.environ.get("STOCK_MASTER_DB_PATH")
    if override:
        return os.path.expanduser(override)
    return os.path.expanduser("~/.cache/db/stock_master.db")

@router.get("/wics-months", response_model=WicsMonthResponse)
async def get_wics_months():
    """
    wics_monthly_rankings 테이블에서 고유한 YearMonth 목록을 시간 오름차순으로 반환합니다.
    """
    db_path = get_stock_master_db_path()
    if not os.path.exists(db_path):
        return WicsMonthResponse(months=[])

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT DISTINCT YearMonth FROM wics_monthly_rankings ORDER BY YearMonth ASC")
        rows = cursor.fetchall()
        months = [row[0] for row in rows if row[0]]
        return WicsMonthResponse(months=months)
    except Exception as e:
        print(f"Error loading WICS months: {e}")
        return WicsMonthResponse(months=[])
    finally:
        conn.close()

@router.get("/wics-rankings", response_model=WicsRankingsResponse)
async def get_wics_rankings(
    start_month: Optional[str] = Query(None, description="시작월 (YYYY-MM)"),
    end_month: Optional[str] = Query(None, description="종료월 (YYYY-MM)")
):
    """
    wics_monthly_rankings 테이블에서 시작월과 종료월 사이의 데이터를 조회하여
    월별로 그룹화된 랭킹 데이터를 반환합니다.
    """
    db_path = get_stock_master_db_path()
    if not os.path.exists(db_path):
        return WicsRankingsResponse(months=[])

    conn = sqlite3.connect(db_path)
    # Row factory to easily access columns by name
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
        SELECT date, YearMonth, WICS, EW_12m_Return, MC_12m_Return, 
               Rank_EW, Rank_MC, Top2_Share, Display_EW, Display_MC
        FROM wics_monthly_rankings
        WHERE 1=1
    """
    params = []
    if start_month:
        query += " AND YearMonth >= ?"
        params.append(start_month)
    if end_month:
        query += " AND YearMonth <= ?"
        params.append(end_month)

    # Note: Sorting here is just for retrieving items, we will sort rankings inside each month's list later if needed.
    query += " ORDER BY YearMonth ASC"

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Query top stocks for the same range
        top_stocks_query = """
            SELECT YearMonth, WICS, stock_name, stock_code, stock_12m_return, sector_weight, marcap, rank_in_sector
            FROM wics_monthly_rankings_top_stocks
            WHERE 1=1
        """
        top_params = []
        if start_month:
            top_stocks_query += " AND YearMonth >= ?"
            top_params.append(start_month)
        if end_month:
            top_stocks_query += " AND YearMonth <= ?"
            top_params.append(end_month)
        
        top_stocks_query += " ORDER BY YearMonth ASC, WICS ASC, rank_in_sector ASC"
        cursor.execute(top_stocks_query, top_params)
        top_rows = cursor.fetchall()

        from collections import defaultdict
        top_stocks_map = defaultdict(list)
        for r in top_rows:
            key = (r["YearMonth"], r["WICS"])
            top_stocks_map[key].append({
                "stock_name": r["stock_name"],
                "stock_code": r["stock_code"],
                "stock_12m_return": r["stock_12m_return"],
                "sector_weight": r["sector_weight"],
                "marcap": r["marcap"],
                "rank_in_sector": r["rank_in_sector"]
            })

        # Group by YearMonth
        grouped = defaultdict(list)

        for row in rows:
            ym = row["YearMonth"]
            wics_name = row["WICS"]
            t_stocks = top_stocks_map.get((ym, wics_name))

            item = WicsRankingItem(
                WICS=wics_name,
                Rank_EW=row["Rank_EW"],
                Rank_MC=row["Rank_MC"],
                EW_12m_Return=row["EW_12m_Return"],
                MC_12m_Return=row["MC_12m_Return"],
                Top2_Share=row["Top2_Share"],
                Display_EW=row["Display_EW"],
                Display_MC=row["Display_MC"],
                top_stocks=t_stocks
            )
            grouped[ym].append(item)

        months_list = []
        for ym in sorted(grouped.keys()):
            # rankings inside a month will be sorted by frontend depending on active rank type (EW or MC)
            months_list.append(WicsMonthRankings(
                YearMonth=ym,
                rankings=grouped[ym]
            ))

        return WicsRankingsResponse(months=months_list)
    except Exception as e:
        print(f"Error loading WICS rankings: {e}")
        return WicsRankingsResponse(months=[])
    finally:
        conn.close()

@router.get("/wics-weeks", response_model=WicsWeekResponse)
async def get_wics_weeks():
    """
    wics_weekly_rankings 테이블에서 고유한 YearWeek 목록을 시간 오름차순으로 반환합니다.
    """
    db_path = get_stock_master_db_path()
    if not os.path.exists(db_path):
        return WicsWeekResponse(weeks=[])

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT DISTINCT YearWeek FROM wics_weekly_rankings ORDER BY YearWeek ASC")
        rows = cursor.fetchall()
        weeks = [row[0] for row in rows if row[0]]
        return WicsWeekResponse(weeks=weeks)
    except Exception as e:
        print(f"Error loading WICS weeks: {e}")
        return WicsWeekResponse(weeks=[])
    finally:
        conn.close()


@router.get("/wics-rankings/weekly", response_model=WicsRankingsResponse)
async def get_wics_weekly_rankings(
    start_week: Optional[str] = Query(None, description="시작주차 (YYYY-Www)"),
    end_week: Optional[str] = Query(None, description="종료주차 (YYYY-Www)")
):
    """
    wics_weekly_rankings 테이블에서 시작주차와 종료주차 사이의 데이터를 조회하여
    주간별로 그룹화된 랭킹 데이터를 반환합니다.
    """
    db_path = get_stock_master_db_path()
    if not os.path.exists(db_path):
        return WicsRankingsResponse(months=[])

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 기본값 처리 (최근 26주치 범위 추출)
    if not start_week and not end_week:
        try:
            cursor.execute("SELECT DISTINCT YearWeek FROM wics_weekly_rankings ORDER BY YearWeek DESC LIMIT 26")
            latest_weeks = [r[0] for r in cursor.fetchall() if r[0]]
            if latest_weeks:
                latest_weeks.reverse()
                start_week = latest_weeks[0]
                end_week = latest_weeks[-1]
        except Exception as e:
            print(f"Error resolving default weeks: {e}")

    query = """
        SELECT date, YearWeek, WICS, EW_12m_Return, MC_12m_Return, 
               Rank_EW, Rank_MC, Top2_Share, Display_EW, Display_MC
        FROM wics_weekly_rankings
        WHERE 1=1
    """
    params = []
    if start_week:
        query += " AND YearWeek >= ?"
        params.append(start_week)
    if end_week:
        query += " AND YearWeek <= ?"
        params.append(end_week)

    query += " ORDER BY YearWeek ASC"

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Query top stocks for the same range
        top_stocks_query = """
            SELECT YearWeek, WICS, stock_name, stock_code, stock_12m_return, sector_weight, marcap, rank_in_sector
            FROM wics_weekly_rankings_top_stocks
            WHERE 1=1
        """
        top_params = []
        if start_week:
            top_stocks_query += " AND YearWeek >= ?"
            top_params.append(start_week)
        if end_week:
            top_stocks_query += " AND YearWeek <= ?"
            top_params.append(end_week)
        
        top_stocks_query += " ORDER BY YearWeek ASC, WICS ASC, rank_in_sector ASC"
        cursor.execute(top_stocks_query, top_params)
        top_rows = cursor.fetchall()

        from collections import defaultdict
        top_stocks_map = defaultdict(list)
        for r in top_rows:
            key = (r["YearWeek"], r["WICS"])
            top_stocks_map[key].append({
                "stock_name": r["stock_name"],
                "stock_code": r["stock_code"],
                "stock_12m_return": r["stock_12m_return"],
                "sector_weight": r["sector_weight"],
                "marcap": r["marcap"],
                "rank_in_sector": r["rank_in_sector"]
            })

        grouped = defaultdict(list)

        for row in rows:
            yw = row["YearWeek"]
            wics_name = row["WICS"]
            t_stocks = top_stocks_map.get((yw, wics_name))

            item = WicsRankingItem(
                WICS=wics_name,
                Rank_EW=row["Rank_EW"],
                Rank_MC=row["Rank_MC"],
                EW_12m_Return=row["EW_12m_Return"],
                MC_12m_Return=row["MC_12m_Return"],
                Top2_Share=row["Top2_Share"],
                Display_EW=row["Display_EW"],
                Display_MC=row["Display_MC"],
                top_stocks=t_stocks
            )
            grouped[yw].append(item)

        months_list = []
        for yw in sorted(grouped.keys()):
            months_list.append(WicsMonthRankings(
                YearMonth=yw,  # Option A: 필드명 호환 (YearWeek 값이 들어감)
                rankings=grouped[yw]
            ))

        return WicsRankingsResponse(months=months_list)
    except Exception as e:
        print(f"Error loading WICS weekly rankings: {e}")
        return WicsRankingsResponse(months=[])
    finally:
        conn.close()


@router.get("/wics-index", response_model=WicsIndexResponse)
async def get_wics_index(
    wics: str = Query(..., description="WICS 섹터명"),
    start_date: Optional[str] = Query(None, description="시작일 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="종료일 YYYY-MM-DD"),
):
    """
    wics_daily_index 테이블에서 특정 섹터의 일별 지수(EW/MC, base=100)를 반환합니다.
    테이블이 없으면 빈 data를 반환합니다.
    """
    db_path = get_stock_master_db_path()
    if not os.path.exists(db_path):
        return WicsIndexResponse(WICS=wics, data=[])

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='wics_daily_index'"
        )
        if cursor.fetchone() is None:
            return WicsIndexResponse(WICS=wics, data=[])

        clauses = ["WICS = ?"]
        params: list = [wics]
        if start_date:
            clauses.append("date >= ?")
            params.append(start_date)
        if end_date:
            clauses.append("date <= ?")
            params.append(end_date)
        where = " AND ".join(clauses)
        cursor.execute(
            f"""
            SELECT date, EW_Index, MC_Index
            FROM wics_daily_index
            WHERE {where}
            ORDER BY date ASC
            """,
            params,
        )
        rows = cursor.fetchall()
        data = [
            WicsIndexPoint(
                date=row["date"],
                EW_Index=row["EW_Index"],
                MC_Index=row["MC_Index"],
            )
            for row in rows
        ]
        return WicsIndexResponse(WICS=wics, data=data)
    except Exception as e:
        print(f"Error loading WICS index: {e}")
        return WicsIndexResponse(WICS=wics, data=[])
    finally:
        conn.close()
