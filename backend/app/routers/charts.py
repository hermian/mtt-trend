import os
import sqlite3
from datetime import date as date_cls, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from app.schemas import (
    ChartDataResponse,
    MacroDataResponse,
    MacroDataPoint,
    ValuationBandsResponse,
    ValuationBandPoint,
    StockbeeMmResponse,
    StockbeeMmRow,
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
    ForeignFlowResponse,
    ForeignFlowPoint,
    AvwapChartResponse,
    StockSearchResult,
    CustomAnchorCreate,
    CustomAnchorUpdate,
    CustomAnchorResponse,
)
from app.utils.wics_index_utils import (
    aggregate_closes_to_ohlc,
    default_lookback_start,
)
from app.utils.chart_utils import load_chart_data
from app.utils.above_ma_utils import load_above_ma_data
from app.utils.foreign_flow_utils import load_foreign_flow_data
from app.utils.stockbee_mm_utils import load_stockbee_mm
from app.utils.avwap_utils import load_avwap_chart_data, search_stocks_db
from app.utils.custom_anchor_utils import (
    get_custom_anchors,
    create_custom_anchor,
    update_custom_anchor,
    delete_custom_anchor,
    suppress_system_anchor,
    reset_all_anchors,
)
from app.utils.valuation_band_utils import (
    ALLOWED_INDEXES,
    compute_band_levels,
    parse_multiples,
)

router = APIRouter(prefix="/charts", tags=["charts"])

# Investing ISM 발표일 → 참조월 룩백 (seed·구간 경계용)
_ISM_RELEASE_LOOKBACK_DAYS = 90


def _ism_release_to_ref_month(d: date_cls) -> date_cls:
    """Investing 발표일 → 참조월 1일.

    DB는 발표일 원본을 유지하고, 차트 조회 시에만 정규화한다.
    day <= 15 이면 전월(통상 월초 발표), 아니면 당월 1일.
    """
    if d.day <= 15:
        if d.month == 1:
            return date_cls(d.year - 1, 12, 1)
        return date_cls(d.year, d.month - 1, 1)
    return date_cls(d.year, d.month, 1)


def _normalize_ism_observations(
    raw_rows: list[tuple],
) -> list[tuple[str, float]]:
    """(발표일, value) → (참조월1일, value). 동일 참조월은 최신 발표 우선."""
    by_ref: dict[str, tuple[str, float]] = {}
    for release_s, value in raw_rows:
        if value is None:
            continue
        try:
            release_d = date_cls.fromisoformat(release_s)
        except ValueError:
            continue
        ref_s = _ism_release_to_ref_month(release_d).isoformat()
        prev = by_ref.get(ref_s)
        # 같은 참조월에 여러 발표점이 있으면 더 늦은 발표일 유지
        if prev is None or release_s >= prev[0]:
            by_ref[ref_s] = (release_s, float(value))
    return [(ref, val) for ref, (_rel, val) in sorted(by_ref.items())]


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


@router.get("/stockbee-mm", response_model=StockbeeMmResponse)
async def get_stockbee_mm_data(
    year: Optional[int] = Query(
        None, ge=1990, le=2100, description="연도(YYYY). 미지정 시 DB 최신일 기준 최근 1년"
    ),
    limit: Optional[int] = Query(
        None, ge=1, le=10000, description="선택적 행 상한(테스트용)"
    ),
):
    """
    ~/.cache/db/stockbee_mm.db 의 한국 Stockbee Market Monitor 일별 지표를 반환합니다.
    기본: 최근 1년. year 지정 시 해당 연도 전체.
    """
    result = load_stockbee_mm(year=year, limit=limit)
    if result is None:
        return StockbeeMmResponse(data=[], years=[])
    rows, years = result
    return StockbeeMmResponse(data=[StockbeeMmRow(**r) for r in rows], years=years)


@router.get("/macro", response_model=MacroDataResponse)
async def get_macro_chart_data(
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)")
):
    """
    ~/.cache/db/macro.db에서 주요 매크로 지표 시계열을 날짜 기준으로 병합해 반환합니다.

    [데이터 수집 경로 — 값이 이상하면 여기부터 추적]
      - 이 API는 DB를 읽기만 함. 수집(쓰기)은 screener 저장소가 담당:
        수집기: ~/workspace/git/screener/mmt/macro_collector/ (oil.py, fx.py 등)
        스케줄: crontab 평일 18:27 KST — screener/script/run_macro_refresh.sh 가
                `python -m mmt.macro_collector refresh --days 10` 실행 (최근 10일 덮어씀)
      - 미국 장 데이터(wti/brent/sp500 등)는 18:27 KST 수집 시점에 당일(미국) 장이
        끝나기 전이므로 마지막 행이 1영업일 전(미국 기준)인 것이 정상.
      - 2026-08 사고: Investing 심볼 검색이 "CL"을 Colgate-Palmolive 주식으로
        오해석해 wti 전 구간 오염 → 소스를 Yahoo(CL=F/BZ=F)로 전환하고 재백필.
        상세: screener/mmt/macro_collector/oil.py docstring.

    지표별 소스:
      sp500      index_ohlcv(index_name='sp500')
      nasdaq100  index_ohlcv(index_name='nasdaq100')
      kospi      index_ohlcv(index_name='kospi')
      high_yield fred_macro(BAMLH0A0HYM2)
      vix        fred_macro(VIX)
      cnn_fgi    cnn_fear_greed
      kr_fgi     kr_fear_greed(market='KOSPI')
      vkospi     krx_vkospi
      pcr        krx_pcr
      move       index_ohlcv(index_name='move')
      vxsmh      index_ohlcv(index_name='vxsmh')
      vxn        index_ohlcv(index_name='vxn') — Cboe Nasdaq 100 Volatility Index (2001~)
      us_2y      us_treasury_yield(y2)
      us_10y     us_treasury_yield(y10)
      us_spread  us_treasury_yield(y2y10_spread)
      kr_10y     us_treasury_yield(kr10)
      usdkrw     fx_rate(usdkrw)
      usdjpy     fx_rate(usdjpy)
      usdcny     fx_rate(usdcny)
      eurusd     fx_rate(eurusd)
      dxy        fx_rate(dxy)
      fed_funds  fred_macro(DFF) — 조회 시 ffill
      bok_base   fred_macro(BOK_BASE) — 조회 시 ffill
      wti        index_ohlcv(index_name='wti') — Yahoo CL=F 선물 (2000-08~)
      brent      index_ohlcv(index_name='brent') — Yahoo BZ=F 선물 (2007-07~; 이전 구간은 구 Investing LCO)
      wti_fred   fred_macro(DCOILWTICO) — FRED spot
      brent_fred fred_macro(DCOILBRENTEU) — FRED spot
      export_avg kr_export_avg — FinJump 주간 일평균수출, 조회 시 ffill
      ism_pmi    fred_macro(ISM_PMI) — Investing 발표일 원본; 조회 시 참조월 정규화 후 ffill
      credit_kospi / credit_kosdaq          kofia_credit_loan — 신용잔고 (조원)
      credit_kospi_pct / credit_kosdaq_pct  신용잔고 ÷ index_ohlcv.marcap (%)
      forced_sell / forced_sell_ratio       kofia_stock_money — 미수금 반대매매 (억원, %)
    """
    db_path = os.path.expanduser("~/.cache/db/macro.db")
    if not os.path.exists(db_path):
        return MacroDataResponse(data=[])

    effective_start_date = start_date if start_date is not None else "2010-01-01"

    # (테이블, 컬럼, 조건절) — 조건절은 시리즈 행을 좁히는 SQL, None이면 전체.
    # 원유: Yahoo 선물(wti/brent)과 FRED 스팟(wti_fred/brent_fred)은 혼용하지 않음.
    series_defs = {
        "sp500":     ("index_ohlcv",        "close",       "index_name = 'sp500'"),
        "nasdaq100": ("index_ohlcv",        "close",       "index_name = 'nasdaq100'"),
        "dow30":     ("index_ohlcv",        "close",       "index_name = 'dow30'"),
        "kospi":     ("index_ohlcv",        "close",       "index_name = 'kospi'"),
        "high_yield": ("fred_macro",        "value",       "series_id = 'BAMLH0A0HYM2'"),
        "vix":       ("fred_macro",         "value",       "series_id = 'VIX'"),
        "cnn_fgi":   ("cnn_fear_greed",     "value",       None),
        "kr_fgi":    ("kr_fear_greed",      "value",       "market = 'KOSPI'"),
        "vkospi":    ("krx_vkospi",         "close",       None),
        "pcr":       ("krx_pcr",            "pcratio",     None),
        "move":      ("index_ohlcv",        "close",       "index_name = 'move'"),
        "vxsmh":     ("index_ohlcv",        "close",       "index_name = 'vxsmh'"),
        "vxn":       ("index_ohlcv",        "close",       "index_name = 'vxn'"),
        "us_2y":     ("us_treasury_yield",  "y2",          None),
        "us_10y":    ("us_treasury_yield",  "y10",         None),
        "us_spread": ("us_treasury_yield",  "y2y10_spread", None),
        "kr_10y":    ("us_treasury_yield",  "kr10",        None),
        "usdkrw":    ("fx_rate",            "usdkrw",      None),
        "usdjpy":    ("fx_rate",            "usdjpy",      None),
        "usdcny":    ("fx_rate",            "usdcny",      None),
        "eurusd":    ("fx_rate",            "eurusd",      None),
        "dxy":       ("fx_rate",            "dxy",         None),
        "wti":       ("index_ohlcv",        "close",       "index_name = 'wti'"),
        "brent":     ("index_ohlcv",        "close",       "index_name = 'brent'"),
        "wti_fred":  ("fred_macro",         "value",       "series_id = 'DCOILWTICO'"),
        "brent_fred": ("fred_macro",        "value",       "series_id = 'DCOILBRENTEU'"),
        "copper":    ("index_ohlcv",        "close",       "index_name = 'copper'"),
        "gold":      ("index_ohlcv",        "close",       "index_name = 'gold'"),
        "silver":    ("index_ohlcv",        "close",       "index_name = 'silver'"),
        # KOFIA 신용잔고(백만원 원본) + 미수금 반대매매. '_' 접두 키는 파생 계산용 내부 시리즈.
        "credit_kospi":  ("kofia_credit_loan",  "kospi",             None),
        "credit_kosdaq": ("kofia_credit_loan",  "kosdaq",            None),
        "forced_sell":   ("kofia_stock_money",  "forced_sell",       None),
        "forced_sell_ratio": ("kofia_stock_money", "forced_sell_ratio", None),
        "_kospi_marcap":  ("index_ohlcv",       "marcap",            "index_name = 'kospi'"),
        "_kosdaq_marcap": ("index_ohlcv",       "marcap",            "index_name = 'kosdaq'"),
    }
    # 정책금리 등은 관측일이 희소해 조회 시 기존 날짜축에 ffill
    ffill_series = {
        "fed_funds": "DFF",
        "bok_base": "BOK_BASE",
        "m2": "M2SL",
        "gdp": "GDP",
        "gdp_real": "GDPC1",
    }
    # ISM: DB는 발표일 원본, 차트만 참조월 정규화 후 ffill
    ism_ffill_series_id = "ISM_PMI"
    # 테이블 기반 희소 시계열 ffill (table, column)
    ffill_tables = {
        "export_avg": ("kr_export_avg", "export_avg"),
    }

    merged: dict = {}

    def load_series(key: str, table: str, col: str, cond: Optional[str]) -> None:
        where = []
        params: list = []
        if cond:
            where.append(cond)
        if effective_start_date:
            where.append("date >= ?")
            params.append(effective_start_date)
        if end_date:
            where.append("date <= ?")
            params.append(end_date)
        w = (" WHERE " + " AND ".join(where)) if where else ""
        query = f"SELECT date, {col} FROM {table}{w}"
        try:
            for date, value in conn.execute(query, params):
                merged.setdefault(date, {})[key] = value
        except Exception as e:
            print(f"Warning: macro source '{key}' ({table}) failed: {e}")

    def apply_ffill(key: str, series_id: str) -> None:
        """구간 시작 직전 값으로 seed 후, merged 날짜축에 forward-fill."""
        try:
            seed_row = conn.execute(
                "SELECT value FROM fred_macro "
                "WHERE series_id = ? AND date < ? AND value IS NOT NULL "
                "ORDER BY date DESC LIMIT 1",
                (series_id, effective_start_date),
            ).fetchone()
            seed = seed_row[0] if seed_row else None

            where = ["series_id = ?", "date >= ?", "value IS NOT NULL"]
            params: list = [series_id, effective_start_date]
            if end_date:
                where.append("date <= ?")
                params.append(end_date)
            obs = list(
                conn.execute(
                    f"SELECT date, value FROM fred_macro WHERE {' AND '.join(where)} ORDER BY date",
                    params,
                )
            )
        except Exception as e:
            print(f"Warning: macro ffill source '{key}' failed: {e}")
            return

        _ffill_onto_merged(key, seed, obs)

    def apply_ism_ffill(key: str, series_id: str) -> None:
        """Investing 발표일 → 참조월 정규화 후 merged 축에 ffill.

        DB 원본 날짜는 바꾸지 않는다. 발표일이 구간 시작 직후여도
        참조월이 구간 안/전이면 반영되도록 lookback을 둔다.
        """
        try:
            start_d = date_cls.fromisoformat(effective_start_date)
            load_from = (start_d - timedelta(days=_ISM_RELEASE_LOOKBACK_DAYS)).isoformat()
            where = ["series_id = ?", "date >= ?", "value IS NOT NULL"]
            params: list = [series_id, load_from]
            if end_date:
                where.append("date <= ?")
                params.append(end_date)
            raw = list(
                conn.execute(
                    f"SELECT date, value FROM fred_macro WHERE {' AND '.join(where)} ORDER BY date",
                    params,
                )
            )
            # lookback 이전 마지막 발표도 seed용으로 1건
            pre = conn.execute(
                "SELECT date, value FROM fred_macro "
                "WHERE series_id = ? AND date < ? AND value IS NOT NULL "
                "ORDER BY date DESC LIMIT 1",
                (series_id, load_from),
            ).fetchone()
            if pre:
                raw = [pre, *raw]
        except Exception as e:
            print(f"Warning: macro ism ffill source '{key}' failed: {e}")
            return

        normalized = _normalize_ism_observations(raw)
        seed = None
        obs: list[tuple[str, float]] = []
        for ref_s, val in normalized:
            if ref_s < effective_start_date:
                seed = val
            else:
                if end_date and ref_s > end_date:
                    continue
                obs.append((ref_s, val))
        _ffill_onto_merged(key, seed, obs)

    def apply_table_ffill(key: str, table: str, col: str) -> None:
        """희소 테이블 시계열을 merged 날짜축에 forward-fill."""
        try:
            seed_row = conn.execute(
                f'SELECT "{col}" FROM "{table}" '
                f'WHERE date < ? AND "{col}" IS NOT NULL '
                "ORDER BY date DESC LIMIT 1",
                (effective_start_date,),
            ).fetchone()
            seed = seed_row[0] if seed_row else None

            where = [f'"{col}" IS NOT NULL', "date >= ?"]
            params: list = [effective_start_date]
            if end_date:
                where.append("date <= ?")
                params.append(end_date)
            obs = list(
                conn.execute(
                    f'SELECT date, "{col}" FROM "{table}" '
                    f"WHERE {' AND '.join(where)} ORDER BY date",
                    params,
                )
            )
        except Exception as e:
            print(f"Warning: macro table ffill '{key}' ({table}) failed: {e}")
            return

        _ffill_onto_merged(key, seed, obs)

    def _ffill_onto_merged(key: str, seed, obs: list) -> None:
        if not merged and not obs:
            return

        if not merged and obs:
            start_d = date_cls.fromisoformat(effective_start_date)
            last_d = date_cls.fromisoformat(obs[-1][0])
            if end_date:
                last_d = min(last_d, date_cls.fromisoformat(end_date))
            d = start_d
            while d <= last_d:
                merged.setdefault(d.isoformat(), {})
                d += timedelta(days=1)

        idx = 0
        cur = seed
        for d in sorted(merged.keys()):
            while idx < len(obs) and obs[idx][0] <= d:
                cur = obs[idx][1]
                idx += 1
            if cur is not None:
                merged[d][key] = cur

    conn = sqlite3.connect(db_path)
    try:
        for key, (table, col, cond) in series_defs.items():
            load_series(key, table, col, cond)
        for key, series_id in ffill_series.items():
            apply_ffill(key, series_id)
        apply_ism_ffill("ism_pmi", ism_ffill_series_id)
        for key, (table, col) in ffill_tables.items():
            apply_table_ffill(key, table, col)
    except Exception as e:
        print(f"Error loading macro data: {e}")
        return MacroDataResponse(data=[])
    finally:
        conn.close()

    # 신용잔고 파생 계산: 시총 대비 %(marcap은 원 단위, 신용잔고는 백만원 단위) 후
    # 표시 단위 변환 (신용잔고 백만원→조원, 반대매매 백만원→억원)
    _MILLION_KRW = 1_000_000
    for p in merged.values():
        for credit_key, marcap_key, pct_key in (
            ("credit_kospi", "_kospi_marcap", "credit_kospi_pct"),
            ("credit_kosdaq", "_kosdaq_marcap", "credit_kosdaq_pct"),
        ):
            credit = p.get(credit_key)
            marcap = p.get(marcap_key)
            if credit is not None and marcap:
                p[pct_key] = 100.0 * credit * _MILLION_KRW / marcap
            if credit is not None:
                p[credit_key] = credit / 1_000_000  # 백만원 → 조원
        if p.get("forced_sell") is not None:
            p["forced_sell"] = p["forced_sell"] / 100.0  # 백만원 → 억원

    result = [
        MacroDataPoint(
            date=d,
            sp500=p.get("sp500"),
            nasdaq100=p.get("nasdaq100"),
            dow30=p.get("dow30"),
            kospi=p.get("kospi"),
            high_yield=p.get("high_yield"),
            cnn_fgi=p.get("cnn_fgi"),
            kr_fgi=p.get("kr_fgi"),
            vix=p.get("vix"),
            vkospi=p.get("vkospi"),
            pcr=p.get("pcr"),
            move=p.get("move"),
            vxsmh=p.get("vxsmh"),
            vxn=p.get("vxn"),
            us_2y=p.get("us_2y"),
            us_10y=p.get("us_10y"),
            us_spread=p.get("us_spread"),
            kr_10y=p.get("kr_10y"),
            usdkrw=p.get("usdkrw"),
            usdjpy=p.get("usdjpy"),
            usdcny=p.get("usdcny"),
            eurusd=p.get("eurusd"),
            dxy=p.get("dxy"),
            fed_funds=p.get("fed_funds"),
            bok_base=p.get("bok_base"),
            wti=p.get("wti"),
            brent=p.get("brent"),
            wti_fred=p.get("wti_fred"),
            brent_fred=p.get("brent_fred"),
            copper=p.get("copper"),
            gold=p.get("gold"),
            silver=p.get("silver"),
            m2=p.get("m2"),
            gdp=p.get("gdp"),
            gdp_real=p.get("gdp_real"),
            export_avg=p.get("export_avg"),
            ism_pmi=p.get("ism_pmi"),
            credit_kospi=p.get("credit_kospi"),
            credit_kosdaq=p.get("credit_kosdaq"),
            credit_kospi_pct=p.get("credit_kospi_pct"),
            credit_kosdaq_pct=p.get("credit_kosdaq_pct"),
            forced_sell=p.get("forced_sell"),
            forced_sell_ratio=p.get("forced_sell_ratio"),
        )
        for d, p in sorted(merged.items())
    ]
    return MacroDataResponse(data=result)


@router.get("/valuation-bands", response_model=ValuationBandsResponse)
async def get_valuation_bands(
    index: str = Query("kospi", description="kospi | kospi200 | kosdaq | kosdaq150"),
    mode: str = Query("pbr", description="pbr | per"),
    multiples: Optional[str] = Query(
        None,
        description="콤마 구분 배수. 미지정 시 PBR 0.8,1,1.2,1.5,2 / PER 8,10,12,15,20",
    ),
    start_date: Optional[str] = Query(None, description="시작일 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="종료일 YYYY-MM-DD"),
):
    """
    macro.db index_fundamental 기반 PER/PBR 밸류에이션 밴드.

    BPS≈Close/PBR, EPS≈Close/PER. 밴드=배수×BPS|EPS. 결측 구간은 보간하지 않음.
    """
    index_name = index.strip().lower()
    mode_norm = mode.strip().lower()
    if index_name not in ALLOWED_INDEXES:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported index: {index}. allowed={sorted(ALLOWED_INDEXES)}",
        )
    if mode_norm not in ("pbr", "per"):
        raise HTTPException(status_code=400, detail="mode must be 'pbr' or 'per'")

    try:
        mults = parse_multiples(multiples, mode_norm)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    db_path = os.path.expanduser("~/.cache/db/macro.db")
    if not os.path.exists(db_path):
        return ValuationBandsResponse(
            index_name=index_name, mode=mode_norm, multiples=mults, data=[]
        )

    query = """
        SELECT date, close, per, pbr, div_yd
        FROM index_fundamental
        WHERE index_name = ?
    """
    params: list = [index_name]
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    query += " ORDER BY date ASC"

    try:
        with sqlite3.connect(db_path) as conn:
            rows = conn.execute(query, params).fetchall()
    except sqlite3.OperationalError:
        # 테이블 미생성 등
        return ValuationBandsResponse(
            index_name=index_name, mode=mode_norm, multiples=mults, data=[]
        )

    points: list[ValuationBandPoint] = []
    for date_s, close, per, pbr, div_yd in rows:
        bands = compute_band_levels(close, per, pbr, mode_norm, mults)
        points.append(
            ValuationBandPoint(
                date=date_s,
                close=close,
                per=per,
                pbr=pbr,
                div_yd=div_yd,
                bands=bands,
            )
        )

    return ValuationBandsResponse(
        index_name=index_name,
        mode=mode_norm,
        multiples=mults,
        data=points,
    )


@router.get("/foreign-flow", response_model=ForeignFlowResponse)
async def get_foreign_flow_chart_data(
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    etf: bool = Query(False, description="True면 KOSPI 현물+ETF 수급 캐시 사용"),
):
    """
    finance_krx 캐시에서 외국인 현·선물 순매수 MA와 KOSPI를 반환합니다 (읽기 전용).

    단위: 순매수/MA = 억원, kospi = 지수.
    """
    rows = load_foreign_flow_data(start_date, end_date, etf=etf)
    return ForeignFlowResponse(
        etf=etf,
        data=[ForeignFlowPoint(**row) for row in rows],
    )


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


@router.get("/stocks/search", response_model=List[StockSearchResult])
async def search_stocks_endpoint(
    q: str = Query(..., min_length=1, description="검색할 종목명 또는 종목코드"),
    type: str = Query("stock", description="자산 유형: stock | etf | all"),
    market: Optional[str] = Query(None, description="국가/시장 구분: kr | us | all"),
    limit: int = Query(10, ge=1, le=50, description="최대 반환 개수")
):
    """
    종목명 또는 종목코드로 주식/ETF 검색 목록을 반환합니다.
    """
    return search_stocks_db(query=q, limit=limit, asset_type=type, market=market)


@router.get("/avwap", response_model=AvwapChartResponse)
async def get_avwap_chart_data(
    market: str = Query("kospi", description="kospi | kosdaq | sp500 | nasdaq100 | dow | etf"),
    interval: str = Query("1D", description="1D | 1W | 1M | 1Y"),
    symbol: Optional[str] = Query(None, description="개별 종목코드 또는 종목명 (예: 005930, 삼성전자, 069500, KODEX 200)"),
):
    """
    KOSPI / KOSDAQ / S&P500 / NASDAQ100 / DOW 지수, 개별 주식 또는 ETF의 AVWAP(Anchored VWAP) 및 다중 주기(1D/1W/1M/1Y) 기술 지표 차트 데이터를 반환합니다.
    """
    data = load_avwap_chart_data(market=market, interval=interval, symbol=symbol)
    if not data:
        target_desc = f"symbol '{symbol}'" if symbol else f"market '{market}'"
        raise HTTPException(
            status_code=404,
            detail=f"AVWAP chart data not found for {target_desc} with interval '{interval}'."
        )
    return data


@router.get("/avwap/anchors", response_model=List[CustomAnchorResponse])
async def list_custom_avwap_anchors(
    target: Optional[str] = Query(None, description="마켓 또는 종목코드 (예: sp500, kospi, 005930)"),
    include_inactive: bool = Query(False, description="비활성 앵커 포함 여부"),
):
    """
    사용자가 등록한 커스텀 AVWAP 앵커(변곡점) 목록을 반환합니다.
    """
    return get_custom_anchors(market_or_symbol=target, include_inactive=include_inactive)


@router.post("/avwap/anchors", response_model=CustomAnchorResponse)
async def add_custom_avwap_anchor(
    payload: CustomAnchorCreate,
):
    """
    새로운 커스텀 AVWAP 앵커(변곡점 일자)를 등록합니다.
    """
    if not payload.anchor_date or len(payload.anchor_date.strip()) < 10:
        raise HTTPException(status_code=400, detail="유효한 anchor_date(YYYY-MM-DD)를 입력해주세요.")
    return create_custom_anchor(payload)


@router.put("/avwap/anchors/{anchor_id}", response_model=CustomAnchorResponse)
async def edit_custom_avwap_anchor(
    anchor_id: str,
    payload: CustomAnchorUpdate,
):
    """
    기존 커스텀 AVWAP 앵커를 수정합니다.
    """
    updated = update_custom_anchor(anchor_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="해당 앵커를 찾을 수 없습니다.")
    return updated


@router.delete("/avwap/anchors/{anchor_id}")
async def remove_custom_avwap_anchor(
    anchor_id: str,
    target: Optional[str] = Query(None, description="마켓 또는 종목코드 (시스템 앵커 삭제 시 필요)"),
    anchor_date: Optional[str] = Query(None, description="앵커 기준일자 (시스템 앵커 삭제 시 필요)"),
):
    """
    커스텀 또는 시스템 AVWAP 앵커를 삭제(숨김)합니다.
    """
    success = delete_custom_anchor(anchor_id)
    if success:
        return {"status": "ok", "deleted_id": anchor_id}
    
    # If not a custom anchor in DB, check if target & anchor_date provided for system anchor suppression
    if target and anchor_date:
        supp = suppress_system_anchor(target, anchor_date)
        return {"status": "ok", "suppressed_id": supp.id, "anchor_date": anchor_date}

    raise HTTPException(status_code=404, detail="해당 앵커를 찾을 수 없습니다.")


@router.post("/avwap/anchors/reset")
async def reset_custom_avwap_anchors(
    target: str = Query(..., description="마켓 또는 종목코드 (예: sp500, kospi, 005930)"),
):
    """
    해당 대상(지수/종목)의 모든 커스텀 등록 및 시스템 삭제 이력을 초기화하여 기본 프리셋 상태로 복원합니다.
    """
    success = reset_all_anchors(target)
    return {"status": "ok", "target": target}



