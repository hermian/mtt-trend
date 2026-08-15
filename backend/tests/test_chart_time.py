import pytest
from pathlib import Path

from app.utils.chart_utils import load_chart_data, normalize_chart_time


def test_normalize_chart_time_strips_iso_nanos():
    """kospi_mtt.csv Date is pandas datetime: 1995-05-02T00:00:00.000000000."""
    assert normalize_chart_time("1995-05-02T00:00:00.000000000") == "1995-05-02"
    assert normalize_chart_time("2026-08-14") == "2026-08-14"
    assert normalize_chart_time("2026-08-14 00:00:00") == "2026-08-14"


def test_kospi_api_times_are_yyyy_mm_dd():
    response = load_chart_data("kospi")
    if response is None or not response.data:
        pytest.skip("kospi_mtt.csv not available")
    sample = response.data[0].time
    assert "T" not in sample
    assert len(sample) == 10
    assert sample[4] == "-" and sample[7] == "-"


def test_kosdaq_amount_volume_populated():
    response = load_chart_data("kospi")
    if response is None or not response.data:
        pytest.skip("kospi_mtt.csv not available")
    assert len(response.data) > 0
    # Every data point should have indicators
    for p in response.data:
        assert p.indicators is not None
        assert "kosdaq_amount" in p.indicators
        assert "kosdaq_volume" in p.indicators


def test_kosdaq_amount_volume_2013_real_cache(monkeypatch):
    real_cache = Path.home() / ".cache" / "db" / "kodex_leverage"
    if not (real_cache / "kospi_mtt.csv").exists() or not (real_cache / "kosdaq_mtt.csv").exists():
        pytest.skip("Real cache not available")
    monkeypatch.setenv("MTT_LEVERAGE_CSV_DIR", str(real_cache))
    response = load_chart_data("kospi")
    assert response is not None
    points_2013 = [p for p in response.data if p.time.startswith("2013")]
    assert len(points_2013) > 200
    for p in points_2013:
        assert p.indicators.get("kosdaq_amount") is not None
        assert p.indicators.get("kosdaq_amount") > 0
        assert p.indicators.get("kosdaq_volume") is not None
        assert p.indicators.get("kosdaq_volume") > 0


def test_kospi_adr14_and_adr20_distinct():
    response = load_chart_data("kospi")
    if response is None or not response.data:
        pytest.skip("kospi_mtt.csv not available")
    sample_points = response.data[50:]
    assert len(sample_points) > 100
    distinct_count = 0
    for p in sample_points:
        adr14 = p.indicators.get("adr14")
        adr20 = p.indicators.get("adr20")
        assert adr14 is not None
        assert adr20 is not None
        if abs(adr14 - adr20) > 0.01:
            distinct_count += 1
    assert distinct_count > len(sample_points) * 0.8



