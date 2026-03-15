# SPEC-MTT-016: 모바일 반응형 레이아웃 수정

## 메타데이터

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-MTT-016 |
| 제목 | 모바일 반응형 레이아웃 수정 |
| 상태 | Planned |
| 우선순위 | High |
| 생성일 | 2026-03-16 |
| 담당 | expert-frontend |

## 관련 SPEC

- SPEC-MTT-004: 테마 트렌드 차트 UI (기존 레이아웃 참조)
- SPEC-MTT-013: 테마 종목 패널

---

## 환경 (Environment)

### 기술 스택

- Next.js 16.1.6 (App Router)
- React 18.2.0
- Tailwind CSS 3.4.1
- TypeScript 5.3+

### 대상 환경

- **PC**: Chrome, Firefox, Safari (1024px+) -- 기존 동작 유지 필수
- **모바일**: Android Chrome (360px~430px), iOS Safari (375px~430px)
- **태블릿**: iPad Safari (768px~1024px)

### 현재 문제 분석

1. **Viewport 메타데이터 형식 오류**: `layout.tsx`에서 `viewport` 속성을 `metadata` 객체 내 문자열로 선언. Next.js 15/16에서는 별도의 `export const viewport` 객체가 필요하며, 현재 형식은 런타임에서 무시됨
2. **사이드바 고정 너비**: `Sidebar.tsx`에서 `w-16`(64px) / `w-56`(224px) 고정. 360px 모바일 화면에서 콘텐츠 영역이 ~248px로 축소
3. **과도한 패딩**: `trend/page.tsx`에서 `p-6`(24px) 적용으로 모바일에서 실효 콘텐츠 영역 추가 축소

### 이전 수정 시도 실패 원인

- 커밋 8770880 (revert ac54190): 사이드바 반응형 변경이 PC 레이아웃까지 깨뜨림
- 커밋 3f1a755 (revert 5c3fdac): viewport 형식 변경이 PC 레이아웃에 영향

**근본 원인**: PC와 모바일을 분리하지 않고 동일 CSS 속성을 수정하여 양쪽 모두 영향받음

---

## 가정 (Assumptions)

1. PC 브라우저 사용자는 현재 레이아웃에 만족하고 있으며 어떤 변경도 감지되어서는 안 된다
2. 모바일 사용자의 주요 사용 시나리오는 "빠른 조회"이므로 사이드바는 기본적으로 숨겨도 된다
3. Tailwind CSS의 반응형 접두사(`md:`, `lg:`)를 활용하면 PC/모바일 독립 스타일링이 가능하다
4. Next.js 16의 `viewport` export는 `metadata` 객체와 분리 선언해도 PC 렌더링에 영향 없다
5. 모바일 breakpoint 기준은 Tailwind 기본값 `md: 768px`을 사용한다

---

## 요구사항 (Requirements)

### R-001: Viewport 메타데이터 분리 (Event-Driven)

**WHEN** Next.js 16 앱이 빌드될 때 **THEN** `layout.tsx`에서 `viewport` 속성은 `metadata` 객체가 아닌 별도의 `export const viewport: Viewport` 객체로 선언되어야 한다.

**상세 변경사항:**
- `metadata` 객체에서 `viewport` 속성 제거
- `import type { Viewport } from "next"` 추가
- `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` 별도 export

**영향 범위:** `frontend/src/app/layout.tsx`만 수정

---

### R-002: 모바일 사이드바 숨김 처리 (State-Driven)

**IF** 화면 너비가 768px 미만(모바일)이면 **THEN** 사이드바는 기본적으로 화면에서 숨겨져야 한다.

**IF** 화면 너비가 768px 이상(PC/태블릿)이면 **THEN** 사이드바는 현재와 동일하게 표시되어야 한다.

**상세 변경사항:**
- `Sidebar.tsx`의 `<aside>` 요소에 모바일에서 숨김 클래스 적용: `hidden md:flex`
- PC에서는 기존 `flex flex-col` 동작 유지
- 모바일 전용 햄버거 메뉴 버튼 추가 (layout.tsx의 `<main>` 영역 상단)
- 모바일에서 햄버거 클릭 시 오버레이 방식으로 사이드바 표시

**영향 범위:** `Sidebar.tsx`, `layout.tsx`

---

### R-003: 모바일 오버레이 사이드바 (Event-Driven)

**WHEN** 모바일 화면에서 햄버거 메뉴 버튼을 클릭하면 **THEN** 사이드바가 오버레이로 화면 위에 표시되어야 한다.

**WHEN** 오버레이 사이드바 외부를 클릭하거나 닫기 버튼을 클릭하면 **THEN** 오버레이 사이드바가 닫혀야 한다.

**상세 구현:**
- `fixed inset-0 z-50` 오버레이 배경(반투명 검정)
- 사이드바는 왼쪽에서 슬라이드 인 애니메이션으로 나타남
- 오버레이 배경 클릭 시 닫힘
- 네비게이션 항목 클릭 시 자동 닫힘

---

### R-004: 모바일 패딩 축소 (State-Driven)

**IF** 화면 너비가 768px 미만이면 **THEN** `trend/page.tsx`의 패딩은 `p-3`(12px)로 축소되어야 한다.

**IF** 화면 너비가 768px 이상이면 **THEN** 기존 `p-6`(24px) 패딩이 유지되어야 한다.

**상세 변경사항:**
- `trend/page.tsx`: `p-6` -> `p-3 md:p-6`
- `space-y-6` -> `space-y-4 md:space-y-6`

**영향 범위:** `frontend/src/app/trend/page.tsx`

---

### R-005: PC 레이아웃 보존 (Unwanted)

시스템은 768px 이상 화면에서 기존 레이아웃을 변경하지 않아야 한다.

**검증 항목:**
- 사이드바 너비 (w-16 / w-56) 동일
- 사이드바 접기/펼치기 동작 동일
- 메인 콘텐츠 영역 패딩 (p-6) 동일
- 모든 컴포넌트 배치 및 간격 동일
- 햄버거 메뉴 버튼이 PC에서 표시되지 않음

---

### R-006: 모바일 헤더 영역 (State-Driven)

**IF** 화면 너비가 768px 미만이면 **THEN** 메인 콘텐츠 상단에 앱 제목과 햄버거 메뉴 버튼이 포함된 모바일 헤더가 표시되어야 한다.

**IF** 화면 너비가 768px 이상이면 **THEN** 모바일 헤더는 표시되지 않아야 한다.

**상세 구현:**
- `layout.tsx`의 `<main>` 내부 상단에 모바일 전용 헤더 배치
- Tailwind: `md:hidden` 적용으로 PC에서 숨김
- 헤더 내용: 햄버거 아이콘 + "MTT Trend" 텍스트

---

## 사양 (Specifications)

### 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `frontend/src/app/layout.tsx` | 수정 | viewport export 분리, 모바일 헤더/오버레이 추가 |
| `frontend/src/app/_components/Sidebar.tsx` | 수정 | `hidden md:flex` 적용, 오버레이 모드 지원 |
| `frontend/src/app/trend/page.tsx` | 수정 | 반응형 패딩 적용 |

### 반응형 Breakpoint 전략

| Breakpoint | 범위 | 사이드바 | 패딩 | 헤더 |
|-----------|------|---------|------|------|
| 모바일 | < 768px | 숨김 (오버레이) | p-3 | 모바일 헤더 표시 |
| 태블릿/PC | >= 768px | 고정 표시 | p-6 | 모바일 헤더 숨김 |

### PC 레이아웃 보존 보장 방법

1. **Mobile-first 접근법 미사용**: 기존 스타일을 기본값으로 유지하고 모바일 스타일만 추가
2. **Tailwind 반응형 접두사 활용**: `md:` 접두사로 PC 스타일 명시적 보존
3. **새로운 CSS 속성만 추가**: 기존 클래스를 제거/변경하지 않고 반응형 클래스만 추가

### 핵심 설계 원칙

> "PC를 바꾸지 않는다. 모바일 전용 스타일만 추가한다."

- `hidden md:flex`: 모바일에서만 숨기고 md 이상에서 기존 flex 유지
- `p-3 md:p-6`: 모바일에서만 패딩 줄이고 md 이상에서 기존 p-6 유지
- `md:hidden`: 모바일 전용 요소를 PC에서 숨김

---

## 추적성 (Traceability)

- TAG: SPEC-MTT-016
- 관련 이슈: 모바일 레이아웃 깨짐 (Android Chrome)
- 관련 revert: ac54190, 5c3fdac
