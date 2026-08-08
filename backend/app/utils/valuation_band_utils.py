"""지수 PER/PBR 밴드 계산 유틸.

BPS ≈ Close / PBR, EPS ≈ Close / PER
밴드 = BPS|EPS × multiples
"""

from __future__ import annotations

from typing import Iterable

# 기본 배수 (차트 기본값과 동일)
DEFAULT_PBR_MULTIPLES: tuple[float, ...] = (0.8, 1.0, 1.2, 1.5, 2.0)
DEFAULT_PER_MULTIPLES: tuple[float, ...] = (8.0, 10.0, 12.0, 15.0, 20.0)

ALLOWED_INDEXES: frozenset[str] = frozenset(
    {"kospi", "kospi200", "kosdaq", "kosdaq150"}
)


def parse_multiples(raw: str | None, mode: str) -> list[float]:
    """콤마 구분 배수 문자열을 파싱한다. 비어 있으면 모드별 기본값."""
    if not raw or not raw.strip():
        return list(
            DEFAULT_PBR_MULTIPLES if mode == "pbr" else DEFAULT_PER_MULTIPLES
        )
    out: list[float] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            v = float(part)
        except ValueError as e:
            raise ValueError(f"invalid multiple: {part!r}") from e
        if v <= 0:
            raise ValueError(f"multiple must be > 0: {v}")
        out.append(v)
    if not out:
        raise ValueError("no valid multiples")
    return sorted(set(out))


def multiple_key(m: float) -> str:
    """밴드 dict 키. JS String(number)와 맞추기 위해 불필요 .0 제거 (8.0→'8')."""
    return format(float(m), "g")


def compute_band_levels(
    close: float | None,
    per: float | None,
    pbr: float | None,
    mode: str,
    multiples: Iterable[float],
) -> dict[str, float | None]:
    """한 시점의 밴드 레벨을 계산한다. 결측이면 해당 배수 None."""
    keys = [multiple_key(m) for m in multiples]
    if close is None or close <= 0:
        return {k: None for k in keys}

    if mode == "pbr":
        if pbr is None or pbr <= 0:
            return {k: None for k in keys}
        bps = close / pbr
        return {multiple_key(m): bps * m for m in multiples}

    if mode == "per":
        if per is None or per <= 0:
            return {k: None for k in keys}
        eps = close / per
        return {multiple_key(m): eps * m for m in multiples}

    raise ValueError(f"unsupported mode: {mode!r}")
