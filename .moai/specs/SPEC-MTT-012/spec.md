# SPEC-MTT-012: 52주 신고가 × MTT 교집합 추천 기능

**TAG**: SPEC-MTT-012
**Status**: Completed
**Priority**: High
**Created**: 2026-03-15
**Domain**: Feature / Data Analysis

---

## Overview

52주 신고가(`52w_high`)와 MTT(`mtt`) 두 데이터 소스에서 동일 날짜에 공통으로 출현하는 테마/종목의 교집합을 분석하여, 높은 신뢰도의 추천 시그널로 제공하는 기능이다.

두 독립적인 분석 방법론이 동시에 동일한 테마/종목을 포착했다는 것은 해당 종목의 강세 신호가 더 강력하다는 의미이므로, 이를 별도의 "교집합 추천" 탭으로 사용자에게 제공한다.

### 핵심 가치

- **신뢰도 향상**: 두 소스의 교차 검증으로 단일 소스 대비 높은 정확도
- **종목 발굴**: 강세 테마 내 핵심 종목을 자동으로 식별
- **직관적 UI**: 별도 탭에서 교집합 결과를 한눈에 파악 가능

---

## Problem Analysis

### Current Issue

현재 대시보드는 `52w_high`와 `mtt` 데이터를 각각 독립적으로 조회할 수 있지만, 두 소스의 교집합을 분석하는 기능은 없다. 사용자가 수동으로 두 소스를 비교하여 공통 테마/종목을 찾아야 하며, 이는 시간 소모적이고 누락 가능성이 높다.

### Root Cause Analysis

1. **Surface Problem**: 두 데이터 소스 간 교차 분석 기능 부재
2. **Immediate Cause**: API에 교집합 쿼리 엔드포인트가 없음
3. **Underlying Cause**: 데이터 모델은 `data_source` 필드로 구분되어 있으나, 교차 쿼리 로직 미구현
4. **Root Cause**: 교집합 분석이라는 비즈니스 요구사항이 아직 구현되지 않음

---

## Environment

### System Context

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, SQLite
- **Frontend**: Next.js (App Router), React 19, TypeScript, TanStack Query
- **Database**: SQLite (`backend/db/trends.sqlite`)
- **Existing Models**:
  - `ThemeDaily`: 테마별 일별 집계 데이터 (date, theme_name, data_source, stock_count, avg_rs, change_sum, volume_sum)
  - `ThemeStockDaily`: 테마별 종목 일별 데이터 (date, theme_name, stock_name, data_source, rs_score, change_pct)
- **Existing Constants**: `SOURCE_52W = "52w_high"`, `SOURCE_MTT = "mtt"`

### Constraints

- [HARD] 기존 API 엔드포인트 및 UI 컴포넌트에 영향을 주지 않아야 함
- [HARD] SQLite 단일 DB 파일 내에서 교집합 쿼리를 수행해야 함
- [HARD] 기존 데이터 모델(`ThemeDaily`, `ThemeStockDaily`)을 변경하지 않아야 함
- [SOFT] 교집합 쿼리 응답 시간 500ms 이내
- [SOFT] 기존 탭 UI 패턴과 일관된 디자인

---

## Assumptions

1. **데이터 동시 존재**: 동일 날짜에 `52w_high`와 `mtt` 데이터가 모두 존재하는 날이 분석 대상
2. **테마명 일치**: 두 소스 간 `theme_name` 문자열이 정확히 일치하는 경우만 교집합으로 판단
3. **종목명 일치**: 두 소스 간 `stock_name` 문자열이 정확히 일치하는 경우만 교집합으로 판단
4. **단일 날짜 조회**: 교집합 분석은 특정 날짜 기준으로 수행됨

---

## Requirements

### REQ-MTT-012-01: 교집합 API 엔드포인트

**WHEN** 클라이언트가 `GET /api/intersection?date=YYYY-MM-DD`를 호출할 때
**THEN** 시스템은 해당 날짜에 `52w_high`와 `mtt` 양쪽에 모두 존재하는 테마/종목 교집합 결과를 반환해야 한다.

### REQ-MTT-012-02: 테마 교집합 (Level 1)

**WHEN** 교집합 분석이 수행될 때
**THEN** 시스템은 동일 `date`에 `52w_high`와 `mtt` 양쪽의 `ThemeDaily` 테이블에 존재하는 `theme_name`을 찾아야 한다.

### REQ-MTT-012-03: 종목 교집합 (Level 2)

**WHEN** 교집합 테마가 식별된 때
**THEN** 시스템은 동일 `date`에 `52w_high`와 `mtt` 양쪽의 `ThemeStockDaily` 테이블에 존재하는 `stock_name`을 찾아야 한다.

### REQ-MTT-012-04: 교집합 랭킹

**WHEN** 교집합 결과가 반환될 때
**THEN** 교집합 종목 수가 많은 테마가 상위에 랭킹되어야 한다.

### REQ-MTT-012-05: 날짜 미지정 시 최신 날짜 사용

**IF** `date` 파라미터가 제공되지 않으면
**THEN** 시스템은 두 소스 모두에 데이터가 존재하는 가장 최근 날짜를 자동으로 사용해야 한다.

### REQ-MTT-012-06: 교집합 데이터 없음 처리

**IF** 해당 날짜에 교집합 결과가 없으면
**THEN** 시스템은 빈 결과와 함께 적절한 메시지를 반환해야 한다.

### REQ-MTT-012-07: 교집합 추천 탭 UI

**WHEN** 사용자가 `StockAnalysisTabs`에서 "교집합 추천" 탭을 클릭할 때
**THEN** 시스템은 교집합 결과를 별도 탭에서 표시해야 한다.

### REQ-MTT-012-08: 교집합 탭 정보 표시

시스템은 **항상** 교집합 결과에 다음 정보를 포함해야 한다:
- 테마명 (`theme_name`)
- 교집합 종목 수 (`intersection_stock_count`)
- 52w_high 소스의 평균 RS (`avg_rs_52w`)
- MTT 소스의 종목 수 (`stock_count_mtt`)
- 교집합 종목 목록 (`intersection_stocks`)

### REQ-MTT-012-09: 프론트엔드 API 클라이언트

**WHEN** 교집합 탭이 활성화될 때
**THEN** 프론트엔드는 React Query를 통해 교집합 API를 호출하고, 로딩/에러 상태를 적절히 처리해야 한다.

---

## Specifications

### API Design

#### Endpoint

```
GET /api/intersection?date=YYYY-MM-DD
```

#### Response Schema

```python
class IntersectionStockItem(BaseModel):
    stock_name: str
    rs_score_52w: int | None = None       # 52w_high 소스의 rs_score
    rs_score_mtt: int | None = None       # mtt 소스의 rs_score
    change_pct_52w: float | None = None   # 52w_high 소스의 change_pct
    change_pct_mtt: float | None = None   # mtt 소스의 change_pct

class IntersectionThemeItem(BaseModel):
    theme_name: str
    intersection_stock_count: int          # 교집합 종목 수
    avg_rs_52w: float | None = None        # 52w_high 소스의 avg_rs
    avg_rs_mtt: float | None = None        # mtt 소스의 avg_rs
    stock_count_52w: int | None = None     # 52w_high 소스의 전체 종목 수
    stock_count_mtt: int | None = None     # mtt 소스의 전체 종목 수
    intersection_stocks: list[IntersectionStockItem]

class IntersectionResponse(BaseModel):
    date: str
    theme_count: int                       # 교집합 테마 수
    total_stock_count: int                 # 전체 교집합 종목 수
    themes: list[IntersectionThemeItem]
```

### Intersection Query Logic

```sql
-- Level 1: 테마 교집합
SELECT t1.theme_name
FROM theme_daily t1
JOIN theme_daily t2
  ON t1.date = t2.date AND t1.theme_name = t2.theme_name
WHERE t1.date = :date
  AND t1.data_source = '52w_high'
  AND t2.data_source = 'mtt';

-- Level 2: 종목 교집합 (테마별)
SELECT s1.stock_name, s1.rs_score, s1.change_pct,
       s2.rs_score AS rs_score_mtt, s2.change_pct AS change_pct_mtt
FROM theme_stock_daily s1
JOIN theme_stock_daily s2
  ON s1.date = s2.date
  AND s1.stock_name = s2.stock_name
  AND s1.theme_name = s2.theme_name
WHERE s1.date = :date
  AND s1.data_source = '52w_high'
  AND s2.data_source = 'mtt'
  AND s1.theme_name = :theme_name;
```

### Architecture Design

```
[StockAnalysisTabs]
  |-- Tab: "지속 강세 종목"  --> StrongStocksTable
  |-- Tab: "그룹 액션 탐지"  --> GroupActionTable
  |-- Tab: "교집합 추천" (NEW) --> IntersectionTab (NEW)
        |
        v
  useIntersection() hook (NEW)
        |
        v
  api.getIntersection() (NEW)
        |
        v
  GET /api/intersection?date=YYYY-MM-DD
        |
        v
  SQLite self-JOIN (ThemeDaily + ThemeStockDaily)
```

### File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/app/routers/stocks.py` | Modify | 교집합 API 엔드포인트 추가 (`GET /api/intersection`) |
| `backend/app/schemas.py` | Modify | `IntersectionStockItem`, `IntersectionThemeItem`, `IntersectionResponse` 스키마 추가 |
| `frontend/src/lib/api.ts` | Modify | TypeScript 인터페이스 및 `api.getIntersection()` 함수 추가 |
| `frontend/src/hooks/useStocks.ts` | Modify | `useIntersection()` React Query 훅 추가 |
| `frontend/src/app/trend/_components/IntersectionTab.tsx` | New | 교집합 추천 탭 컴포넌트 |
| `frontend/src/app/trend/_components/StockAnalysisTabs.tsx` | Modify | `TabId`에 `"intersection"` 추가, `IntersectionTab` 렌더링 |

---

## Traceability

| Requirement | Source | Verification |
|-------------|--------|--------------|
| REQ-MTT-012-01 | User Request | API Integration Test |
| REQ-MTT-012-02 | User Request | Unit Test (SQL Query) |
| REQ-MTT-012-03 | User Request | Unit Test (SQL Query) |
| REQ-MTT-012-04 | User Request | Unit Test (Sorting) |
| REQ-MTT-012-05 | UX Best Practice | Unit Test |
| REQ-MTT-012-06 | Error Handling | Unit Test |
| REQ-MTT-012-07 | User Request | Component Test |
| REQ-MTT-012-08 | User Request | Component Test |
| REQ-MTT-012-09 | Best Practice | Component Test |

---

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 테마명/종목명 불일치 (소스 간 이름 차이) | Medium | High | 실 데이터로 교집합 비율 사전 검증 |
| 교집합 결과가 너무 적음 | Medium | Low | 빈 상태 UI 제공, Level 1 (테마만) 결과도 표시 |
| 특정 날짜에 한쪽 소스 데이터만 존재 | Low | Medium | 양쪽 모두 존재하는 최신 날짜 자동 탐색 |
| SQLite JOIN 성능 이슈 | Low | Low | 기존 인덱스(`idx_td_source`, `idx_tsd_source`) 활용 |

---

## Related SPECs

- **SPEC-MTT-006**: 그룹 액션 탐지 파라미터화 (동일 라우터에서 확장)
- **SPEC-MTT-009**: HTML 자동 감지 및 DB 동기화 (데이터 소스 파싱)
- **SPEC-MTT-010**: 서버 시작 시 자동 동기화 (데이터 가용성)
