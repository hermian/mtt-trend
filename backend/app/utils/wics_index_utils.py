"""WICS daily index → D/W/M OHLC aggregation helpers."""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Literal, Optional, Tuple

Timeframe = Literal["D", "W", "M"]
Weight = Literal["MC", "EW"]


def _iso_week_key(date_str: str) -> str:
    """YYYY-MM-DD → ISO week key YYYY-Www (same as screener YearWeek)."""
    from datetime import date

    y, m, d = map(int, date_str.split("-"))
    iso = date(y, m, d).isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _month_key(date_str: str) -> str:
    return date_str[:7]  # YYYY-MM


def period_key(date_str: str, tf: Timeframe) -> str:
    if tf == "D":
        return date_str
    if tf == "W":
        return _iso_week_key(date_str)
    return _month_key(date_str)


def aggregate_closes_to_ohlc(
    rows: Iterable[Tuple[str, float]],
    tf: Timeframe,
) -> List[dict]:
    """
    rows: ordered (date, close) for a single sector.
    Returns list of {time, open, high, low, close} with time = period end date (last day in bucket).
    """
    if tf == "D":
        out = []
        for date_str, close in rows:
            if close is None:
                continue
            c = float(close)
            out.append({"time": date_str, "open": c, "high": c, "low": c, "close": c})
        return out

    buckets: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
    for date_str, close in rows:
        if close is None:
            continue
        buckets[period_key(date_str, tf)].append((date_str, float(close)))

    # Sort by period end date
    periods = []
    for _key, items in buckets.items():
        items.sort(key=lambda x: x[0])
        closes = [c for _, c in items]
        end_date = items[-1][0]
        periods.append(
            {
                "time": end_date,
                "open": closes[0],
                "high": max(closes),
                "low": min(closes),
                "close": closes[-1],
            }
        )
    periods.sort(key=lambda p: p["time"])
    return periods


def default_lookback_start(max_date: Optional[str], tf: Timeframe) -> Optional[str]:
    """Approximate start date for default window (calendar days, not bars)."""
    if not max_date:
        return None
    from datetime import date, timedelta

    y, m, d = map(int, max_date.split("-"))
    end = date(y, m, d)
    if tf == "D":
        start = end - timedelta(days=400)  # ~252 trading days buffer
    elif tf == "W":
        start = end - timedelta(days=104 * 7 + 30)
    else:
        start = end - timedelta(days=60 * 31 + 30)
    return start.isoformat()
