---
id: SPEC-MTT-017
version: "1.0.0"
status: completed
created: "2026-03-16"
updated: "2026-03-16"
author: Hosung Kim
priority: medium
tags: [frontend, backend, UI, persistent-stocks]
---

# SPEC-MTT-017 구현 계획: "지속 강세 종목" 등락률/테마RS변화 컬럼 추가

## 1. 마일스톤

### 마일스톤 1: 백엔드 스키마 및 쿼리 수정 (Primary Goal)

**목표**: API 응답에 `change_pct`와 `theme_rs_change` 필드 추가

**작업 목록**:

1. **스키마 확장** (`backend/app/schemas.py`)
   - `PersistentStockItem` 클래스에 `change_pct: Optional[float] = None` 추가
   - `PersistentStockItem` 클래스에 `theme_rs_change: Optional[float] = None` 추가

2. **change_pct 조회 로직 추가** (`backend/app/routers/stocks.py`)
   - `get_persistent_stocks()` 함수 내에서 각 종목의 쿼리 윈도우 내 최신 날짜 `change_pct` 조회
   - 한 종목이 여러 테마/날짜에 출현하므로, 가장 최근 날짜의 레코드에서 `change_pct` 추출

3. **theme_rs_change 계산 로직 추가** (`backend/app/routers/stocks.py`)
   - 기존 `stocks.py` lines 238-243의 패턴 참조
   - 각 종목이 속한 테마 목록 확인
   - 각 테마에 대해 `ThemeDaily` 테이블에서 최근 2일치 `avg_rs` 조회
   - `theme_rs_change = round(today_avg_rs - yesterday_avg_rs, 2)` (테마별)
   - 종목의 최종 `theme_rs_change` = 소속 테마들의 RS 변화 평균

**완료 기준**: `GET /api/stocks/persistent` 응답에 두 필드가 포함되고, 기존 필드에 영향 없음

### 마일스톤 2: 프론트엔드 인터페이스 및 컬럼 추가 (Secondary Goal)

**목표**: UI 테이블에 등락률, 테마RS변화 컬럼 표시

**작업 목록**:

1. **TypeScript 인터페이스 확장** (`frontend/src/lib/api.ts`)
   - `PersistentStock` 인터페이스에 `change_pct?: number` 추가
   - `PersistentStock` 인터페이스에 `theme_rs_change?: number` 추가

2. **테이블 컬럼 추가** (`frontend/src/app/trend/_components/StrongStocksTable.tsx`)
   - `GroupActionTable.tsx`에서 `ChangePctCell` 컴포넌트 import (또는 공통 유틸로 추출)
   - `GroupActionTable.tsx`에서 `RsChangeBadge` 컴포넌트 import (또는 공통 유틸로 추출)
   - 컬럼 정의에 등락률, 테마RS변화 컬럼 추가
   - 컬럼 순서 조정: 종목명 | 등락률 | 평균RS | 테마RS변화 | 출현횟수 | 소속 테마

**완료 기준**: "지속 강세 종목" 탭에서 두 컬럼이 올바르게 표시됨

### 마일스톤 3: 테스트 및 검증 (Final Goal)

**목표**: 변경사항의 정확성과 안정성 검증

**작업 목록**:

1. 백엔드 API 응답 필드 확인 테스트
2. `change_pct` 값 정확성 검증 (최신 날짜 기준)
3. `theme_rs_change` 계산 정확성 검증 (테마 평균)
4. `null` / 데이터 없음 케이스 처리 검증
5. 기존 필드 하위 호환성 확인

**완료 기준**: 모든 테스트 통과, 기존 기능 정상 동작

## 2. 기술 접근 방식

### 2.1 change_pct 조회 전략

현재 `get_persistent_stocks()` 함수는 5일간 3회 이상 출현한 종목을 집계합니다. 한 종목이 여러 테마, 여러 날짜에 출현하므로:

- **전략**: 쿼리 윈도우 내 각 종목의 **가장 최근 날짜** 레코드에서 `change_pct` 추출
- **구현**: 기존 쿼리 결과를 활용하여 종목별 최신 `change_pct`를 딕셔너리로 매핑
- **이유**: 사용자에게 가장 최신 등락률 정보를 제공하기 위함

### 2.2 theme_rs_change 계산 전략

- **전략**: 각 종목의 소속 테마별 RS 변화를 계산 후 **평균**
- **계산 기준일**: 쿼리 윈도우 내 가장 최근 날짜를 기준으로 `ThemeDaily` 테이블에서 해당 일자와 전일 `avg_rs` 조회
- **참조 구현**: `stocks.py` lines 238-243의 `round(theme_rs_today - theme_rs_yesterday, 2)` 패턴
- **이유**: 한 종목이 여러 테마에 속할 수 있으므로 단일 테마 RS가 아닌 평균값이 대표성 있음

### 2.3 컴포넌트 재사용 전략

- `ChangePctCell`과 `RsChangeBadge`는 `GroupActionTable.tsx`에 정의되어 있음
- **접근 1 (권장)**: 해당 컴포넌트를 공통 유틸 파일로 추출하여 양쪽에서 import
- **접근 2 (간편)**: `GroupActionTable.tsx`에서 직접 import하여 사용
- 두 접근 모두 구현 시 동일한 렌더링 결과 보장

## 3. 아키텍처 설계 방향

```
GET /api/stocks/persistent
        |
        v
get_persistent_stocks() -- 기존 로직 유지
        |
        +-- 추가: change_pct 매핑 (종목별 최신 날짜)
        +-- 추가: theme_rs_change 계산 (테마별 RS 차이의 평균)
        |
        v
PersistentStockItem (+ change_pct, theme_rs_change)
        |
        v
StrongStocksTable.tsx
        |
        +-- ChangePctCell (재사용)
        +-- RsChangeBadge (재사용)
```

## 4. 리스크 및 대응 방안

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| `change_pct` 컬럼에 NULL 데이터 존재 | 낮음 | Optional 필드로 처리, UI에서 "-" 표시 |
| `ThemeDaily`에 전일 데이터 없음 (첫 수집일) | 낮음 | `theme_rs_change`를 None으로 반환 |
| 쿼리 성능 저하 (추가 JOIN/서브쿼리) | 중간 | 기존 쿼리 결과 재활용, 별도 쿼리 최소화 |
| 컴포넌트 추출 시 기존 GroupActionTable 영향 | 낮음 | import 경로만 변경, 렌더링 로직 동일 유지 |

## 5. 의존성

- **내부 의존성**: `ThemeStockDaily.change_pct` 컬럼의 데이터 정합성
- **내부 의존성**: `ThemeDaily.avg_rs` 컬럼의 연속 일자 데이터
- **코드 의존성**: `GroupActionTable.tsx`의 `ChangePctCell`, `RsChangeBadge` 컴포넌트
- **외부 의존성**: 없음
