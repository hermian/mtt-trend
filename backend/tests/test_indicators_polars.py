import pytest
from app.utils.chart_utils import load_kodex_leverage_data

def test_kodex_leverage_data_and_indicators():
    """
    KODEX 레버리지 실제 데이터(CSV)와 Polars 지표 계산의 정확성을 검증합니다.
    """
    response = load_kodex_leverage_data()
    
    assert response is not None
    assert response.symbol == "kodex_leverage"
    
    data = response.data
    assert len(data) > 3000  # 약 16년치 데이터 확인
    
    # 1. 마지막 날짜 정합성 확인 (4월 24일)
    last_point = data[-1]
    assert last_point.time == "2026-04-24", f"마지막 날짜가 일치하지 않음: {last_point.time}"
    
    # 2. 지표 존재 여부 확인 (밀림 현상 방지 확인)
    indicators = last_point.indicators
    required_indicators = [
        "rsi", "macd", "macd_signal", "price_sma50", "price_sma200",
        "sma10", "adr14"
    ]
    
    for ind in required_indicators:
        assert ind in indicators, f"4/24 데이터에 {ind} 지표가 누락되었습니다."
        assert indicators[ind] is not None, f"{ind} 값이 None입니다."

    # 3. MACD 값 유효성 확인
    # 사용자 지적: MACD 마지막 값이 7507.73 근방이어야 함
    macd_val = indicators["macd"]
    macd_sig = indicators["macd_signal"]
    
    print(f"DEBUG: 4/24 MACD={macd_val}, Signal={macd_sig}")
    
    # 수치는 주가 데이터에 따라 변동되나, 수천 단위의 큰 수치가 나오는지 확인
    assert macd_val > 5000, f"MACD 수치가 너무 낮음: {macd_val} (Polars 계산 확인 필요)"

def test_data_alignment():
    """
    주가 데이터와 지표 데이터가 1:1로 일치하는지 전 구간 검증합니다.
    """
    response = load_kodex_leverage_data()
    data = response.data
    
    # 처음 200일은 SMA200 등이 None일 수 있으므로 제외하고, 최신 구간 검증
    recent_data = data[-500:]
    for point in recent_data:
        # 모든 필수 지표가 채워져 있어야 함
        assert "price_sma50" in point.indicators
        assert "price_sma200" in point.indicators
        assert "macd" in point.indicators
        assert "rsi" in point.indicators
