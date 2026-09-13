"""app/utils/mtime_utils.py 단위 테스트.

이 헬퍼는 라우터 캐시(charts.py / stocks.py)의 무효화 키를 만든다. 파일이 없을 때
예외를 던지면 캐시 조회 경로 전체가 500 이 되므로, 0.0 폴백과 '가장 최근 mtime'
선택이 회귀하지 않도록 고정한다.
"""

import os
import time

from app.utils.mtime_utils import file_mtime, newest_mtime


def test_file_mtime_returns_zero_for_missing_file(tmp_path):
    """없는 파일은 예외 대신 0.0 (캐시 미스로 이어져야 한다)."""
    assert file_mtime(tmp_path / "does-not-exist.db") == 0.0


def test_file_mtime_returns_real_mtime(tmp_path):
    f = tmp_path / "a.db"
    f.write_text("x")
    expected = os.path.getmtime(f)
    assert file_mtime(f) == expected


def test_file_mtime_returns_zero_for_directory(tmp_path):
    """디렉터리를 넘겨도 예외를 밖으로 던지지 않는다 (플랫폼별 OSError 흡수)."""
    assert isinstance(file_mtime(tmp_path), float)


def test_newest_mtime_picks_the_most_recent_file(tmp_path):
    old = tmp_path / "old.db"
    new = tmp_path / "new.db"
    old.write_text("old")
    new.write_text("new")
    # 파일시스템 mtime 해상도에 의존하지 않도록 명시적으로 시각을 벌린다.
    past = time.time() - 100
    os.utime(old, (past, past))

    assert newest_mtime(old, new) == os.path.getmtime(new)
    # 순서를 바꿔도 같은 결과여야 한다
    assert newest_mtime(new, old) == os.path.getmtime(new)


def test_newest_mtime_ignores_missing_files(tmp_path):
    """존재하는 파일이 하나뿐이면 그 mtime. 없는 파일은 0.0 으로 무시된다."""
    only = tmp_path / "only.db"
    only.write_text("x")
    assert newest_mtime(tmp_path / "nope.db", only) == os.path.getmtime(only)


def test_newest_mtime_returns_zero_when_all_missing(tmp_path):
    assert newest_mtime(tmp_path / "a.db", tmp_path / "b.db") == 0.0


def test_newest_mtime_with_no_args_is_zero():
    assert newest_mtime() == 0.0
