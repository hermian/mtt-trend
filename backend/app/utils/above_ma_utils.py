import sqlite3
import datetime
import os
import logging
from pathlib import Path
from typing import List, Optional
from app.schemas import ChartDataPoint, ChartDataResponse

logger = logging.getLogger(__name__)

def get_above_ma_db_path() -> Path:
    override = os.environ.get("ABOVE_MA_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".cache" / "db" / "realtime_above_ma.db"

def next_grid_time(dt: datetime.datetime) -> datetime.datetime:
    minutes_to_add = 15 - (dt.minute % 15)
    next_dt = dt.replace(second=0, microsecond=0) + datetime.timedelta(minutes=minutes_to_add)
    return next_dt

def load_above_ma_data(
    market: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Optional[ChartDataResponse]:
    """
    realtime_above_ma SQLite DB에서 지정한 Market의 데이터를 조회하고,
    정전 등으로 인한 데이터 누락을 선형 보간(Linear Interpolation)하여 반환합니다.
    """
    db_path = get_above_ma_db_path()
    if not db_path.exists():
        logger.error(f"Above MA SQLite DB가 존재하지 않습니다: {db_path}")
        return None

    # market 대문자 변환
    market = market.upper()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # start_date, end_date 필터링 조건 추가
        query = """
            SELECT Date, Close, Above10ma, Above20ma, Above50ma
            FROM realtime_above_ma
            WHERE Market = ?
        """
        params = [market]
        
        if start_date:
            query += " AND Date >= ?"
            params.append(start_date if " " in start_date else f"{start_date} 00:00:00")
        if end_date:
            query += " AND Date <= ?"
            params.append(end_date if " " in end_date else f"{end_date} 23:59:59")
            
        query += " ORDER BY Date ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
    except Exception as e:
        logger.error(f"Above MA DB 조회 중 에러 발생: {e}")
        return None
    finally:
        conn.close()

    if not rows:
        return ChartDataResponse(symbol=market, data=[])

    # 1단계: 행 파싱 및 정렬 보장
    raw_points = []
    for row in rows:
        date_str, close, a10, a20, a50 = row
        try:
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                dt = datetime.datetime.strptime(date_str, "%Y-%m-%d %H:%M")
            except ValueError:
                logger.warning(f"날짜 파싱 실패: {date_str}")
                continue
        raw_points.append({
            "dt": dt,
            "close": float(close) if close is not None else 0.0,
            "above10": float(a10) if a10 is not None else 0.0,
            "above20": float(a20) if a20 is not None else 0.0,
            "above50": float(a50) if a50 is not None else 0.0
        })

    # 1.5단계: 각 거래일의 첫 데이터가 09:05 이후인 경우, 09:05 가상 시작점 추가 (장 시작 시간 누락 대응)
    # start_date와 end_date를 datetime 객체로 파싱하여 조회 범위 검증에 활용
    start_dt = None
    if start_date:
        start_str = start_date if " " in start_date else f"{start_date} 00:00:00"
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                start_dt = datetime.datetime.strptime(start_str, fmt)
                break
            except ValueError:
                continue

    end_dt = None
    if end_date:
        end_str = end_date if " " in end_date else f"{end_date} 23:59:59"
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                end_dt = datetime.datetime.strptime(end_str, fmt)
                break
            except ValueError:
                continue

    adjusted_raw_points = []
    for j in range(len(raw_points)):
        curr_p = raw_points[j]
        
        # 첫 번째 포인트이거나 이전 포인트와 날짜가 다른 경우 -> 오늘 하루의 첫 데이터 포인트
        is_first_of_day = (j == 0) or (raw_points[j-1]["dt"].date() != curr_p["dt"].date())
        
        if is_first_of_day and curr_p["dt"].time() > datetime.time(9, 5):
            # 09:05 가상 포인트 생성
            virtual_dt = curr_p["dt"].replace(hour=9, minute=5, second=0, microsecond=0)
            
            # 조회 범위 필터에 부합하는 경우에만 생성
            if (not start_dt or virtual_dt >= start_dt) and (not end_dt or virtual_dt <= end_dt):
                if j > 0:
                    # 전날 마지막 데이터 복사
                    prev_p = raw_points[j-1]
                    virtual_close = prev_p["close"]
                    virtual_a10 = prev_p["above10"]
                    virtual_a20 = prev_p["above20"]
                    virtual_a50 = prev_p["above50"]
                else:
                    # 전날 데이터가 없으면 오늘 첫 데이터 값 복사 (Backfill)
                    virtual_close = curr_p["close"]
                    virtual_a10 = curr_p["above10"]
                    virtual_a20 = curr_p["above20"]
                    virtual_a50 = curr_p["above50"]
                    
                adjusted_raw_points.append({
                    "dt": virtual_dt,
                    "close": virtual_close,
                    "above10": virtual_a10,
                    "above20": virtual_a20,
                    "above50": virtual_a50
                })
            
        adjusted_raw_points.append(curr_p)
        
    raw_points = adjusted_raw_points

    # 2단계: 보간(Interpolation) 적용
    interpolated_points = []
    
    for i in range(len(raw_points)):
        p1 = raw_points[i]
        interpolated_points.append(p1)
        
        # 마지막 포인트면 다음 포인트가 없으므로 보간 불가
        if i == len(raw_points) - 1:
            break
            
        p2 = raw_points[i+1]
        
        dt1 = p1["dt"]
        dt2 = p2["dt"]
        
        # 같은 날이고 20분 이상 차이가 나면 보간 수행 (인트라데이 누락 대응)
        if dt1.date() == dt2.date() and (dt2 - dt1).total_seconds() > 20 * 60:
            grid_dt = next_grid_time(dt1)
            total_delta = (dt2 - dt1).total_seconds()
            
            while grid_dt < dt2:
                delta_to_grid = (grid_dt - dt1).total_seconds()
                weight = delta_to_grid / total_delta
                
                interp_close = p1["close"] + weight * (p2["close"] - p1["close"])
                interp_a10 = p1["above10"] + weight * (p2["above10"] - p1["above10"])
                interp_a20 = p1["above20"] + weight * (p2["above20"] - p1["above20"])
                interp_a50 = p1["above50"] + weight * (p2["above50"] - p1["above50"])
                
                interpolated_points.append({
                    "dt": grid_dt,
                    "close": round(interp_close, 2),
                    "above10": round(interp_a10, 2),
                    "above20": round(interp_a20, 2),
                    "above50": round(interp_a50, 2)
                })
                
                grid_dt += datetime.timedelta(minutes=15)
                
    # 3단계: datetime 정렬 후 ChartDataPoint 형식으로 변환
    interpolated_points.sort(key=lambda x: x["dt"])
    
    chart_points = []
    for p in interpolated_points:
        chart_points.append(ChartDataPoint(
            time=p["dt"].strftime("%Y-%m-%d %H:%M:%S"),
            close=p["close"],
            indicators={
                "above_sma10": p["above10"],
                "above_sma20": p["above20"],
                "above_sma50": p["above50"]
            }
        ))
        
    return ChartDataResponse(symbol=market, data=chart_points)
