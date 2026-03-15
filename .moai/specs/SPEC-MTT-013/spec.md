# SPEC-MTT-013: TopThemesBar 클릭 시 테마 종목 패널 표시

## 메타데이터

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-MTT-013 |
| 제목 | TopThemesBar 클릭 시 테마별 종목 목록 슬라이드 다운 패널 |
| 생성일 | 2026-03-15 |
| 상태 | Completed |
| 우선순위 | High |
| 관련 SPEC | SPEC-MTT-004 (TopThemesBar 컴포넌트) |

---

## 1. 기능 개요

### 배경

현재 TopThemesBar 컴포넌트는 테마별 RS 점수를 가로 막대 차트로 시각화하지만, 각 테마에 속한 개별 종목을 확인할 수 없다. 사용자는 강세 테마를 발견한 후 해당 테마의 구성 종목을 즉시 파악하여 투자 판단에 활용하고자 한다.

### 목표

- TopThemesBar의 가로 막대를 클릭하면 해당 테마의 종목 목록을 Section 1 아래에 슬라이드 다운 패널로 표시
- 종목별 RS 점수 및 등락률을 테이블 형태로 제공
- 직관적인 UX (토글, 애니메이션, 로딩/에러 상태)

### 사용자 스토리

> **테마 투자자**로서, TopThemesBar에서 관심 테마의 막대를 클릭하여 해당 테마에 속한 종목 목록(RS 점수, 등락률)을 즉시 확인하고 싶다. 이를 통해 장 준비 시 테마 분석에서 종목 분석으로 빠르게 전환할 수 있다.

---

## 2. 환경 (Environment)

### 기존 시스템 구조

- **백엔드**: FastAPI + SQLAlchemy, `ThemeStockDaily` 모델에 개별 종목 데이터 저장
- **프론트엔드**: Next.js 14 + Recharts, `TopThemesBar` 컴포넌트에 `Bar` onClick 미구현
- **데이터**: `theme_stock_daily` 테이블에 date, theme_name, stock_name, data_source, rs_score, change_pct 저장

### 기술 스택

- Backend: Python 3.11+, FastAPI 0.109.2, SQLAlchemy 2.0, Pydantic 2.6
- Frontend: Next.js 14, TypeScript, Recharts 2.10, Tailwind CSS, TanStack Query 5.17
- Database: SQLite

---

## 3. 가정 (Assumptions)

- A-01: `theme_stock_daily` 테이블에 데이터가 충분히 적재되어 있다
- A-02: 테마명은 `ThemeStockDaily.theme_name`과 `ThemeDaily.theme_name`이 동일한 값을 사용한다
- A-03: 하나의 테마에 속한 종목 수는 최대 50개 이내이므로 페이지네이션은 불필요하다
- A-04: 프론트엔드에서 `source` (52w_high / mtt) 파라미터가 항상 전달된다

---

## 4. 요구사항 (Requirements) - EARS 형식

### F-01: 백엔드 API - 테마별 종목 조회

**WHEN** 클라이언트가 `GET /api/themes/{name}/stocks` 엔드포인트를 호출하면, **THEN** 시스템은 해당 테마에 속한 종목 목록을 rs_score 내림차순으로 반환해야 한다.

세부 요구사항:

- R-01-01: 시스템은 `GET /api/themes/{name}/stocks?date=YYYY-MM-DD&source=52w_high` 엔드포인트를 제공해야 한다
- R-01-02: 응답 형식은 `{ theme_name: string, date: string, stocks: [{ stock_name: string, rs_score: number, change_pct: number }] }` 이어야 한다
- R-01-03: `ThemeStockDaily` 테이블에서 date, theme_name, data_source로 필터링하여 조회해야 한다
- R-01-04: 결과는 rs_score 내림차순으로 정렬해야 한다
- R-01-05: **IF** date 파라미터가 없으면 **THEN** 최신 날짜의 데이터를 반환해야 한다
- R-01-06: **IF** 해당 테마의 종목 데이터가 없으면 **THEN** 404 에러를 반환해야 한다

### F-02: 프론트엔드 - TopThemesBar 바 클릭 이벤트

**WHEN** 사용자가 TopThemesBar의 가로 막대를 클릭하면, **THEN** 시스템은 클릭한 테마명을 상위 컴포넌트(page.tsx)로 전달해야 한다.

세부 요구사항:

- R-02-01: `TopThemesBar` 컴포넌트에 `onThemeClick?: (themeName: string) => void` prop을 추가해야 한다
- R-02-02: Recharts `Bar` 컴포넌트의 `onClick` prop을 활용하여 클릭 이벤트를 처리해야 한다
- R-02-03: 클릭한 바에 시각적 강조 표시(테두리 또는 투명도 변경)를 적용해야 한다
- R-02-04: 선택된 테마명을 `selectedTheme` 상태로 관리해야 한다

### F-03: 프론트엔드 - ThemeStocksPanel 신규 컴포넌트

**WHEN** 사용자가 테마 막대를 클릭하여 selectedTheme 상태가 설정되면, **THEN** 시스템은 Section 1 아래에 해당 테마의 종목 목록을 슬라이드 다운 패널로 표시해야 한다.

세부 요구사항:

- R-03-01: `ThemeStocksPanel` 컴포넌트를 `frontend/src/app/trend/_components/ThemeStocksPanel.tsx`에 생성해야 한다
- R-03-02: Section 1 (TopThemesBar + SurgingThemesCard) 아래, Section 2 (ThemeTrendChart) 위에 조건부 렌더링해야 한다
- R-03-03: 슬라이드 다운 애니메이션 (CSS transition, max-height 활용)을 적용해야 한다
- R-03-04: 패널 헤더에 선택 테마명 + 종목 수 + 닫기(X) 버튼을 포함해야 한다
- R-03-05: 종목 테이블은 종목명, RS 점수(숫자+색상 코딩), 등락률(+/- 색상 구분)을 표시해야 한다
- R-03-06: 로딩 중 스피너와 에러 상태 메시지를 표시해야 한다
- R-03-07: **WHEN** 사용자가 다른 바를 클릭하면 **THEN** 패널 내용을 해당 테마로 교체해야 한다
- R-03-08: **WHEN** 사용자가 같은 바를 재클릭하면 **THEN** 패널을 닫아야 한다 (토글 동작)
- R-03-09: **WHEN** 사용자가 닫기(X) 버튼을 클릭하면 **THEN** 패널을 닫아야 한다

### F-04: 프론트엔드 - API Hook

시스템은 **항상** 테마 종목 데이터를 React Query 패턴으로 관리해야 한다.

세부 요구사항:

- R-04-01: `useThemeStocks(themeName, date, source)` hook을 `frontend/src/hooks/useThemes.ts`에 추가해야 한다
- R-04-02: `api.getThemeStocks(name, date, source)` 함수를 `frontend/src/lib/api.ts`에 추가해야 한다
- R-04-03: 기존 `useThemesDaily` 패턴을 따라 queryKey, enabled, staleTime을 설정해야 한다
- R-04-04: 응답 타입 `ThemeStock` 인터페이스를 정의해야 한다

---

## 5. 명세 (Specifications)

### 5.1 백엔드 API 명세

#### Endpoint

```
GET /api/themes/{name}/stocks
```

#### Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| name | string (path) | Y | - | 테마명 (URL 인코딩) |
| date | string (query) | N | 최신 날짜 | 조회 날짜 (YYYY-MM-DD) |
| source | string (query) | N | 52w_high | 데이터 소스 (52w_high / mtt) |

#### Response (200 OK)

```json
{
  "theme_name": "AI",
  "date": "2024-01-15",
  "stocks": [
    {
      "stock_name": "삼성전자",
      "rs_score": 85,
      "change_pct": 3.21
    },
    {
      "stock_name": "SK하이닉스",
      "rs_score": 78,
      "change_pct": -1.05
    }
  ]
}
```

#### Error Responses

- 404: 해당 테마의 종목 데이터가 없는 경우

### 5.2 프론트엔드 컴포넌트 구조

#### page.tsx 상태 관리

```
selectedTheme: string | null  // 클릭된 테마명, null이면 패널 숨김
```

#### 렌더링 순서

```
Section 1: grid 2-col [TopThemesBar | SurgingThemesCard]
            |
            v  (selectedTheme !== null 일 때)
ThemeStocksPanel (슬라이드 다운)
            |
            v
Section 2: ThemeTrendChart
Section 3: StockAnalysisTabs
```

#### ThemeStocksPanel Props

```typescript
interface ThemeStocksPanelProps {
  themeName: string;
  date: string;
  source: DataSource;
  onClose: () => void;
}
```

### 5.3 애니메이션 명세

- 슬라이드 다운: CSS `transition` + `max-height` (0px -> auto)
- transition duration: 300ms
- timing function: ease-in-out
- 패널이 닫힐 때도 동일한 애니메이션 역방향 적용

### 5.4 RS 점수 색상 코딩

| RS 범위 | 색상 |
|---------|------|
| 75-100 | 빨강 (#EF4444) |
| 60-74 | 주황 (#F97316) |
| 45-59 | 노랑 (#EAB308) |
| 30-44 | 보라 (#8B5CF6) |
| 0-29 | 파랑 (#3B82F6) |

### 5.5 등락률 색상

| 조건 | 색상 |
|------|------|
| change_pct > 0 | 초록 (text-green-400) |
| change_pct < 0 | 빨강 (text-red-400) |
| change_pct = 0 | 회색 (text-gray-400) |

---

## 6. 영향도 분석

### 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `backend/app/routers/themes.py` | 추가 | `GET /api/themes/{name}/stocks` 엔드포인트 |
| `backend/app/schemas.py` | 추가 | `ThemeStockItem`, `ThemeStocksResponse` 스키마 |
| `frontend/src/lib/api.ts` | 추가 | `ThemeStock` 인터페이스, `getThemeStocks` 함수 |
| `frontend/src/hooks/useThemes.ts` | 추가 | `useThemeStocks` hook |
| `frontend/src/app/trend/_components/TopThemesBar.tsx` | 수정 | `onThemeClick` prop, 선택 강조 |
| `frontend/src/app/trend/_components/ThemeStocksPanel.tsx` | 신규 | 종목 패널 컴포넌트 |
| `frontend/src/app/trend/page.tsx` | 수정 | `selectedTheme` 상태, ThemeStocksPanel 렌더링 |

---

## 7. 추적성 태그

- SPEC-MTT-013-F01: 백엔드 API
- SPEC-MTT-013-F02: TopThemesBar 클릭 이벤트
- SPEC-MTT-013-F03: ThemeStocksPanel 컴포넌트
- SPEC-MTT-013-F04: API Hook
