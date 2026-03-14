---
spec_id: SPEC-MTT-007
version: "1.0.0"
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
---

# 구현 계획: 그룹 액션 탐지 파라미터 툴팁 추가

## 개요

본 문서는 SPEC-MTT-007 "그룹 액션 탐지 파라미터 툴팁 추가"의 구현 계획을 정의합니다.

---

## 마일스톤

### Primary Goal: 툴팁 컴포넌트 구현 및 통합

**목표:**
- 재사용 가능한 툴팁 컴포넌트 생성
- SliderControl 컴포넌트 확장
- 접근성 준수

**작업 항목:**
1. Tooltip 컴포넌트 구현 (Headless UI 기반 또는 커스텀)
2. SliderControl 컴포넌트에 tooltip prop 추가
3. 툴팁 내용 정의 및 적용
4. 접근성 속성 추가 (ARIA)

---

### Secondary Goal: 테스트 및 검증

**목표:**
- 단위 테스트 작성
- 접근성 테스트 수행
- 크로스 브라우저 테스트

**작업 항목:**
1. Jest 단위 테스트 작성
2. React Testing Library로 접근성 테스트
3. Chrome, Firefox, Safari에서 수동 테스트

---

## 기술 접근법

### 1. 툴팁 구현 방식 선택

**옵션 A: Headless UI Popover 사용**
- 장점: 접근성 내장, React 통합 우수
- 단점: 추가 의존성 (이미 설치됨: Headless UI 1.7.0+)

**옵션 B: 커스텀 툴팁 구현**
- 장점: 가벼움, 완전한 제어
- 단점: 접근성 직접 구현 필요

**권장: 옵션 A (Headless UI Popover)**
- 이유: 프로젝트에 이미 Headless UI가 설치되어 있으며, 접근성이 내장되어 있어 구현 시간 단축

### 2. SliderControl 컴포넌트 확장

**기존 구조:**
```tsx
function SliderControl({
  label,
  value,
  min,
  max,
  step,
  rangeLabel,
  onChange,
  unit,
}) {
  // ...
}
```

**확장 구조:**
```tsx
function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  rangeLabel,
  onChange,
  unit = "",
  tooltip, // NEW: 툴팁 내용 (선택적)
}: SliderControlProps & { tooltip?: string }) {
  // ...
}
```

**변경 사항:**
- `tooltip` prop 추가 (선택적)
- 레이블 옆에 툴팁 아이콘 추가
- 툴팁 컴포넌트 렌더링 로직 추가

### 3. GroupActionTable 수정

**변경 위치:** Line 216-244

**기존 코드:**
```tsx
<SliderControl
  label="시간 윈도우"
  value={timeWindow}
  min={1}
  max={7}
  step={1}
  rangeLabel="1-7"
  onChange={setTimeWindow}
  unit="일"
/>
```

**수정 후:**
```tsx
<SliderControl
  label="시간 윈도우"
  value={timeWindow}
  min={1}
  max={7}
  step={1}
  rangeLabel="1-7"
  onChange={setTimeWindow}
  unit="일"
  tooltip="신규 등장 종목 판정 기간 (일)" // NEW
/>
```

### 4. 접근성 구현

**ARIA 속성:**
- `role="tooltip"`: 툴팁 역할 명시
- `aria-describedby`: 레이블과 툴팁 연결
- `aria-hidden="true"`: 장식용 아이콘 숨김

**키보드 네비게이션:**
- Tab: 툴팁 아이콘으로 포커스 이동
- Enter/Space: 툴팁 토글 (선택적)
- Escape: 툴팁 닫기

### 5. 스타일링

**Tailwind CSS 클래스:**
- 툴팁 컨테이너: `relative inline-flex items-center`
- 아이콘: `w-4 h-4 ml-1 text-gray-400 hover:text-gray-300`
- 툴팁 패널: `absolute z-10 w-48 px-3 py-2 text-sm text-gray-100 bg-gray-800 rounded-lg shadow-lg`
- 애니메이션: `transition-opacity duration-150`

---

## 아키텍처 설계 방향

### 컴포넌트 계층 구조

```
GroupActionTable
└── SliderControl (확장)
    ├── label (기존)
    ├── Tooltip (신규)
    │   ├── InformationCircleIcon (Heroicons)
    │   └── 툴팁 패널 (Headless UI Popover.Panel)
    └── input[type="range"] (기존)
```

### 파일 구조

```
frontend/src/
├── app/trend/_components/
│   ├── GroupActionTable.tsx (수정)
│   └── Tooltip.tsx (신규, 선택적)
└── __tests__/
    └── GroupActionTable.test.tsx (수정)
```

**참고:** Tooltip 컴포넌트는 GroupActionTable.tsx 내부에 정의하거나 별도 파일로 분리 가능. 재사용성을 고려하면 별도 파일 권장.

---

## 리스크 및 대응 계획

### 리스크 1: Headless UI Popover 성능

**위험도:** 낮음
**영향:** 툴팁 표시 지연 가능성
**대응:** 100ms 이내 렌더링 검증, 필요 시 커스텀 구현으로 전환

### 리스크 2: 접근성 미준수

**위험도:** 중간
**영향:** WCAG 2.1 AA 미준수 시 법적 이슈 가능성
**대응:** React Testing Library로 자동화된 접근성 테스트, 수동 스크린 리더 테스트

### 리스크 3: 모바일 UX 저하

**위험도:** 낮음
**영향:** 작은 화면에서 툴팁 가려짐 가능성
**대응:** 반응형 디자인으로 위치 자동 조정, 터치 디바이스에서 탭으로 툴팁 표시

### 리스크 4: 기존 기능 회귀

**위험도:** 낮음
**영향:** 슬라이더 기능 변경으로 인한 사이드 이펙트
**대응:** 기존 테스트 케이스 유지, 회귀 테스트 수행

---

## 의존성 분석

### 선행 작업

| 작업 | 상태 | 설명 |
|------|------|------|
| SPEC-MTT-006 | 완료 | 슬라이더 UI 구현 완료 |

### 후행 작업

| 작업 | 예상 시점 | 설명 |
|------|----------|------|
| 없음 | - | - |

### 외부 의존성

| 의존성 | 버전 | 용도 |
|--------|------|------|
| @headlessui/react | 1.7.0+ | 툴팁 컴포넌트 (Popover) |
| @heroicons/react | 2.0+ | InformationCircleIcon |

---

## 품질 게이트

### 코드 품질

- [ ] TypeScript strict mode 통과
- [ ] ESLint 에러 0개
- [ ] Prettier 포맷팅 적용

### 테스트 커버리지

- [ ] Tooltip 컴포넌트 100% 커버리지
- [ ] GroupActionTable 컴포넌트 85%+ 커버리지
- [ ] 접근성 테스트 통과

### 접근성

- [ ] WCAG 2.1 레벨 AA 준수
- [ ] axe-core 자동화 테스트 통과
- [ ] NVDA/JAWS 스크린 리더 테스트 통과

### 성능

- [ ] 툴팁 렌더링 100ms 이내
- [ ] Lighthouse 접근성 점수 90+
- [ ] First Contentful Paint 영향 없음

---

## 구현 순서

1. **Tooltip 컴포넌트 구현** (Headless UI 기반)
2. **SliderControl 컴포넌트 확장** (tooltip prop 추가)
3. **GroupActionTable에 툴팁 적용** (3개 슬라이더)
4. **접근성 속성 추가** (ARIA)
5. **단위 테스트 작성** (Jest + React Testing Library)
6. **접근성 테스트 수행** (자동화 + 수동)
7. **크로스 브라우저 테스트** (Chrome, Firefox, Safari)
8. **문서화 업데이트** (SPEC-MTT-006 문서에 툴팁 내용 추가)

---

## 완료 정의 (Definition of Done)

- [ ] 모든 요구사항 (F-01 ~ F-04) 구현 완료
- [ ] 모든 수용 기준 (AC-01 ~ AC-07) 충족
- [ ] 코드 품질 게이트 통과
- [ ] 테스트 커버리지 달성
- [ ] 접근성 게이트 통과
- [ ] 성능 게이트 통과
- [ ] 코드 리뷰 완료
- [ ] 문서화 업데이트 완료
