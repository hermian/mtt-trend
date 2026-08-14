import pytest

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
