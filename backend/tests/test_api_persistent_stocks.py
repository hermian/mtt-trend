"""
지속 강세 종목(persistent stocks) API 테스트

SPEC-MTT-017: 지속 강세 종목 탭에 등락률 및 테마RS변화 컬럼 추가
테스트 작성일: 2026-03-17

RED Phase: change_pct, theme_rs_change 필드 존재 여부 및 값 검증
"""

import pytest
from datetime import datetime, timedelta
import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models import ThemeStockDaily, ThemeDaily


@pytest.fixture(autouse=True)
def setup_database(test_db_session):
    """
    테스트 전후 데이터베이스 설정

    SPEC-MTT-017: change_pct, theme_rs_change 테스트용 데이터 준비
    """
    # 기준 날짜 설정 (2024-01-15)
    base_date = datetime(2024, 1, 15)

    # 최근 5일 날짜 생성 (2024-01-11 ~ 2024-01-15)
    dates = [(base_date - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(4, -1, -1)]

    # 테마 데이터 생성 (ThemeDaily): AI, 반도체 테마
    # 어제(2024-01-14): AI avg_rs=60.0, 반도체 avg_rs=55.0
    # 오늘(2024-01-15): AI avg_rs=65.0, 반도체 avg_rs=58.0
    themes_data = {
        "2024-01-14": {"AI": 60.0, "반도체": 55.0},
        "2024-01-15": {"AI": 65.0, "반도체": 58.0},
    }

    for date, themes in themes_data.items():
        for theme_name, avg_rs in themes.items():
            theme_daily = ThemeDaily(
                date=date,
                theme_name=theme_name,
                stock_count=5,
                avg_rs=avg_rs,
                change_sum=10.0,
                volume_sum=1000000.0,
                data_source="52w_high",
            )
            test_db_session.add(theme_daily)

    # 종목 데이터 생성: 삼성전자는 AI, 반도체 두 테마에 5일 모두 출현
    # 가장 최근 날짜(2024-01-15)의 change_pct = 3.5
    stock_entries = []
    for i, date in enumerate(dates):
        # 삼성전자 - AI 테마 (5일 모두 출현)
        stock_entries.append(
            ThemeStockDaily(
                date=date,
                theme_name="AI",
                stock_name="삼성전자",
                data_source="52w_high",
                rs_score=75,
                change_pct=3.5 if date == "2024-01-15" else 1.0 + i,
            )
        )
        # 삼성전자 - 반도체 테마 (5일 모두 출현)
        stock_entries.append(
            ThemeStockDaily(
                date=date,
                theme_name="반도체",
                stock_name="삼성전자",
                data_source="52w_high",
                rs_score=75,
                change_pct=3.5 if date == "2024-01-15" else 1.0 + i,
            )
        )

    # SK하이닉스 - 반도체 테마만 (5일 출현), 최신 change_pct = -1.2
    for i, date in enumerate(dates):
        stock_entries.append(
            ThemeStockDaily(
                date=date,
                theme_name="반도체",
                stock_name="SK하이닉스",
                data_source="52w_high",
                rs_score=65,
                change_pct=-1.2 if date == "2024-01-15" else -0.5,
            )
        )

    for entry in stock_entries:
        test_db_session.add(entry)

    test_db_session.commit()

    yield

    # 정리
    test_db_session.query(ThemeStockDaily).delete()
    test_db_session.query(ThemeDaily).delete()
    test_db_session.commit()


# -----------------------------------------------------------------------
# SPEC-MTT-017 REQ-1: API 응답에 change_pct 필드 포함
# -----------------------------------------------------------------------

def test_persistent_stocks_response_includes_change_pct(client):
    """
    SPEC-MTT-017: 지속 강세 종목 API 응답에 change_pct 필드가 포함되어야 함
    """
    response = client.get("/api/stocks/persistent?days=5&min=3")
    assert response.status_code == 200

    data = response.json()
    assert "stocks" in data
    assert len(data["stocks"]) > 0

    # 모든 종목에 change_pct 필드가 있어야 함
    for stock in data["stocks"]:
        assert "change_pct" in stock, f"종목 {stock['stock_name']}에 change_pct 필드 없음"


# -----------------------------------------------------------------------
# SPEC-MTT-017 REQ-2: API 응답에 theme_rs_change 필드 포함
# -----------------------------------------------------------------------

def test_persistent_stocks_response_includes_theme_rs_change(client):
    """
    SPEC-MTT-017: 지속 강세 종목 API 응답에 theme_rs_change 필드가 포함되어야 함
    """
    response = client.get("/api/stocks/persistent?days=5&min=3")
    assert response.status_code == 200

    data = response.json()
    assert "stocks" in data
    assert len(data["stocks"]) > 0

    # 모든 종목에 theme_rs_change 필드가 있어야 함
    for stock in data["stocks"]:
        assert "theme_rs_change" in stock, f"종목 {stock['stock_name']}에 theme_rs_change 필드 없음"


# -----------------------------------------------------------------------
# SPEC-MTT-017 REQ-3: change_pct는 조회 윈도우 내 가장 최신 날짜의 값이어야 함
# -----------------------------------------------------------------------

def test_persistent_stocks_change_pct_from_most_recent_date(client):
    """
    SPEC-MTT-017: change_pct는 조회 윈도우 내 가장 최신 날짜 레코드의 값을 반영해야 함
    삼성전자의 2024-01-15 change_pct = 3.5
    """
    response = client.get("/api/stocks/persistent?days=5&min=3")
    assert response.status_code == 200

    data = response.json()
    stocks_map = {s["stock_name"]: s for s in data["stocks"]}

    assert "삼성전자" in stocks_map
    samsung = stocks_map["삼성전자"]
    # 가장 최신 날짜(2024-01-15)의 change_pct는 3.5여야 함
    assert samsung["change_pct"] == pytest.approx(3.5, abs=0.01)


# -----------------------------------------------------------------------
# SPEC-MTT-017 REQ-4: theme_rs_change는 소속 테마들의 RS변화 평균이어야 함
# -----------------------------------------------------------------------

def test_persistent_stocks_theme_rs_change_average_across_themes(client):
    """
    SPEC-MTT-017: theme_rs_change는 종목 소속 테마들의 RS변화량 평균값이어야 함
    삼성전자는 AI(65.0-60.0=5.0), 반도체(58.0-55.0=3.0) 두 테마 소속
    평균 theme_rs_change = (5.0 + 3.0) / 2 = 4.0
    """
    response = client.get("/api/stocks/persistent?days=5&min=3")
    assert response.status_code == 200

    data = response.json()
    stocks_map = {s["stock_name"]: s for s in data["stocks"]}

    assert "삼성전자" in stocks_map
    samsung = stocks_map["삼성전자"]
    # (AI: 65-60=5.0) + (반도체: 58-55=3.0) = 8.0 / 2 = 4.0
    assert samsung["theme_rs_change"] == pytest.approx(4.0, abs=0.01)


# -----------------------------------------------------------------------
# SPEC-MTT-017 REQ-5: 단일 테마 종목의 theme_rs_change
# -----------------------------------------------------------------------

def test_persistent_stocks_theme_rs_change_single_theme(client):
    """
    SPEC-MTT-017: 단일 테마 종목의 theme_rs_change는 해당 테마 RS변화량
    SK하이닉스는 반도체 테마만 소속: 58.0 - 55.0 = 3.0
    """
    response = client.get("/api/stocks/persistent?days=5&min=3")
    assert response.status_code == 200

    data = response.json()
    stocks_map = {s["stock_name"]: s for s in data["stocks"]}

    assert "SK하이닉스" in stocks_map
    sk = stocks_map["SK하이닉스"]
    # 반도체 테마: 58.0 - 55.0 = 3.0
    assert sk["theme_rs_change"] == pytest.approx(3.0, abs=0.01)


# -----------------------------------------------------------------------
# SPEC-MTT-017 REQ-6: ThemeDaily 어제 데이터 없을 때 theme_rs_change = None
# -----------------------------------------------------------------------

def test_persistent_stocks_theme_rs_change_null_when_no_yesterday_data(client, test_db_session):
    """
    SPEC-MTT-017: ThemeDaily에 어제 데이터가 없으면 theme_rs_change는 None이어야 함
    바이오 테마는 오늘 데이터만 있고 어제 데이터 없음
    """
    # 바이오 테마: 오늘(2024-01-15)만 데이터 있음 (어제 없음)
    test_db_session.add(
        ThemeDaily(
            date="2024-01-15",
            theme_name="바이오",
            stock_count=3,
            avg_rs=45.0,
            change_sum=5.0,
            volume_sum=500000.0,
            data_source="52w_high",
        )
    )
    # 바이오 테마에만 소속된 종목 (5일 모두 출현)
    base_date = datetime(2024, 1, 15)
    dates = [(base_date - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(4, -1, -1)]
    for date in dates:
        test_db_session.add(
            ThemeStockDaily(
                date=date,
                theme_name="바이오",
                stock_name="셀트리온",
                data_source="52w_high",
                rs_score=55,
                change_pct=2.0,
            )
        )
    test_db_session.commit()

    response = client.get("/api/stocks/persistent?days=5&min=3")
    assert response.status_code == 200

    data = response.json()
    stocks_map = {s["stock_name"]: s for s in data["stocks"]}

    assert "셀트리온" in stocks_map
    celltrion = stocks_map["셀트리온"]
    # 바이오 테마는 어제 데이터 없으므로 theme_rs_change = None
    assert celltrion["theme_rs_change"] is None
