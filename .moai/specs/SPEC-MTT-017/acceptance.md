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

# SPEC-MTT-017 수용 기준: "지속 강세 종목" 등락률/테마RS변화 컬럼 추가

## 1. 백엔드 API 수용 기준

### AC-001: PersistentStockItem 스키마 확장

**Given** 기존 `PersistentStockItem` 스키마가 정의되어 있을 때
**When** 스키마를 확인하면
**Then** `change_pct: Optional[float]` 필드가 존재해야 한다
**And** `theme_rs_change: Optional[float]` 필드가 존재해야 한다
**And** 기존 필드 (`stock_name`, `avg_rs`, `count`, `themes`)는 변경되지 않아야 한다

### AC-002: change_pct 정확성 - 최신 날짜 기준

**Given** 종목 "삼성전자"가 5일 윈도우 내 3회 출현하고, 각 날짜별 change_pct가 [1.5, -0.8, 2.3]일 때
**When** `GET /api/stocks/persistent`를 호출하면
**Then** 해당 종목의 `change_pct`는 가장 최근 날짜의 값이어야 한다

### AC-003: theme_rs_change 계산 정확성

**Given** 종목 "A"가 테마 "반도체"(오늘 avg_rs=75, 어제 avg_rs=70)와 테마 "AI"(오늘 avg_rs=80, 어제 avg_rs=82)에 소속될 때
**When** `GET /api/stocks/persistent`를 호출하면
**Then** "반도체" 테마 RS 변화 = 5.0
**And** "AI" 테마 RS 변화 = -2.0
**And** 종목 "A"의 `theme_rs_change` = round(mean(5.0, -2.0), 2) = 1.5

### AC-004: 데이터 없음 처리

**Given** 특정 종목의 `change_pct`가 DB에 NULL일 때
**When** `GET /api/stocks/persistent`를 호출하면
**Then** 해당 종목의 `change_pct`는 `null`이어야 한다

### AC-005: 전일 데이터 없음 처리

**Given** `ThemeDaily`에 특정 테마의 전일 데이터가 없을 때
**When** `GET /api/stocks/persistent`를 호출하면
**Then** 해당 종목의 `theme_rs_change`는 `null`이어야 한다

### AC-006: 하위 호환성

**Given** 기존 클라이언트가 `change_pct`, `theme_rs_change` 필드를 처리하지 않을 때
**When** `GET /api/stocks/persistent`를 호출하면
**Then** 기존 필드 구조와 값은 변경되지 않아야 한다
**And** 새 필드는 Optional이므로 기존 클라이언트에 영향을 주지 않아야 한다

## 2. 프론트엔드 UI 수용 기준

### AC-007: 등락률 컬럼 표시

**Given** "지속 강세 종목" 탭이 로드되었을 때
**When** 테이블을 확인하면
**Then** "등락률" 컬럼이 표시되어야 한다

### AC-008: 등락률 양수 표시

**Given** 종목의 `change_pct`가 2.35일 때
**When** 해당 셀을 확인하면
**Then** "+2.35%" 형식으로 표시되어야 한다
**And** 텍스트 색상은 녹색 계열이어야 한다

### AC-009: 등락률 음수 표시

**Given** 종목의 `change_pct`가 -1.20일 때
**When** 해당 셀을 확인하면
**Then** "-1.20%" 형식으로 표시되어야 한다
**And** 텍스트 색상은 적색 계열이어야 한다

### AC-010: 등락률 null 표시

**Given** 종목의 `change_pct`가 null일 때
**When** 해당 셀을 확인하면
**Then** "-" 또는 빈 값으로 표시되어야 한다

### AC-011: 테마RS변화 컬럼 표시

**Given** "지속 강세 종목" 탭이 로드되었을 때
**When** 테이블을 확인하면
**Then** "테마RS변화" 컬럼이 표시되어야 한다

### AC-012: 테마RS변화 양수 표시

**Given** 종목의 `theme_rs_change`가 3.50일 때
**When** 해당 셀을 확인하면
**Then** 상승 화살표와 함께 값이 표시되어야 한다
**And** 색상은 양수를 나타내는 색상이어야 한다

### AC-013: 테마RS변화 음수 표시

**Given** 종목의 `theme_rs_change`가 -2.10일 때
**When** 해당 셀을 확인하면
**Then** 하강 화살표와 함께 값이 표시되어야 한다
**And** 색상은 음수를 나타내는 색상이어야 한다

### AC-014: 테마RS변화 null 표시

**Given** 종목의 `theme_rs_change`가 null일 때
**When** 해당 셀을 확인하면
**Then** "-" 또는 빈 값으로 표시되어야 한다

### AC-015: 컬럼 순서

**Given** "지속 강세 종목" 탭이 로드되었을 때
**When** 테이블 헤더를 확인하면
**Then** 컬럼 순서는 종목명 | 등락률 | 평균RS | 테마RS변화 | 출현횟수 | 소속 테마 이어야 한다

## 3. 컴포넌트 재사용 수용 기준

### AC-016: ChangePctCell 재사용

**Given** `GroupActionTable.tsx`의 `ChangePctCell` 컴포넌트가 존재할 때
**When** `StrongStocksTable.tsx`에서 등락률을 렌더링하면
**Then** 동일한 컴포넌트(또는 추출된 공통 컴포넌트)를 사용해야 한다
**And** `GroupActionTable`의 등락률 표시와 동일한 형식이어야 한다

### AC-017: RsChangeBadge 재사용

**Given** `GroupActionTable.tsx`의 `RsChangeBadge` 컴포넌트가 존재할 때
**When** `StrongStocksTable.tsx`에서 테마RS변화를 렌더링하면
**Then** 동일한 컴포넌트(또는 추출된 공통 컴포넌트)를 사용해야 한다
**And** `GroupActionTable`의 테마RS변화 표시와 동일한 형식이어야 한다

## 4. 품질 게이트 기준

### 4.1 테스트 기준

- 백엔드 API 응답 필드 존재 여부 테스트
- `change_pct` 최신 날짜 선택 로직 테스트
- `theme_rs_change` 계산 로직 테스트 (다중 테마 평균)
- NULL 처리 테스트 (양쪽 필드)
- 하위 호환성 테스트

### 4.2 검증 방법

- **백엔드**: pytest를 통한 단위/통합 테스트
- **프론트엔드**: 브라우저에서 직접 확인 (등락률/테마RS변화 표시)
- **E2E**: "지속 강세 종목" 탭 로드 후 컬럼 존재 확인

### 4.3 완료 정의 (Definition of Done)

- [x] `PersistentStockItem` 스키마에 두 필드 추가 완료
- [x] `get_persistent_stocks()` 쿼리에 `change_pct` 조회 로직 추가 완료
- [x] `theme_rs_change` 계산 로직 구현 완료
- [x] `PersistentStock` TypeScript 인터페이스 확장 완료
- [x] `StrongStocksTable.tsx`에 두 컬럼 추가 및 렌더링 완료
- [x] 컴포넌트 재사용 (ChangePctCell, RsChangeBadge) 완료
- [x] NULL 케이스 처리 완료
- [x] 기존 기능 정상 동작 확인
- [x] 코드 리뷰 완료
