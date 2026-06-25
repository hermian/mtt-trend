import pytest
import sqlite3
import os
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture
def temp_above_ma_db():
    # 임시 DB 파일 생성
    fd, db_path_str = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_path = Path(db_path_str)
    
    # DB 초기화 및 테스트 데이터 적재
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE realtime_above_ma (
            Date TEXT,
            Market TEXT,
            Close REAL,
            Above10ma REAL,
            Above20ma REAL,
            Above50ma REAL,
            naver_length INTEGER,
            PRIMARY KEY (Date, Market)
        )
    """)
    
    # 테스트 데이터 (09:05, 14:15 사이에 5시간 10분의 공백이 있음)
    test_data = [
        ("2026-06-25 09:05:00", "KOSPI", 1000.0, 10.0, 20.0, 30.0, 100),
        ("2026-06-25 14:15:00", "KOSPI", 1100.0, 20.0, 30.0, 40.0, 100),
        ("2026-06-25 14:30:00", "KOSPI", 1105.0, 21.0, 31.0, 41.0, 100),
        ("2026-06-25 14:45:00", "KOSPI", 1110.0, 22.0, 32.0, 42.0, 100),
    ]
    
    cursor.executemany("""
        INSERT INTO realtime_above_ma (Date, Market, Close, Above10ma, Above20ma, Above50ma, naver_length)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, test_data)
    
    conn.commit()
    conn.close()
    
    # 환경 변수로 DB 경로 설정
    old_env = os.environ.get("ABOVE_MA_DB_PATH")
    os.environ["ABOVE_MA_DB_PATH"] = db_path_str
    
    yield db_path_str
    
    # 정리
    if old_env:
        os.environ["ABOVE_MA_DB_PATH"] = old_env
    else:
        del os.environ["ABOVE_MA_DB_PATH"]
        
    try:
        db_path.unlink()
    except OSError:
        pass

def test_above_ma_endpoint(temp_above_ma_db):
    """
    /api/charts/above-ma 엔드포인트가 데이터를 보간하여 정상적으로 반환하는지 테스트합니다.
    """
    response = client.get("/api/charts/above-ma?market=KOSPI")
    assert response.status_code == 200
    
    data = response.json()
    assert data["symbol"] == "KOSPI"
    
    points = data["data"]
    
    # 원래 4개 데이터에 더해 09:15부터 14:00까지 15분 간격으로 보간된 데이터가 생성되어야 함
    # 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15, 11:30, 11:45,
    # 12:00, 12:15, 12:30, 12:45, 13:00, 13:15, 13:30, 13:45, 14:00 (총 20개 보간 데이터)
    # 총 데이터 포인트 개수 = 4(원본) + 20(보간) = 24개
    assert len(points) == 24
    
    # 시간 순 정렬 확인
    times = [p["time"] for p in points]
    assert times == sorted(times)
    
    # 09:15 데이터 확인 (첫 번째 보간 데이터)
    # 09:05 ~ 14:15 의 총 시간차 = 310분. 09:05 ~ 09:15의 시간차 = 10분.
    # 가중치 (weight) = 10 / 310 = 0.032258
    # Close = 1000.0 + 100.0 * 0.032258 = 1003.23
    p_0915 = [p for p in points if p["time"] == "2026-06-25 09:15:00"][0]
    assert p_0915["close"] == 1003.23
    assert p_0915["indicators"]["above_sma10"] == 10.32
    assert p_0915["indicators"]["above_sma20"] == 20.32
    assert p_0915["indicators"]["above_sma50"] == 30.32

def test_above_ma_filtering(temp_above_ma_db):
    """
    날짜 필터링이 올바르게 작동하는지 검증합니다.
    """
    # 14:15 이후 데이터만 필터링
    response = client.get("/api/charts/above-ma?market=KOSPI&start_date=2026-06-25 14:15:00")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 3  # 14:15, 14:30, 14:45
    
    for p in data["data"]:
        assert p["time"] >= "2026-06-25 14:15:00"


def test_above_ma_power_outage_interpolation(temp_above_ma_db):
    """
    정전 상황(장 시작 09:05에 데이터가 없고 12:00에 첫 데이터가 들어온 상황)에서
    09:05 가상 포인트가 생성되고 보간이 일어나는지 검증합니다.
    """
    # 임시 DB에 정전 상황 데이터 적재
    conn = sqlite3.connect(temp_above_ma_db)
    cursor = conn.cursor()
    # 기존 데이터 삭제 후 새로 적재
    cursor.execute("DELETE FROM realtime_above_ma")
    
    test_data = [
        # 전날 종가 데이터
        ("2026-06-24 15:30:00", "KOSPI", 900.0, 8.0, 18.0, 28.0, 100),
        # 오늘 첫 데이터 (정전으로 12:00에 처음 시작)
        ("2026-06-25 12:00:00", "KOSPI", 1000.0, 10.0, 20.0, 30.0, 100),
        ("2026-06-25 12:15:00", "KOSPI", 1010.0, 11.0, 21.0, 31.0, 100),
    ]
    cursor.executemany("""
        INSERT INTO realtime_above_ma (Date, Market, Close, Above10ma, Above20ma, Above50ma, naver_length)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, test_data)
    conn.commit()
    conn.close()
    
    response = client.get("/api/charts/above-ma?market=KOSPI")
    assert response.status_code == 200
    data = response.json()
    points = data["data"]
    
    # 생성된 2026-06-25 09:05:00 가상 포인트 검증
    p_0905 = [p for p in points if p["time"] == "2026-06-25 09:05:00"]
    assert len(p_0905) == 1
    assert p_0905[0]["close"] == 900.0  # 전날 종가 값
    assert p_0905[0]["indicators"]["above_sma10"] == 8.0
    
    # 09:15:00 보간 포인트 검증
    p_0915 = [p for p in points if p["time"] == "2026-06-25 09:15:00"]
    assert len(p_0915) == 1
    # 09:05(900.0)와 12:00(1000.0) 사이의 선형 보간 값
    # total_seconds = 175분, delta = 10분 -> weight = 10/175 = 0.0571428
    # Close = 900 + 100 * 0.0571428 = 905.71
    assert p_0915[0]["close"] == 905.71

