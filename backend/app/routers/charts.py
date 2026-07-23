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
    WicsIndexAllResponse,
    WicsIndexSectorSeries,
    WicsIndexOhlcPoint,
    WicsIndexMetaResponse,
    MarketFlowResponse,
    MarketFlowPoint,
)
from app.utils.wics_index_utils import (
    aggregate_closes_to_ohlc,
    default_lookback_start,
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

    # 날짜 필터를 서브쿼리에 먼저 적용해 FULL OUTER JOIN 입력 크기를 줄임
    sp_filters = ["index_name = 'sp500'"]
    hy_filters = ["series_id = 'BAMLH0A0HYM2'"]
    fgi_filters: list[str] = []
    params: list[str] = []

    def append_date_filters(filters: list[str]) -> None:
        if start_date:
            filters.append("date >= ?")
            params.append(start_date)
        if end_date:
            filters.append("date <= ?")
            params.append(end_date)

    append_date_filters(sp_filters)
    append_date_filters(hy_filters)
    append_date_filters(fgi_filters)

    sp_where = " AND ".join(sp_filters)
    hy_where = " AND ".join(hy_filters)
    fgi_where = (" WHERE " + " AND ".join(fgi_filters)) if fgi_filters else ""

    query = f"""
        SELECT 
            COALESCE(s.date, h.date, f.date) as date,
            s.close as sp500,
            h.value as high_yield,
            f.value as cnn_fgi
        FROM (
            SELECT date, close FROM index_ohlcv WHERE {sp_where}
        ) s
        FULL OUTER JOIN (
            SELECT date, value FROM fred_macro WHERE {hy_where}
        ) h ON s.date = h.date
        FULL OUTER JOIN (
            SELECT date, value FROM cnn_fear_greed{fgi_where}
        ) f ON COALESCE(s.date, h.date) = f.date
        ORDER BY date ASC
    """

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

@router.get("/market-flow", response_model=MarketFlowResponse)
async def get_market_flow_chart_data(
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)")
):
    """
    ~/.cache/db/macro.db에서 수급 데이터(market_flow)를 반환합니다.
    """
    db_path = os.path.expanduser("~/.cache/db/macro.db")
    if not os.path.exists(db_path):
        return MarketFlowResponse(data=[])

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = "SELECT * FROM market_flow"
    filters = []
    params = []
    if start_date:
        filters.append("date >= ?")
        params.append(start_date)
    if end_date:
        filters.append("date <= ?")
        params.append(end_date)
    if filters:
        query += " WHERE " + " AND ".join(filters)
    query += " ORDER BY date ASC, time ASC"

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()
        result = []
        for row in rows:
            result.append(MarketFlowPoint(
                date=row["date"],
                time=row["time"],
                kospi_price=row["kospi_price"],
                kospi200_price=row["kospi200_price"],
                kosdaq_price=row["kosdaq_price"],
                kq150_price=row["kq150_price"],
                kospi_foreigner=row["kospi_foreigner"],
                kospi_institution=row["kospi_institution"],
                kospi_individual=row["kospi_individual"],
                kospi_program=row["kospi_program"],
                kosdaq_foreigner=row["kosdaq_foreigner"],
                kosdaq_institution=row["kosdaq_institution"],
                kosdaq_individual=row["kosdaq_individual"],
                future_foreigner=row["future_foreigner"],
                future_institution=row["future_institution"],
                future_individual=row["future_individual"]
            ))
        return MarketFlowResponse(data=result)
    except Exception as e:
        print(f"Error loading market flow data: {e}")
        return MarketFlowResponse(data=[])
    finally:
        conn.close()

@router.get("/market-flow/dates", response_model=list[str])
async def get_market_flow_dates():
    """market_flow 테이블의 모든 고유 날짜 목록을 반환합니다."""
    db_path = os.path.expanduser("~/.cache/db/macro.db")
    if not os.path.exists(db_path):
        return []
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT DISTINCT date FROM market_flow ORDER BY date ASC")
        rows = cursor.fetchall()
        return [row[0] for row in rows if row[0]]
    except Exception as e:
        print(f"Error loading market flow dates: {e}")
        return []
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


@router.get("/wics-index/meta", response_model=WicsIndexMetaResponse)
async def get_wics_index_meta():
    """wics_daily_index 섹터 목록 및 날짜 범위."""
    db_path = get_stock_master_db_path()
    if not os.path.exists(db_path):
        return WicsIndexMetaResponse(sectors=[], min_date=None, max_date=None)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='wics_daily_index'"
        )
        if cursor.fetchone() is None:
            return WicsIndexMetaResponse(sectors=[], min_date=None, max_date=None)

        cursor.execute("SELECT DISTINCT WICS FROM wics_daily_index ORDER BY WICS ASC")
        sectors = [r[0] for r in cursor.fetchall() if r[0]]
        cursor.execute("SELECT MIN(date), MAX(date) FROM wics_daily_index")
        row = cursor.fetchone()
        min_date = row[0] if row else None
        max_date = row[1] if row else None
        return WicsIndexMetaResponse(sectors=sectors, min_date=min_date, max_date=max_date)
    except Exception as e:
        print(f"Error loading WICS index meta: {e}")
        return WicsIndexMetaResponse(sectors=[], min_date=None, max_date=None)
    finally:
        conn.close()


@router.get("/wics-index/all", response_model=WicsIndexAllResponse)
async def get_wics_index_all(
    start_date: Optional[str] = Query(None, description="시작일 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="종료일 YYYY-MM-DD"),
    tf: str = Query("D", description="D | W | M"),
    weight: str = Query("MC", description="MC | EW"),
):
    """
    전 WICS 섹터 지수 시계열(절대 레벨). rebase는 클라이언트 책임.
    tf=W|M 이면 일별 close를 OHLC로 집계한다.
    """
    tf_u = (tf or "D").upper()
    if tf_u not in ("D", "W", "M"):
        tf_u = "D"
    weight_u = (weight or "MC").upper()
    if weight_u not in ("MC", "EW"):
        weight_u = "MC"
    col = "MC_Index" if weight_u == "MC" else "EW_Index"

    db_path = get_stock_master_db_path()
    empty = WicsIndexAllResponse(tf=tf_u, weight=weight_u, sectors=[])
    if not os.path.exists(db_path):
        return empty

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='wics_daily_index'"
        )
        if cursor.fetchone() is None:
            return empty

        # Default window from max date when start omitted
        eff_start = start_date
        eff_end = end_date
        if not eff_start or not eff_end:
            cursor.execute("SELECT MIN(date), MAX(date) FROM wics_daily_index")
            mn, mx = cursor.fetchone()
            if not eff_end:
                eff_end = mx
            if not eff_start:
                eff_start = default_lookback_start(eff_end or mx, tf_u) or mn

        clauses = []
        params: list = []
        if eff_start:
            clauses.append("date >= ?")
            params.append(eff_start)
        if eff_end:
            clauses.append("date <= ?")
            params.append(eff_end)
        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""

        cursor.execute(
            f"""
            SELECT WICS, date, {col}
            FROM wics_daily_index
            {where}
            ORDER BY WICS ASC, date ASC
            """,
            params,
        )
        rows = cursor.fetchall()

        by_sector: dict[str, list[tuple[str, float]]] = {}
        for wics_name, d, val in rows:
            if wics_name is None or val is None:
                continue
            by_sector.setdefault(wics_name, []).append((d, float(val)))

        sectors: list[WicsIndexSectorSeries] = []
        for wics_name, series in by_sector.items():
            points = aggregate_closes_to_ohlc(series, tf_u)  # type: ignore[arg-type]
            sectors.append(
                WicsIndexSectorSeries(
                    WICS=wics_name,
                    points=[WicsIndexOhlcPoint(**p) for p in points],
                )
            )

        return WicsIndexAllResponse(tf=tf_u, weight=weight_u, sectors=sectors)
    except Exception as e:
        print(f"Error loading WICS index all: {e}")
        return empty
    finally:
        conn.close()
