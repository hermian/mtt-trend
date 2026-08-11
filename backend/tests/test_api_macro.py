import pytest
import sqlite3
import os
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture
def temp_macro_db(monkeypatch):
    # 임시 DB 파일 생성
    fd, db_path_str = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_path = Path(db_path_str)
    
    # DB 초기화 및 테스트 데이터 적재
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE index_ohlcv (
            date TEXT NOT NULL,
            index_name TEXT NOT NULL,
            close REAL,
            marcap INTEGER,
            PRIMARY KEY (date, index_name)
        )
    """)
    cursor.execute("""
        CREATE TABLE fred_macro (
            date TEXT NOT NULL,
            series_id TEXT NOT NULL,
            value REAL,
            PRIMARY KEY (date, series_id)
        )
    """)
    cursor.execute("""
        CREATE TABLE cnn_fear_greed (
            date TEXT NOT NULL,
            value REAL,
            rating TEXT,
            PRIMARY KEY (date)
        )
    """)
    cursor.execute("""
        CREATE TABLE krx_vkospi (
            date TEXT NOT NULL,
            close REAL,
            PRIMARY KEY (date)
        )
    """)
    cursor.execute("""
        CREATE TABLE krx_pcr (
            date TEXT NOT NULL,
            pcratio REAL,
            PRIMARY KEY (date)
        )
    """)
    cursor.execute("""
        CREATE TABLE us_treasury_yield (
            date TEXT NOT NULL,
            y2 REAL,
            y10 REAL,
            y2y10_spread REAL,
            kr10 REAL,
            PRIMARY KEY (date)
        )
    """)
    cursor.execute("""
        CREATE TABLE kr_export_avg (
            date TEXT NOT NULL,
            export_avg REAL,
            kospi REAL,
            source TEXT,
            PRIMARY KEY (date)
        )
    """)
    cursor.execute("""
        CREATE TABLE kofia_credit_loan (
            date TEXT NOT NULL,
            total REAL,
            kospi REAL,
            kosdaq REAL,
            PRIMARY KEY (date)
        )
    """)
    cursor.execute("""
        CREATE TABLE kofia_stock_money (
            date TEXT NOT NULL,
            deposit REAL,
            deriv_deposit REAL,
            rp_balance REAL,
            unpaid_balance REAL,
            forced_sell REAL,
            forced_sell_ratio REAL,
            PRIMARY KEY (date)
        )
    """)
    
    # Mock data 추가
    cursor.executemany("""
        INSERT INTO index_ohlcv (date, index_name, close) VALUES (?, ?, ?)
    """, [
        ("2026-06-24", "sp500", 5000.0),
        ("2026-06-25", "sp500", 5010.0),
        ("2026-06-26", "sp500", 5020.0),
        ("2026-06-24", "nasdaq100", 18000.0),
        ("2026-06-25", "nasdaq100", 18100.0),
        ("2026-06-26", "nasdaq100", 18200.0),
        ("2026-06-24", "dow30", 39000.0),
        ("2026-06-25", "dow30", 39100.0),
        ("2026-06-26", "dow30", 39200.0),
        ("2026-06-24", "kospi", 2500.0),
        ("2026-06-25", "kospi", 2510.0),
        ("2026-06-26", "kospi", 2520.0),
        ("2026-06-24", "move", 80.0),
        ("2026-06-25", "move", 81.0),
        ("2026-06-26", "move", 82.0),
        ("2026-06-24", "vxsmh", 35.0),
        ("2026-06-25", "vxsmh", 36.0),
        ("2026-06-26", "vxsmh", 37.0),
        # Investing oil (index_ohlcv) — FRED와 혼용 금지
        ("2026-06-24", "wti", 78.5),
        ("2026-06-25", "wti", 79.0),
        ("2026-06-26", "wti", 79.5),
        ("2026-06-24", "brent", 82.0),
        ("2026-06-25", "brent", 82.5),
        ("2026-06-26", "brent", 83.0),
        ("2026-06-24", "copper", 4.50),
        ("2026-06-25", "copper", 4.55),
        ("2026-06-26", "copper", 4.60),
        ("2026-06-24", "gold", 2300.0),
        ("2026-06-25", "gold", 2310.0),
        ("2026-06-26", "gold", 2320.0),
        ("2026-06-24", "silver", 28.5),
        ("2026-06-25", "silver", 29.0),
        ("2026-06-26", "silver", 29.5),
    ])

    # 시가총액(원) — 신용잔고/시총 % 계산용
    cursor.executemany("""
        UPDATE index_ohlcv SET marcap = ? WHERE date = ? AND index_name = ?
    """, [
        (2_000_000_000_000_000, "2026-06-24", "kospi"),
        (2_000_000_000_000_000, "2026-06-25", "kospi"),
        (2_500_000_000_000_000, "2026-06-26", "kospi"),
    ])
    cursor.executemany("""
        INSERT INTO index_ohlcv (date, index_name, close, marcap) VALUES (?, ?, ?, ?)
    """, [
        ("2026-06-24", "kosdaq", 850.0, 400_000_000_000_000),
        ("2026-06-25", "kosdaq", 855.0, 400_000_000_000_000),
        ("2026-06-26", "kosdaq", 860.0, 400_000_000_000_000),
    ])

    # KOFIA 신용잔고 (백만원) — API에서 조원·시총% 로 변환됨
    cursor.executemany("""
        INSERT INTO kofia_credit_loan (date, total, kospi, kosdaq) VALUES (?, ?, ?, ?)
    """, [
        ("2026-06-24", 26_000_000, 20_000_000, 6_000_000),
        ("2026-06-25", 26_500_000, 20_400_000, 6_100_000),
        ("2026-06-26", 27_000_000, 20_800_000, 6_200_000),
    ])

    # KOFIA 증시자금 (백만원, 비중 %) — forced_sell은 API에서 억원으로 변환됨
    cursor.executemany("""
        INSERT INTO kofia_stock_money
        (date, deposit, deriv_deposit, rp_balance, unpaid_balance, forced_sell, forced_sell_ratio)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [
        ("2026-06-24", 120_000_000, 50_000_000, 110_000_000, 1_200_000, 12_000, 1.0),
        ("2026-06-25", 121_000_000, 51_000_000, 111_000_000, 1_250_000, 25_000, 2.0),
        ("2026-06-26", 122_000_000, 52_000_000, 112_000_000, 1_300_000, 50_000, 4.0),
    ])
    
    cursor.executemany("""
        INSERT INTO fred_macro (date, series_id, value) VALUES (?, ?, ?)
    """, [
        ("2026-06-24", "BAMLH0A0HYM2", 3.1),
        ("2026-06-25", "BAMLH0A0HYM2", 3.2),
        ("2026-06-26", "BAMLH0A0HYM2", 3.3),
        ("2026-06-24", "VIX", 15.0),
        ("2026-06-25", "VIX", 16.0),
        ("2026-06-26", "VIX", 17.0),
        # BOK: 구간 시작 전 관측만 있어도 ffill 되어야 함
        ("2026-06-20", "BOK_BASE", 2.50),
        ("2026-06-24", "DFF", 4.33),
        ("2026-06-26", "DFF", 4.34),
        # FRED oil spot — Investing와 혼용 금지
        ("2026-06-24", "DCOILWTICO", 77.1),
        ("2026-06-25", "DCOILWTICO", 77.4),
        ("2026-06-26", "DCOILWTICO", 77.8),
        ("2026-06-24", "DCOILBRENTEU", 80.2),
        ("2026-06-25", "DCOILBRENTEU", 80.5),
        ("2026-06-26", "DCOILBRENTEU", 80.9),
        # ISM PMI: DB는 발표일 원본 (6/1 → 차트에서 5월 참조월로 정규화)
        ("2026-06-01", "ISM_PMI", 48.5),
        # 8/3 발표 = 7월치 → 차트 정규화 후 7/1부터 55.6
        ("2026-08-03", "ISM_PMI", 55.6),
        # US GDP & M2 (월간/분기 → ffill)
        ("2026-06-01", "M2SL", 21000.5),
        ("2026-04-01", "GDP", 28000.0),
        ("2026-04-01", "GDPC1", 22500.0),
    ])
    
    cursor.executemany("""
        INSERT INTO cnn_fear_greed (date, value, rating) VALUES (?, ?, ?)
    """, [
        ("2026-06-24", 45.0, "FEAR"),
        ("2026-06-25", 50.0, "NEUTRAL"),
        ("2026-06-26", 55.0, "GREED"),
    ])

    cursor.executemany("""
        INSERT INTO krx_vkospi (date, close) VALUES (?, ?)
    """, [
        ("2026-06-24", 20.0),
        ("2026-06-25", 21.0),
        ("2026-06-26", 22.0),
    ])

    cursor.executemany("""
        INSERT INTO krx_pcr (date, pcratio) VALUES (?, ?)
    """, [
        ("2026-06-24", 0.90),
        ("2026-06-25", 0.95),
        ("2026-06-26", 1.00),
    ])

    cursor.executemany("""
        INSERT INTO us_treasury_yield (date, y2, y10, y2y10_spread, kr10) VALUES (?, ?, ?, ?, ?)
    """, [
        ("2026-06-24", 4.2, 4.5, 0.3, 3.1),
        ("2026-06-25", 4.3, 4.6, 0.3, 3.2),
        ("2026-06-26", 4.4, 4.7, 0.3, 3.3),
    ])

    # 주간 일평균수출 — 구간 시작 전 관측 + 주중 1점만 있어도 ffill
    cursor.executemany("""
        INSERT INTO kr_export_avg (date, export_avg, kospi, source) VALUES (?, ?, ?, ?)
    """, [
        ("2026-06-22", 39.5, 2500.0, "finjump"),
        ("2026-06-26", 40.1, 2520.0, "finjump"),
    ])
    
    conn.commit()
    conn.close()
    
    # os.path.expanduser 모킹
    monkeypatch.setattr(os.path, "expanduser", lambda path: db_path_str if "macro.db" in path else path)
    
    yield db_path_str
    
    if os.path.exists(db_path_str):
        os.remove(db_path_str)

def test_get_macro_chart_data(temp_macro_db):
    response = client.get("/api/charts/macro")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert len(data["data"]) == 3
    
    pt = data["data"][0]
    assert pt["date"] == "2026-06-24"
    assert pt["sp500"] == 5000.0
    assert pt["nasdaq100"] == 18000.0
    assert pt["dow30"] == 39000.0
    assert pt["kospi"] == 2500.0
    assert pt["high_yield"] == 3.1
    assert pt["cnn_fgi"] == 45.0
    assert pt["vix"] == 15.0
    assert pt["vkospi"] == 20.0
    assert pt["pcr"] == 0.90
    assert pt["move"] == 80.0
    assert pt["vxsmh"] == 35.0
    assert pt["us_2y"] == 4.2
    assert pt["us_10y"] == 4.5
    assert pt["us_spread"] == 0.3
    assert pt["kr_10y"] == 3.1
    assert pt["fed_funds"] == 4.33
    assert pt["bok_base"] == 2.50  # 6/20 seed → ffill onto 6/24
    assert pt["wti"] == 78.5
    assert pt["brent"] == 82.0
    assert pt["wti_fred"] == 77.1
    assert pt["brent_fred"] == 80.2
    assert pt["copper"] == 4.50
    assert pt["gold"] == 2300.0
    assert pt["silver"] == 28.5
    assert pt["m2"] == 21000.5
    assert pt["gdp"] == 28000.0
    assert pt["gdp_real"] == 22500.0
    assert pt["export_avg"] == 39.5  # 6/22 seed → ffill onto 6/24
    # 6/1 발표 → 참조월 5/1; 6월 차트에는 48.5 (7월치 55.6은 아직 미적용)
    assert pt["ism_pmi"] == 48.5
    # 신용잔고: 백만원 → 조원, 시총(원) 대비 %
    assert pt["credit_kospi"] == 20.0    # 20,000,000백만원 = 20조원
    assert pt["credit_kosdaq"] == 6.0
    assert pt["credit_kospi_pct"] == 1.0   # 2e13원 / 2e15원 × 100
    assert pt["credit_kosdaq_pct"] == 1.5  # 6e12원 / 4e14원 × 100
    # 반대매매: 백만원 → 억원
    assert pt["forced_sell"] == 120.0
    assert pt["forced_sell_ratio"] == 1.0

    # DFF 관측 없는 날도 직전값 유지
    assert data["data"][1]["fed_funds"] == 4.33
    assert data["data"][2]["fed_funds"] == 4.34
    assert data["data"][2]["bok_base"] == 2.50
    assert data["data"][2]["ism_pmi"] == 48.5
    # 일평균수출: 6/24·6/25는 6/22값, 6/26은 새 관측
    assert data["data"][1]["export_avg"] == 39.5
    assert data["data"][2]["export_avg"] == 40.1
    # Investing / FRED oil 혼용되지 않음
    assert data["data"][1]["wti"] == 79.0
    assert data["data"][1]["wti_fred"] == 77.4
    assert data["data"][1]["wti"] != data["data"][1]["wti_fred"]
    assert data["data"][1]["brent"] != data["data"][1]["brent_fred"]
    # 신용잔고 %: 6/26은 시총 증가(2.5e15) 반영 → 20.8조/2500조 = 0.832%
    assert data["data"][2]["credit_kospi"] == 20.8
    assert data["data"][2]["credit_kospi_pct"] == pytest.approx(0.832)
    assert data["data"][2]["forced_sell"] == 500.0
    
    # 날짜 필터 테스트
    response_filtered = client.get("/api/charts/macro?start_date=2026-06-25&end_date=2026-06-25")
    assert response_filtered.status_code == 200
    data_filtered = response_filtered.json()
    assert len(data_filtered["data"]) == 1
    assert data_filtered["data"][0]["date"] == "2026-06-25"
    assert data_filtered["data"][0]["fed_funds"] == 4.33
    assert data_filtered["data"][0]["bok_base"] == 2.50
    assert data_filtered["data"][0]["ism_pmi"] == 48.5


def test_ism_pmi_release_normalized_to_ref_month(temp_macro_db):
    """Investing 발표일 → 참조월 정규화 후 차트에 반영."""
    # 축에 7월·8월 날짜를 추가 (기존 fixture의 6월 + ISM 8/3 발표)
    import sqlite3 as _sqlite3

    conn = _sqlite3.connect(temp_macro_db)
    conn.executemany(
        "INSERT INTO index_ohlcv (date, index_name, close) VALUES (?, ?, ?)",
        [
            ("2026-07-15", "sp500", 5100.0),
            ("2026-08-04", "sp500", 5110.0),
        ],
    )
    conn.commit()
    conn.close()

    response = client.get(
        "/api/charts/macro?start_date=2026-06-24&end_date=2026-08-04"
    )
    assert response.status_code == 200
    by_date = {p["date"]: p for p in response.json()["data"]}

    assert by_date["2026-06-24"]["ism_pmi"] == 48.5  # 5월 참조 (6/1 발표)
    assert by_date["2026-07-15"]["ism_pmi"] == 55.6  # 7월 참조 (8/3 발표)
    assert by_date["2026-08-04"]["ism_pmi"] == 55.6
