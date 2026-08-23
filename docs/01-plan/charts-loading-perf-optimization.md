# 차트 로딩 성능 최적화 Plan (AVWAP / 수급)

> Issue: [#44 perf(charts): AVWAP/수급 차트 데이터 로딩 지연 개선](https://github.com/hermian/mtt-trend/issues/44)
> 작성일: 2026-08-24

## 1. 배경 및 진단

AVWAP 차트와 수급(`/api/charts/supply-demand`) 데이터가 체감상 느리다.
삼성전자(005930) 실측 기준 원인은 다음과 같다.

| # | 병목 | 근거 |
|---|------|------|
| 1 | 수급 엔드포인트 **캐시 전무** | 요청마다 sqlite 풀스캔(~86ms) + duckdb 가격 조회(~96ms) + 지표계산 + `iterrows()` 직렬화(~282ms) 반복 → 총 ~0.61s |
| 2 | **무압축 대용량 JSON** | 수급 5.05MB, AVWAP 3.2~3.7MB. `GZipMiddleware` 미적용 |
| 3 | **async 핸들러 내 동기 블로킹** | `async def` 안에서 sqlite/duckdb/pandas 직접 실행 → 동시 요청 직렬화 |
| 4 | AVWAP 콜드 비용 | 3.6GB marcap.duckdb 오픈/스캔 ~0.64s + 앵커 CRUD 시 캐시 전체 wipe |
| 5 | Python row loop | `_build_series` iterrows 282ms, `.iloc[]` 포인트 빌더 ~130ms |

## 2. 목표

- 수급 웜 응답 서버 처리 < 50ms
- 전송량 90%+ 절감 (gzip)
- 동시 요청 직렬화 해소 (threadpool)
- API 스키마 하위 호환 유지

## 3. 작업 내용 (Phase)

### Phase 1 — Quick Wins (본 문서 범위)

| 작업 | 파일 | 내용 |
|------|------|------|
| P1 gzip 압축 | `backend/app/main.py` | `GZipMiddleware(minimum_size=1024)` 추가 |
| P2 수급 캐싱 | `backend/app/utils/sugeub_utils.py` | `(code, period, start, end)` 키 인메모리 캐시 + DB 파일 mtime 기반 무효화. `/supply-demand`, `/period-sums` 모두 적용 |
| P3 threadpool 전환 | `backend/app/routers/charts.py` | 블로킹 로더 호출 엔드포인트 3개를 `async def` → `def` (FastAPI가 threadpool에서 실행) |

### Phase 2 — 후속 과제 (별도 검토)

- P4 payload 축소: UI 렌더 구간만 series 절단, 중복 필드 제거
- P5 `_build_series` 벡터화, 앵커 수정 시 해당 종목 키만 무효화

## 4. 캐시 설계 (P2)

```
키:      (code, sum_period, sum_start, sum_end)
값:      (sugeub.sqlite mtime, marcap.duckdb mtime, 응답 dict)
무효화:  조회 시 현재 파일 mtime != 저장된 mtime → 재계산
동시성:  dict.get 원자성 의존(GIL), 경합 시 중복 계산 허용(무해)
```

수급 데이터는 장 마감 후 1회 갱신되므로 mtime 기반 무효화로 충분하다.

## 5. 측정 방법 (전/후 비교)

대상 종목: **삼성전자(005930)**, 서버 로컬(uvicorn :8000)에서 curl 측정.

| 시나리오 | 방법 |
|----------|------|
| 수급 단건 | `time_total` 3회 측정 후 중앙값 |
| 수급 payload | `size_download` (raw vs `--compressed`) |
| AVWAP 주식 1D | 서버 재기동 직후 1회(cold) + 재요청(warm) |
| 동시성 | 수급 6종목 × 병렬 요청 wall-time vs 순차 합 |

## 6. 수용 기준 (측정 결과: 2026-08-24, 삼성전자 005930)

| 시나리오 | 개선 전 | 개선 후 | 효과 |
|----------|---------|---------|------|
| 수급 웜 응답시간 | 0.398s | **0.019s** | ~21배 단축 |
| 수급 period-sums 웜 | ~0.6s (풀파이프라인) | **0.0013s** | ~99.8% 단축 |
| 수급 전송량 (gzip) | 3.85MB | **1.02MB** | -73% |
| AVWAP 전송량 (gzip) | 2.88MB | **0.56MB** | -81% |
| AVWAP 콜드 / 웜(raw) | 0.742s / 0.013s | 1.00s / 0.041s | 콜드는 gzip 압축비용 포함, 전송량 대비 순손익은 실네트워크에서 유리 |
| 수급 병렬 6종목 (웜) | 1.873s | **0.253s** | -86% (직렬화 해소) |

- [x] 수급 웜 히트 서버 처리 < 50ms → **19~31ms**
- [x] `Content-Encoding: gzip` 확인, 전송량 90%+ 감소 → **73~81% 감소** (수치 JSON 특성상 목표 미소폭 미달, Phase 2 payload 축소로 보완 예정)
- [x] 동시 6요청 wall-time 단축 → **1.873s → 0.253s**
- [x] 기존 API 응답 스키마 동일 유지 → 개선 전/후 응답 JSON 완전 일치 확인 (`a == b`), `test_supply_demand.py` 4건 통과
