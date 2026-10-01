"""수급 분석 API 테스트 (#43)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture()
def sugeub_available():
    from pathlib import Path

    db = Path.home() / ".cache" / "db" / "sugeub.sqlite"
    marcap = Path.home() / ".cache" / "db" / "marcap.duckdb"
    if not db.is_file() or not marcap.is_file():
        pytest.skip("sugeub.sqlite or marcap.duckdb not available")
    return True


def test_supply_demand_api_kr_stock(sugeub_available):
    response = client.get("/api/charts/supply-demand?code=039490")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "039490"
    assert data["name"]
    assert len(data["series"]) > 0
    assert len(data["table_supply"]) > 0
    assert len(data["table_lds"]) > 0
    assert len(data["period_sums"]) == 13

    pt = data["series"][-1]
    assert "date" in pt
    assert "close" in pt
    assert "force_oscillator" in pt
    assert "accumulation_3ma" in pt
    assert "dispersion_pct" in pt
    assert "norm_accumulation" not in pt
    assert "period_sums_by_preset" in data
    assert "1m" in data["period_sums_by_preset"]
    assert "3m" in data["period_sums_by_preset"]


def test_supply_demand_series_shape(sugeub_available):
    """series 는 norm_accumulation 을 싣지 않고, 숫자는 소수 2자리로 반올림된다.

    norm_accumulation 은 프론트에서 읽는 곳이 없어(2026-09-13 확인) 페이로드의 20% 를
    차지하는 사장 데이터였다. 반올림은 gzip 전송량을 60% 줄이기 위한 것으로, 차트 표시
    오차는 0.005 이하다.
    """
    import math

    response = client.get("/api/charts/supply-demand?code=005930")
    assert response.status_code == 200
    series = response.json()["series"]
    assert len(series) > 0

    expected_keys = {"date", "close", "force_oscillator", "accumulation_3ma", "dispersion_pct"}
    for pt in series:
        assert set(pt) == expected_keys
        nums = [pt["close"], pt["force_oscillator"],
                *pt["accumulation_3ma"].values(), *pt["dispersion_pct"].values()]
        for v in nums:
            if v is None:
                continue
            assert round(v, 2) == v, f"반올림되지 않은 값: {v}"
            if v == 0:
                assert math.copysign(1.0, v) > 0, "-0.0 이 직렬화됐다"


def test_sugeub_cache_is_bounded(monkeypatch):
    """_SUGEUB_CACHE 는 상한을 넘지 않고, 넘칠 때 가장 오래된 항목을 버린다.

    analysis 엔트리 1개가 실측 9.57MB 이고 키 공간이 2,915 종목이라 상한이 없으면
    최대 27.9GB 까지 자란다. 프로젝트의 다른 캐시는 전부 상한을 갖고 있다.
    """
    from app.utils import sugeub_utils as S

    monkeypatch.setattr(S, "_db_mtimes", lambda: (1.0, 2.0))
    S.invalidate_sugeub_cache()
    try:
        total = S._SUGEUB_CACHE_MAX * 3
        for i in range(total):
            S._store_result(("analysis", f"code{i}", "", "", ""), {"i": i})
        assert len(S._SUGEUB_CACHE) == S._SUGEUB_CACHE_MAX
        # FIFO — 가장 먼저 넣은 키는 남아 있지 않아야 한다
        assert ("analysis", "code0", "", "", "") not in S._SUGEUB_CACHE
        # 가장 최근 키는 살아 있어야 한다
        assert S._SUGEUB_CACHE[("analysis", f"code{total - 1}", "", "", "")][2] == {"i": total - 1}
    finally:
        S.invalidate_sugeub_cache()


def test_supply_demand_sum_period_presets(sugeub_available):
    for preset in ("1m", "3m", "6m", "12m"):
        response = client.get(f"/api/charts/supply-demand?code=005930&sum={preset}")
        assert response.status_code == 200
        data = response.json()
        assert data["sum_period"]["preset"] == preset
        assert len(data["period_sums"]) > 0


def test_supply_demand_api_invalid_code():
    response = client.get("/api/charts/supply-demand?code=INVALID_XYZ_999")
    assert response.status_code == 404


def test_supply_demand_api_missing_code():
    response = client.get("/api/charts/supply-demand")
    assert response.status_code == 422


def test_supply_demand_price_profile_1y_default(sugeub_available):
    response = client.get("/api/charts/supply-demand/price-profile?code=005930")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "005930"
    assert data["name"]
    assert data["preset"] == "1y"
    assert len(data["bins"]) >= 3
    assert "개인" in data["investors"]
    assert "외국인" in data["investors"]
    assert "금융투자" in data["investors"]
    assert "연기금" in data["investors"]
    for b in data["bins"]:
        assert "price_low" in b
        assert "price_high" in b
        assert "price_label" in b
        assert "개인" in b
        assert "외국인" in b
        assert "금융투자" in b
        assert "연기금" in b


def test_supply_demand_price_profile_custom_dates(sugeub_available):
    response = client.get(
        "/api/charts/supply-demand/price-profile?code=222800&start=2026-01-02&end=2026-08-28&bins=7"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "222800"
    assert data["start"] == "2026-01-02"
    assert data["end"] == "2026-08-28"
    assert len(data["bins"]) >= 5


def test_supply_demand_price_profile_invalid_code():
    response = client.get("/api/charts/supply-demand/price-profile?code=INVALID_CODE_999")
    assert response.status_code == 404


def test_supply_demand_kospi_index():
    """KOSPI 지수 수급 분석 API 테스트 (#68)."""
    response = client.get("/api/charts/supply-demand?code=kospi")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "kospi"
    assert data["name"] == "KOSPI"
    assert data["unit"] == "억원"
    assert len(data["series"]) > 1000
    assert len(data["table_supply"]) > 0
    assert len(data["period_sums"]) == 13

    # price profile
    pp_res = client.get("/api/charts/supply-demand/price-profile?code=kospi&preset=1y")
    assert pp_res.status_code == 200
    pp_data = pp_res.json()
    assert pp_data["code"] == "kospi"
    assert pp_data["unit"] == "억원"
    assert len(pp_data["bins"]) >= 3


def test_supply_demand_kosdaq_index():
    """KOSDAQ 지수 수급 분석 API 테스트 (#68)."""
    response = client.get("/api/charts/supply-demand?code=kosdaq")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "kosdaq"
    assert data["name"] == "KOSDAQ"
    assert data["unit"] == "억원"
    assert len(data["series"]) > 1000
    assert len(data["period_sums"]) == 13

    # period sums
    ps_res = client.get("/api/charts/supply-demand/period-sums?code=kosdaq&sum_start=2026-01-01&sum_end=2026-10-01")
    assert ps_res.status_code == 200
    ps_data = ps_res.json()
    assert ps_data["code"] == "kosdaq"
    assert ps_data["unit"] == "억원"
    assert len(ps_data["period_sums"]) == 13


def test_supply_demand_single_day_period_sums():
    """시작일과 종료일이 동일한 단일 거래일 커스텀 합계 계산 검증."""
    ps_res = client.get("/api/charts/supply-demand/period-sums?code=kosdaq&sum_start=2026-10-01&sum_end=2026-10-01")
    assert ps_res.status_code == 200
    data = ps_res.json()
    assert data["sum_period"]["start"] == "2026-10-01"
    assert data["sum_period"]["end"] == "2026-10-01"
    sums = {item["investor"]: item["value"] for item in data["period_sums"]}
    assert round(sums["개인"], 2) == -7781.71
    assert round(sums["외국인"], 2) == 2321.26
    assert round(sums["기관계"], 2) == 6213.33


