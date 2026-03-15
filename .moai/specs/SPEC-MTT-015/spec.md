---
id: SPEC-MTT-015
version: 1.0.0
status: draft
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
priority: high
issue_number: 0
lifecycle_level: spec-first
---

# SPEC-MTT-015: 모바일 반응형 사이드바 레이아웃

## HISTORY

| 날짜       | 버전  | 변경 내용                   | 작성자      |
| ---------- | ----- | --------------------------- | ----------- |
| 2026-03-15 | 1.0.0 | 초기 SPEC 작성              | Hosung Kim  |

---

## 1. Environment (환경)

### 1.1 시스템 환경

- **프레임워크**: Next.js 14 (App Router)
- **UI 라이브러리**: React 18
- **스타일링**: Tailwind CSS 3.4
- **타겟 브레이크포인트**:
  - 모바일: < 640px (sm)
  - 소형 태블릿: 640px ~ 767px (sm)
  - 중형 태블릿: 768px ~ 1023px (md)
  - 데스크톱: >= 1024px (lg)

### 1.2 관련 파일

- `frontend/src/app/_components/Sidebar.tsx` (수정 대상)
- `frontend/src/app/trend/page.tsx` (참고 패턴)

### 1.3 제약 사항

- 기존 collapse 기능은 유지되어야 함
- 애니메이션 전환은 부드러워야 함
- Lighthouse 성능 점수 저하 없이 유지

---

## 2. Assumptions (가정)

### 2.1 기술 가정

- [A-01] Tailwind CSS 반응형 클래스가 정상 동작함
- [A-02] 사용자는 모바일에서 주로 세로 모드 사용
- [A-03] 사이드바의 최소 기능 너비는 64px (w-16)
- [A-04] 기존 레이아웃 구조 변경 없이 CSS만 수정

### 2.2 사용자 가정

- [A-05] 모바일 사용자는 아이콘 중심 UI에 익숙함
- [A-06] 태블릿 사용자는 일부 텍스트 라벨 확인 가능
- [A-07] 데스크톱 사용자는 전체 텍스트 라벨 확인 필요

---

## 3. Requirements (요구사항)

### 3.1 Ubiquitous Requirements (보편적 요구사항)

**R-01: 반응형 너비 조정**

> THE SYSTEM SHALL 사이드바 너비가 화면 크기에 따라 자동으로 조절되어야 한다.

**근거**: 고정 너비(224px)는 모바일 화면(375px)의 59.7%를 차지하여 콘텐츠 가독성 저하

**검증 방법**: 각 브레이크포인트에서 사이드바 너비 측정

---

### 3.2 State-Driven Requirements (상태 기반 요구사항)

**R-02: 모바일 최적화**

> IF 화면 너비가 640px 미만인 경우
> THEN 사이드바는 w-16 (64px) 너비를 사용한다.

**조건**:
- 화면 너비 < 640px
- collapse 상태 = false

**기대 동작**:
- 사이드바 너비 = 64px
- 화면 점유율 = 17.1% (375px 기준)

**R-03: 소형 태블릿 대응**

> IF 화면 너비가 640px 이상 768px 미만인 경우
> THEN 사이드바는 w-20 (80px) 너비를 사용한다.

**조건**:
- 640px <= 화면 너비 < 768px
- collapse 상태 = false

**기대 동작**:
- 사이드바 너비 = 80px
- 아이콘 + 축약된 라벨 표시 가능

**R-04: 중형 태블릿 대응**

> IF 화면 너비가 768px 이상 1024px 미만인 경우
> THEN 사이드바는 w-24 (96px) 너비를 사용한다.

**조건**:
- 768px <= 화면 너비 < 1024px
- collapse 상태 = false

**기대 동작**:
- 사이드바 너비 = 96px
- 아이콘 + 라벨 표시 가능

**R-05: 데스크톱 기본값**

> IF 화면 너비가 1024px 이상인 경우
> THEN 사이드바는 w-56 (224px) 너비를 사용한다.

**조건**:
- 화면 너비 >= 1024px
- collapse 상태 = false

**기대 동작**:
- 사이드바 너비 = 224px (기존 동작 유지)
- 전체 메뉴 텍스트 표시

---

### 3.3 Event-Driven Requirements (이벤트 기반 요구사항)

**R-06: Collapse 기능 유지**

> WHEN 사용자가 collapse 버튼을 클릭하면
> THEN 사이드바는 w-16 (64px)으로 축소된다.

**트리거**: collapse 버튼 클릭

**사전 조건**: 모든 화면 크기

**사후 조건**:
- 사이드바 너비 = 64px
- collapse 상태 = true
- 아이콘만 표시

---

### 3.4 Optional Requirements (선택적 요구사항)

**R-07: 부드러운 전환 애니메이션 (권장)**

> WHERE 가능하면
> THE SYSTEM SHALL 너비 변경 시 부드러운 CSS 전환을 제공해야 한다.

**구현 방법**: `transition-all duration-200` Tailwind 클래스

**우선순위**: Medium (권장 사항)

---

## 4. Specifications (명세)

### 4.1 구현 명세

**수정 파일**: `frontend/src/app/_components/Sidebar.tsx`

**수정 위치**: Line 44

**변경 내용**:

```typescript
// Before
collapsed ? "w-16" : "w-56"

// After
collapsed ? "w-16" : "w-16 sm:w-20 md:w-24 lg:w-56"
```

**전체 클래스 구성**:
```typescript
className={`
  ${collapsed ? "w-16" : "w-16 sm:w-20 md:w-24 lg:w-56"}
  h-screen
  bg-slate-800
  transition-all
  duration-200
  flex
  flex-col
  shadow-xl
`.trim()}
```

### 4.2 브레이크포인트 명세

| 브레이크포인트 | Tailwind | 최소 너비 | 사이드바 너비 | 화면 점유율 (기준) |
| -------------- | -------- | --------- | ------------- | ------------------ |
| 모바일         | (기본)   | 0px       | 64px (w-16)   | 17.1% (375px)      |
| 소형 태블릿    | sm       | 640px     | 80px (w-20)   | 12.5% (640px)      |
| 중형 태블릿    | md       | 768px     | 96px (w-24)   | 12.5% (768px)      |
| 데스크톱       | lg       | 1024px    | 224px (w-56)  | 21.9% (1024px)     |

### 4.3 기존 패턴 참조

`frontend/src/app/trend/page.tsx:121`에서 유사한 반응형 패턴 확인:

```typescript
// 참고: 그리드 반응형 패턴
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
```

### 4.4 비즈니스 규칙

- [BR-01] 모든 화면 크기에서 내비게이션 기능 유지
- [BR-02] 아이콘 크기는 모든 브레이크포인트에서 동일
- [BR-03] 활성 메뉴 표시는 모든 브레이크포인트에서 명확히 식별 가능

---

## 5. Traceability (추적성)

### 5.1 TAG 매핑

```
@SPEC-MTT-015
@REQ-R-01: 반응형 너비
@REQ-R-02: 모바일 최적화
@REQ-R-03: 소형 태블릿
@REQ-R-04: 중형 태블릿
@REQ-R-05: 데스크톱 기본값
@REQ-R-06: Collapse 기능
@REQ-R-07: 전환 애니메이션
```

### 5.2 의존성

- **선행 작업**: 없음 (독립적 변경)
- **후속 작업**: 없음
- **관련 SPEC**: 없음

### 5.3 영향 범위

| 파일                               | 변경 유형 | 영향도 |
| ---------------------------------- | --------- | ------ |
| `frontend/src/app/_components/Sidebar.tsx` | 수정      | 낮음   |

---

## 6. Out of Scope

다음은 본 SPEC 범위에서 제외:

- 사이드바 메뉴 항목 추가/변경
- 새로운 브레이크포인트 정의
- 다크/라이트 모드 전환
- 사이드바 숨김/표시 토글 기능
- 드로어(Drawer) 패턴으로의 전환

---

## 7. References

- Tailwind CSS 반응형 디자인: https://tailwindcss.com/docs/responsive-design
- 기존 구현: `frontend/src/app/_components/Sidebar.tsx`
- 참고 패턴: `frontend/src/app/trend/page.tsx:121`
