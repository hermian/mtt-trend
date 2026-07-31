# 03-Report: 한국 주식 히트맵

## 결과 요약
easyinvesting.app/#/heatmap 형태의 한국 주식 히트맵을 `/heatmap` 에 구현 완료.
백엔드 8 + 프론트엔드 19 테스트 통과. 기존 실패 테스트(백엔드 1, 프론트엔드 31)는 clean main에서도 동일하게 실패하는 사전 존재 결함으로 본 건과 무관.

## 구현 산출물
| 구분 | 파일 |
|------|------|
| 백엔드 | `app/utils/stock_heatmap_utils.py`, `app/routers/heatmap.py`, `app/schemas.py`(+Heatmap 스키마), `app/main.py`(라우터 등록), `requirements.txt`(+duckdb) |
| 프론트엔드 | `app/heatmap/{page,_components/*,_lib/*}`, `hooks/useStockHeatmap.ts`, `lib/api.ts`(+타입·함수), `Sidebar`/`MobileSidebar` 진입점 |
| 테스트 | `backend/tests/test_api_heatmap.py`, `frontend/src/app/heatmap/__tests__/{treemap,colors}.test.ts` |
| 문서 | `API-DOCUMENTATION.md` (v1.3.0), 본 docs 3종 |

## 검증
* API: 6기간×3그룹 조합 + 시총/limit 필터 curl 검증 (2026-07-29 실데이터, 2,423종목). 콜드 0.25s, 웜 31~57ms.
* 수익률 정합성: parquet `28DChange` 와 stock_price.duckdb rn=29 계산값 일치 확인.
* UI: 헤드리스 브라우저로 그룹/기간/시총칩/직접입력/개수 전환 및 툴팁(삼성전자 005930·KOSPI·IT·-35.45%·시총 1219조·RS 98) 확인. 전체 유니버스 2,423 SVG rect 렌더링.

## 참고/후보 개선
* "섹터"는 parquet `Sector`(10대 섹터) 기준. 레퍼런스의 KRX 27섹터 분류는 로컬 데이터에 없어 미반영 — 필요 시 KRX API 수집 추가.
* 색상 중립 구간은 기간별 고정 테이블(`_lib/colors.ts NEUTRAL`)로 조정 가능.
