---
id: SPEC-MTT-017
version: "1.0.0"
status: draft
created: "2026-03-16"
updated: "2026-03-16"
author: Hosung Kim
priority: medium
issue_number: 0
tags: [frontend, backend, UI, persistent-stocks]
---

# SPEC-MTT-017: "지속 강세 종목" 탭 등락률/테마RS변화 컬럼 추가

## 1. 환경 (Environment)

### 1.1 현재 상태

- **탭**: "지속 강세 종목" (5일 중 3회 이상 출현한 종목)
- **프론트엔드 컴포넌트**: `frontend/src/app/trend/_components/StrongStocksTable.tsx`
- **현재 컬럼**: 종목명, 평균RS, 출현횟수, 소속 테마
- **백엔드 엔드포인트**: `GET /api/stocks/persistent` (`backend/app/routers/stocks.py`, line 75-131)
- **스키마**: `PersistentStockItem` (`backend/app/schemas.py`, lines 88-99)
- **프론트엔드 인터페이스**: `PersistentStock` (`frontend/src/lib/api.ts`, lines 26-31)

### 1.2 누락 항목

| 필드 | DB 존재 여부 | 비고 |
|------|-------------|------|
| `change_pct` (등락률) | `ThemeStockDaily` 테이블에 컬럼 존재 | 쿼리에서 미조회 |
| `theme_rs_change` (테마RS변화) | DB 미존재 | 런타임 계산 필요 (오늘 avg_rs - 어제 avg_rs) |

### 1.3 참조 구현체

- **GroupActionTable.tsx**: 두 컬럼 이미 구현 (lines 273-288, 렌더링 lines 316, 322)
- **ChangePctCell**: 등락률 렌더링 컴포넌트 (lines 111-128) - +/- 색상 코딩
- **RsChangeBadge**: 테마RS변화 렌더링 컴포넌트 (lines 73-109) - 화살표/색상
- **theme_rs_change 계산 로직**: `stocks.py` lines 238-243 - `round(theme_rs_today - theme_rs_yesterday, 2)`

## 2. 가정 (Assumptions)

- A1: `ThemeStockDaily` 테이블의 `change_pct` 컬럼에 유효한 데이터가 존재한다
- A2: `ThemeDaily` 테이블에 연속 일자의 `avg_rs` 데이터가 존재하여 RS 변화 계산이 가능하다
- A3: 한 종목이 여러 테마에 소속될 수 있으며, 여러 날짜에 출현할 수 있다
- A4: `GroupActionTable.tsx`의 `ChangePctCell`, `RsChangeBadge` 컴포넌트를 재사용 가능하다
- A5: 기존 API 응답 구조에 필드를 추가하는 것은 하위 호환성을 유지한다 (Optional 필드)

## 3. 요구사항 (Requirements)

### 3.1 기능 요구사항

**FR-001**: WHEN 사용자가 "지속 강세 종목" 탭을 조회할 때, THEN 시스템은 각 종목의 최근 등락률(`change_pct`)을 표시해야 한다.

**FR-002**: WHEN 사용자가 "지속 강세 종목" 탭을 조회할 때, THEN 시스템은 각 종목의 테마RS변화(`theme_rs_change`)를 표시해야 한다.

**FR-003**: WHERE 등락률이 양수일 경우, 시스템은 녹색으로 "+X.XX%" 형식으로 표시해야 한다.

**FR-004**: WHERE 등락률이 음수일 경우, 시스템은 적색으로 "-X.XX%" 형식으로 표시해야 한다.

**FR-005**: WHERE 테마RS변화가 표시될 때, 방향 화살표(상승/하강)와 색상 코딩을 포함해야 한다.

**FR-006**: WHERE 등락률 또는 테마RS변화 데이터가 없을 경우, 시스템은 "-" 또는 빈 값으로 표시해야 한다.

### 3.2 기술 요구사항

**TR-001**: 시스템은 `PersistentStockItem` 스키마에 `change_pct: Optional[float]`와 `theme_rs_change: Optional[float]` 필드를 **항상** 포함해야 한다.

**TR-002**: 시스템은 `PersistentStock` TypeScript 인터페이스에 `change_pct?: number`와 `theme_rs_change?: number` 필드를 **항상** 포함해야 한다.

**TR-003**: WHEN `get_persistent_stocks()` 엔드포인트가 호출될 때, THEN 시스템은 각 종목의 쿼리 윈도우 내 **가장 최근 날짜**의 `change_pct`를 조회해야 한다.

**TR-004**: WHEN `get_persistent_stocks()` 엔드포인트가 호출될 때, THEN 시스템은 각 종목이 속한 테마들의 RS 변화를 계산하고, **테마별 RS 변화의 평균값**을 반환해야 한다.

**TR-005**: `theme_rs_change` 계산 공식: `round(mean(theme_rs_today - theme_rs_yesterday), 2)` (소속 테마 전체 평균)

### 3.3 비기능 요구사항

**NFR-001**: 기존 API 응답 필드는 변경되지 **않아야 한다** (하위 호환성 유지).

**NFR-002**: 추가 쿼리로 인한 응답 시간 증가는 100ms 이내여야 한다.

## 4. 명세 (Specifications)

### 4.1 백엔드 변경

#### 4.1.1 스키마 확장 (`backend/app/schemas.py`)

`PersistentStockItem` 클래스에 다음 필드 추가:

- `change_pct: Optional[float] = None` - 최근 등락률 (%)
- `theme_rs_change: Optional[float] = None` - 테마RS변화 (평균)

#### 4.1.2 쿼리 로직 수정 (`backend/app/routers/stocks.py`)

`get_persistent_stocks()` 함수 (lines 75-131) 수정:

1. **change_pct 조회**: 각 종목별로 쿼리 윈도우 내 가장 최근 날짜의 `ThemeStockDaily.change_pct`를 가져온다
2. **theme_rs_change 계산**:
   - 각 종목이 속한 테마 목록을 확인
   - 각 테마에 대해 `ThemeDaily` 테이블에서 가장 최근 날짜의 `avg_rs`와 그 전날의 `avg_rs`를 조회
   - `theme_rs_change = round(today_avg_rs - yesterday_avg_rs, 2)` (테마별)
   - 종목의 `theme_rs_change`는 소속 테마들의 RS 변화 **평균값**
3. 기존 `stocks.py` lines 238-243의 계산 패턴을 참조

### 4.2 프론트엔드 변경

#### 4.2.1 인터페이스 확장 (`frontend/src/lib/api.ts`)

`PersistentStock` 인터페이스에 다음 필드 추가:

- `change_pct?: number`
- `theme_rs_change?: number`

#### 4.2.2 테이블 컬럼 추가 (`frontend/src/app/trend/_components/StrongStocksTable.tsx`)

1. `GroupActionTable.tsx`의 `ChangePctCell` 컴포넌트를 재사용하여 등락률 컬럼 추가
2. `GroupActionTable.tsx`의 `RsChangeBadge` 컴포넌트를 재사용하여 테마RS변화 컬럼 추가
3. 컬럼 순서: 종목명 | 등락률 | 평균RS | 테마RS변화 | 출현횟수 | 소속 테마

### 4.3 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/schemas.py` (lines 88-99) | `PersistentStockItem` 스키마에 2개 필드 추가 |
| `backend/app/routers/stocks.py` (lines 75-131) | 쿼리 및 결과 조립 로직 수정 |
| `frontend/src/lib/api.ts` (lines 26-31) | `PersistentStock` 인터페이스에 2개 필드 추가 |
| `frontend/src/app/trend/_components/StrongStocksTable.tsx` | 컬럼 추가 및 렌더링 컴포넌트 재사용 |

## 5. 추적성 (Traceability)

- **SPEC-MTT-017-FR-001** -> `backend/app/routers/stocks.py` (change_pct 조회)
- **SPEC-MTT-017-FR-002** -> `backend/app/routers/stocks.py` (theme_rs_change 계산)
- **SPEC-MTT-017-FR-003** -> `StrongStocksTable.tsx` (ChangePctCell 재사용)
- **SPEC-MTT-017-FR-004** -> `StrongStocksTable.tsx` (ChangePctCell 재사용)
- **SPEC-MTT-017-FR-005** -> `StrongStocksTable.tsx` (RsChangeBadge 재사용)
- **SPEC-MTT-017-TR-001** -> `backend/app/schemas.py` (PersistentStockItem 확장)
- **SPEC-MTT-017-TR-002** -> `frontend/src/lib/api.ts` (PersistentStock 확장)
