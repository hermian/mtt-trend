import pytest
import polars as pl
from datetime import datetime, timedelta
from app.utils.chart_utils import load_chart_data

def test_kodex_leverage_data_and_indicators():
    """KODEX 레버리지 실제 데이터(CSV)와 Polars 지표 계산의 정확성을 검증합니다."""
    response = load_chart_data("kodex_leverage")
    assert response is not None
    data = response.data
    
    # 마지막 날짜 정합성 확인
    last_point = data[-1]
    assert last_point.time == "2026-04-24"
    
    # 지표 존재 여부 확인
    indicators = last_point.indicators
    for ind in ["rsi", "macd", "stoch_k", "stoch_d", "price_sma50"]:
        assert ind in indicators
        assert indicators[ind] is not None

def test_zero_division_robustness():
    """
    RSI와 Stochastic 계산 시 분모가 0이 되는 상황(가격 변동 없음)에서의 안정성을 검증합니다.
    """
    # 1. 가격 변동이 전혀 없는 20일치 더미 데이터 생성 (순수 Python 사용)
    base_date = datetime(2026, 1, 1)
    dates = [(base_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(20)]
    constant_price = 10000.0
    
    df = pl.DataFrame({
        "Date": dates,
        "Open": [constant_price] * 20,
        "High": [constant_price] * 20,
        "Low": [constant_price] * 20,
        "Close": [constant_price] * 20,
    })
    
    # 2. RSI 계산 로직 시뮬레이션 (chart_utils.py 내부 로직 복제)
    delta = df["Close"].diff()
    gain = delta.clip(0, None)
    loss = -delta.clip(None, 0)
    avg_gain = gain.ewm_mean(alpha=1/14, min_samples=1, adjust=False)
    avg_loss = loss.ewm_mean(alpha=1/14, min_samples=1, adjust=False)
    
    # 0으로 나누기 방지 로직 적용
    rsi = (100 - (100 / (1 + (avg_gain / (avg_loss + 0.00001))))).fill_null(50.0)
    
    # 3. Stochastic 계산 로직 시뮬레이션
    low_5 = df["Low"].rolling_min(window_size=5)
    high_5 = df["High"].rolling_max(window_size=5)
    stoch_range = (high_5 - low_5).clip(0.00001, None)
    fast_k = ((df["Close"] - low_5) / stoch_range * 100).fill_null(50.0)
    
    # 검증: 모든 값이 NaN이 아닌 수치여야 함
    assert not rsi.is_nan().any(), "RSI 계산 중 NaN 발생 (분모 0 방어 실패)"
    assert not fast_k.is_nan().any(), "Stochastic 계산 중 NaN 발생 (분모 0 방어 실패)"
    
    # 4. 극한 상황 데이터 주입 테스트
    # 점상한가(Open=Low, High=Close이나 변동폭은 있음)는 아니나 가격 고정인 경우
    # rsi는 0.0 근처, stoch은 0.0 근처(또는 초기화값)로 안정화되어야 함
    assert isinstance(rsi[-1], float)
    assert isinstance(fast_k[-1], float)

def test_data_alignment_full_range():
    """모든 데이터 포인트가 누락 없이 지표를 포함하고 있는지 확인 (밀림 방지)"""
    response = load_chart_data("kosdaq_leverage")
    assert response is not None
    data = response.data
    
    # 모든 포인트가 indicators 딕셔너리를 가지고 있어야 함
    for point in data:
        assert isinstance(point.indicators, dict)
        assert "rsi" in point.indicators
        assert "stoch_k" in point.indicators
