"""원본 파일 mtime 을 캐시 무효화 키로 쓰기 위한 공용 헬퍼.

데이터는 장 마감 후 1회 갱신되므로 파일 mtime 비교만으로 캐시 무효화가 충분하다.
이 프로젝트의 표준 패턴(`_CHART_CACHE`, `_AVWAP_CACHE`, `_MACRO_CACHE` 등)이 모두
같은 방식이라, 헬퍼를 각 라우터에 복사해 두면 한쪽만 고쳐지는 일이 생긴다.
"""

import os

__all__ = ["file_mtime", "newest_mtime"]


def file_mtime(path) -> float:
    """파일 mtime 을 반환한다. 파일이 없으면 0.0 (예외를 밖으로 던지지 않는다)."""
    try:
        return os.path.getmtime(path)
    except OSError:
        return 0.0


def newest_mtime(*paths) -> float:
    """여러 원본 파일 중 가장 최근 mtime. 하나라도 갱신되면 캐시가 무효화된다."""
    newest = 0.0
    for p in paths:
        newest = max(newest, file_mtime(p))
    return newest
