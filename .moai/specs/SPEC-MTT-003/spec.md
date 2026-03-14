# SPEC-MTT-003: 신규 급등 테마 탐지 UI 컴포넌트

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-003 |
| 제목 | 신규 급등 테마 탐지 UI 컴포넌트 |
| 상태 | Completed |
| 작성일 | 2026-03-14 |
| 우선순위 | High |
| 의존 SPEC | SPEC-MTT-002 (데이터 파이프라인 완성 및 트렌드 대시보드 MVP) |
| 완료일 | 2026-03-14 |

---

## 배경 (Background)

SPEC-MTT-002에서 급등 테마 탐지 기능의 백엔드 API(`GET /api/themes/surging`)와 프론트엔드 React Query 훅(`useThemesSurging`)이 구현되었다. 그러나 이 훅을 사용하는 **UI 컴포넌트가 누락**되어 있어, 사용자는 급등 테마 데이터를 화면에서 확인할 수 없는 상태이다.

### 현재 구현 상태

| 계층 | 구현 여부 | 파일 |
|------|-----------|------|
| Backend API | 완료 | `backend/app/routers/themes.py` (`/api/themes/surging`) |
| Backend Schema | 완료 | `backend/app/schemas.py` (`ThemeSurgingItem`, `ThemeSurgingResponse`) |
| Frontend API Client | 완료 | `frontend/src/lib/api.ts` (`api.getThemesSurging`) |
| Frontend Hook | 완료 | `frontend/src/hooks/useThemes.ts` (`useThemesSurging`) |
| Frontend UI Component | **미구현** | `SurgingThemesCard.tsx` 없음 |
| 페이지 통합 | **미구현** | `trend/page.tsx`에 섹션 없음 |

### API 응답 형식

`GET /api/themes/surging?date=YYYY-MM-DD&threshold=10&source=52w_high` 응답:

```json
{
  "date": "2026-03-13",
  "threshold": 10,
  "themes": [
    {
      "date": "2026-03-13",
      "theme_name": "반도체",
      "stock_count": 12,
      "avg_rs": 85.2,
      "avg_rs_5d": 70.1,
      "rs_change": 15.1,
      "change_sum": 3.45,
      "volume_sum": 1234567
    }
  ]
}
```

### 프론트엔드 SurgingTheme 타입

```typescript
export interface SurgingTheme {
  date: string;
  theme_name: string;
  avg_rs: number | null;
  avg_rs_5d: number | null;
  rs_change: number | null;
  stock_count: number | null;
}
```

---

## 목표 (Goals)

1. **SurgingThemesCard 컴포넌트 구현**: 급등 테마 데이터를 시각적으로 표시하는 카드/테이블 UI를 만든다.
2. **트렌드 페이지 통합**: `trend/page.tsx`에 급등 테마 섹션을 추가하여 기존 대시보드 흐름에 통합한다.
3. **사용자 상호작용**: Threshold 조절 UI를 제공하여 사용자가 급등 기준을 동적으로 변경할 수 있게 한다.
4. **빈 상태/에러 처리**: 기존 컴포넌트(TopThemesBar 등)와 일관된 로딩/에러/빈 상태 UI를 제공한다.
5. **테스트 커버리지**: SurgingThemesCard 컴포넌트의 단위 테스트를 작성한다.

---

## 사용자 스토리 (User Stories)

**US-01**: 분석가로서, 5일 이동평균 대비 급등한 테마 목록을 대시보드에서 바로 확인하고 싶다. 그래야 모멘텀이 급격히 강해진 테마를 빠르게 포착할 수 있다.

**US-02**: 분석가로서, 급등 기준(threshold)을 슬라이더로 조절하여 민감도를 변경하고 싶다. 그래야 시장 상황에 따라 유연하게 탐지 기준을 바꿀 수 있다.

**US-03**: 분석가로서, 급등 테마가 없을 때 명확한 안내 메시지를 보고 싶다. 그래야 데이터 오류가 아님을 확인할 수 있다.

---

## 요구사항 (EARS 형식)

### F-01: SurgingThemesCard 컴포넌트 구현

**R-01-1: 급등 테마 카드 렌더링**

WHEN 사용자가 선택한 날짜에 대해 급등 테마 데이터가 존재하면
THE SYSTEM SHALL `SurgingThemesCard` 컴포넌트에서 각 급등 테마를 카드 또는 테이블 행으로 표시해야 한다.

- 표시 항목:
  - 테마명 (`theme_name`)
  - RS 점수 변화량 (`rs_change`) -- 5일 이동평균 대비 증가분
  - 현재 평균 RS (`avg_rs`)
  - 5일 평균 RS (`avg_rs_5d`) -- 비교 기준값
  - 종목 수 (`stock_count`)
- 정렬: `rs_change` 내림차순 (API에서 정렬되어 반환됨)
- 스타일: 기존 다크 테마(bg-gray-800, text-white 등)와 일관된 디자인

**R-01-2: RS 변화량 시각적 강조**

THE SYSTEM SHALL RS 변화량(`rs_change`)을 양수일 때 녹색(text-green-400) 계열 색상으로 표시하고, `+` 접두사를 붙여야 한다.

- 표시 형식: `+15.3` (소수점 1자리)
- 색상: `rs_change > 0` 이면 `text-green-400`

**R-01-3: Threshold 조절 UI**

WHEN 사용자가 Threshold 값을 변경하면
THE SYSTEM SHALL 즉시 `useThemesSurging` 훅의 threshold 파라미터를 갱신하여 목록을 새로 조회해야 한다.

- UI 유형: 슬라이더(range input) + 현재 값 표시
- 범위: 5 ~ 50
- 기본값: 10
- 단위 표시: 현재 threshold 값을 숫자로 표시 (예: "기준: +10")

**R-01-4: 컴포넌트 Props 인터페이스**

THE SYSTEM SHALL 다음 Props를 받아야 한다:

```typescript
interface SurgingThemesCardProps {
  date: string;
  source?: DataSource;  // 기본값: "52w_high"
}
```

**R-01-5: 파일 위치**

THE SYSTEM SHALL 컴포넌트를 `frontend/src/app/trend/_components/SurgingThemesCard.tsx`에 생성해야 한다.

- 기존 컴포넌트 파일(TopThemesBar.tsx, StockAnalysisTabs.tsx)과 동일 디렉토리

---

### F-02: trend/page.tsx 통합

**R-02-1: 급등 테마 섹션 추가**

WHEN 사용자가 날짜를 선택한 상태에서 트렌드 페이지를 볼 때
THE SYSTEM SHALL "테마별 RS 점수" 섹션과 "테마 RS 추이" 섹션 사이에 "신규 급등 테마 탐지" 섹션을 배치해야 한다.

- 섹션 제목: "신규 급등 테마 탐지"
- 위치: TopThemesBar 바로 아래, ThemeTrendChart 바로 위
- Props 전달: `selectedDate`와 `source`를 `SurgingThemesCard`에 전달

**R-02-2: 섹션 제목 스타일**

THE SYSTEM SHALL 섹션 제목을 기존 섹션 제목과 동일한 스타일로 표시해야 한다.

- 클래스: `text-lg font-semibold text-white mb-4`
- 기존 패턴 참조: `<h2 className="text-lg font-semibold text-white mb-4">`

---

### F-03: 빈 상태 및 에러 처리

**R-03-1: 로딩 상태**

WHILE `useThemesSurging` 훅이 데이터를 로딩 중이면
THE SYSTEM SHALL 기존 컴포넌트(TopThemesBar)와 일관된 스켈레톤 UI를 표시해야 한다.

- 컨테이너: `bg-gray-800 rounded-xl p-6`
- 스켈레톤: `bg-gray-700 rounded animate-pulse` 요소 3~5개

**R-03-2: 빈 결과 상태**

WHEN 급등 테마가 0건일 때 (threshold 기준 미달)
THE SYSTEM SHALL 안내 메시지를 표시해야 한다.

- 메시지: "현재 기준(+{threshold}) 이상 급등한 테마가 없습니다"
- 컨테이너: `bg-gray-800 rounded-xl p-6`, 중앙 정렬
- 보조 안내: "기준값을 낮추면 더 많은 테마를 확인할 수 있습니다"

**R-03-3: 에러 상태**

IF API 호출이 실패하면
THE SYSTEM SHALL 기존 컴포넌트와 일관된 에러 메시지를 표시해야 한다.

- 메시지: "데이터를 불러오는데 실패했습니다"
- 스타일: `text-red-400`, 중앙 정렬, 컨테이너 높이 `h-48`

---

### F-04: 테스트

**R-04-1: SurgingThemesCard 단위 테스트**

THE SYSTEM SHALL 다음 테스트 케이스를 포함하는 단위 테스트 파일을 작성해야 한다.

- 파일 위치: `frontend/src/app/trend/_components/__tests__/SurgingThemesCard.test.tsx`
- 테스트 케이스:
  1. **데이터 렌더링**: 급등 테마 목록이 올바르게 표시되는지 확인
  2. **로딩 상태**: 로딩 중 스켈레톤 UI가 표시되는지 확인
  3. **빈 상태**: 급등 테마 없을 때 안내 메시지가 표시되는지 확인
  4. **에러 상태**: API 실패 시 에러 메시지가 표시되는지 확인
  5. **Threshold 변경**: 슬라이더 값 변경 시 훅이 새 threshold로 재호출되는지 확인

**R-04-2: 테스트 도구**

THE SYSTEM SHALL 기존 프로젝트의 테스트 도구를 사용해야 한다.

- 테스트 프레임워크: Vitest 또는 Jest (프로젝트 설정에 따름)
- 컴포넌트 테스트: React Testing Library
- API 모킹: `useThemesSurging` 훅 모킹

---

### F-05: 공통 품질 요구사항

**R-05-1: 다크 테마 일관성**

THE SYSTEM SHALL 모든 UI 요소가 기존 대시보드의 다크 테마와 일관되어야 한다.

- 배경: `bg-gray-800` (카드), `bg-gray-700` (입력 필드)
- 텍스트: `text-white` (주요), `text-gray-400` (보조), `text-gray-500` (설명)
- 테두리: `border-gray-600` 또는 `border-gray-700`

**R-05-2: 반응형 대응**

THE SYSTEM SHALL 카드/테이블이 화면 너비에 맞게 반응형으로 조절되어야 한다.

- 모바일: 카드형 레이아웃 (세로 스택)
- 데스크톱: 테이블 또는 그리드 레이아웃

**R-05-3: TypeScript 타입 안전성**

THE SYSTEM SHALL 모든 Props, 상태, 이벤트 핸들러에 명시적 타입을 사용해야 한다.

- `any` 타입 사용 금지
- 기존 `SurgingTheme` 인터페이스(`@/lib/api`) 재사용

---

## 기술 설계 개요 (Technical Design Overview)

### 컴포넌트 구조

```
app/trend/page.tsx
  ├── TopThemesBar (기존)
  │     └── useThemesDaily(selectedDate, source)
  │
  ├── SurgingThemesCard (신규) ← F-01, F-02
  │     ├── state: threshold (기본값: 10)
  │     └── useThemesSurging(selectedDate, threshold, source)
  │           └── GET /api/themes/surging?date=&threshold=&source=
  │
  ├── ThemeTrendChart (기존)
  │     └── useThemeHistory(...)
  │
  └── StockAnalysisTabs (기존)
```

### 데이터 흐름

```
page.tsx (selectedDate, source)
    │
    ▼
SurgingThemesCard
    ├── props: { date, source }
    ├── state: threshold (useState, 기본값: 10)
    ├── useThemesSurging(date, threshold, source)
    │     └── API 호출 → SurgingTheme[]
    └── 렌더링
          ├── Threshold 슬라이더 (range input)
          ├── 급등 테마 목록 (테이블/카드)
          └── 빈 상태/에러/로딩 처리
```

### 기술 스택 (고정)

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14+, TypeScript, TanStack Query v5 |
| Hook | `useThemesSurging` (이미 구현됨) |
| UI 스타일 | Tailwind CSS (다크 테마) |
| 테스트 | Vitest/Jest + React Testing Library |

---

## 범위 외 (Out of Scope)

1. **Backend API 수정**: surging 엔드포인트는 이미 완성되어 있으므로 변경하지 않는다.
2. **useThemesSurging 훅 수정**: 훅도 이미 구현되어 있으므로 변경하지 않는다.
3. **차트/그래프 시각화**: 급등 테마를 차트로 시각화하는 것은 이번 범위에 포함하지 않는다 (테이블/카드 기반).
4. **급등 알림/Push 알림**: 급등 발생 시 알림 기능은 미래 기능이다.
5. **급등 테마 클릭 시 상세 뷰**: 테마 클릭 시 상세 정보 모달/페이지 이동은 별도 SPEC으로 관리한다.

---

## 추적성 (Traceability)

| 태그 | 참조 |
|------|------|
| SPEC-MTT-003 | 본 문서 |
| SPEC-MTT-002/F-04 | 급등 테마 화면 요구사항 원본 |
| SPEC-MTT-002/R-04-1 | 급등 테마 목록 조회 요구사항 |
| SPEC-MTT-002/R-04-2 | Threshold 조절 UI 요구사항 |
