"""mtime 키 인메모리 응답 캐시 헬퍼.

데이터가 장 마감 후 1회 갱신되는 이 프로젝트에서는 원본 파일의 mtime 을 무효화 키로
쓰는 것으로 충분하다. 캐시마다 상한을 두어 무한 증가를 막는다.
"""

__all__ = ["cached_by_mtime"]


def cached_by_mtime(cache: dict, cache_max: int, key, mtime: float, compute, should_cache=None):
    """mtime 키 캐시 조회. 미스면 compute() 실행 후 저장하고, 상한을 넘으면 가장 오래된 항목을 버린다.

    should_cache 를 주면 그 결과가 False 일 때 저장하지 않는다. 일시적 오류(DB 락 등)로
    만들어진 빈 응답이 다음 mtime 변경까지 눌러앉는 것을 막기 위한 것으로, compute() 는
    실패 시 None 을 돌려주고 호출부가 빈 응답으로 폴백한다.

    주의: 반환된 객체는 요청 간에 공유된다. 호출부는 절대 제자리에서 변형하지 말 것.
    """
    hit = cache.get(key)
    if hit is not None and hit[0] == mtime:
        return hit[1]
    value = compute()
    if should_cache is not None and not should_cache(value):
        return value
    if len(cache) >= cache_max:
        cache.pop(next(iter(cache)))
    cache[key] = (mtime, value)
    return value
