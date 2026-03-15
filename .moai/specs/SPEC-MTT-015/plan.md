---
id: SPEC-MTT-015
version: 1.0.0
status: draft
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
priority: high
---

# Implementation Plan: 모바일 반응형 사이드바 레이아웃

## 1. 개요

### 1.1 목표

사이드바 너비를 화면 크기에 따라 반응형으로 조정하여 모바일 환경에서 콘텐츠 가독성 개선

### 1.2 문제 정의

**현재 상황**:
- 사이드바 고정 너비: 224px (w-56)
- 모바일 화면 (375px)에서 사이드바 점유율: 59.7%
- 콘텐츠 영역: 151px (40.3%)

**목표 상태**:
- 모바일 사이드바 너비: 64px (w-16)
- 모바일 화면 (375px)에서 사이드바 점유율: 17.1%
- 콘텐츠 영역: 311px (82.9%)
- 개선율: 콘텐츠 영역 105% 증가

---

## 2. 기술 스택 명세

### 2.1 프론트엔드

| 기술             | 버전      | 용도               |
| ---------------- | --------- | ------------------ |
| Next.js          | 14.x      | React 프레임워크   |
| React            | 18.x      | UI 라이브러리      |
| Tailwind CSS     | 3.4.x     | 스타일링            |
| TypeScript       | 5.x       | 타입 안전성        |

### 2.2 브레이크포인트 표준

Tailwind CSS 기본 브레이크포인트 사용:

```typescript
const breakpoints = {
  sm: '640px',   // 소형 태블릿
  md: '768px',   // 중형 태블릿
  lg: '1024px',  // 데스크톱
  xl: '1280px',  // 대형 데스크톱
};
```

---

## 3. 마일스톤

### 3.1 Milestone 1: 구현 (Primary Goal)

**목표**: 반응형 사이드바 너비 적용

**작업 항목**:
- [ ] `Sidebar.tsx` 너비 클래스 변경
- [ ] 로컬 개발 환경 테스트
- [ ] 브레이크포인트별 동작 검증

**완료 기준**:
- 모든 브레이크포인트에서 명세된 너비 적용
- 기존 collapse 기능 정상 동작
- TypeScript 컴파일 오류 없음

### 3.2 Milestone 2: 검증 (Secondary Goal)

**목표**: 품질 검증 및 최적화

**작업 항목**:
- [ ] 크로스 브라우저 테스트 (Chrome, Safari, Firefox)
- [ ] 실제 디바이스 테스트 (iOS, Android)
- [ ] Lighthouse 성능 점수 확인
- [ ] 접근성 검증

**완료 기준**:
- Lighthouse 성능 점수 90점 이상 유지
- 모든 테스트 디바이스에서 정상 동작
- 접근성 위반 사항 없음

### 3.3 Milestone 3: 문서화 (Final Goal)

**목표**: 변경 사항 문서화

**작업 항목**:
- [ ] 변경 사항 CHANGELOG 업데이트
- [ ] 커밋 메시지에 SPEC ID 포함

**완료 기준**:
- 문서화 완료
- Git 커밋 완료

---

## 4. 구현 접근법

### 4.1 변경 전 코드

```typescript
// frontend/src/app/_components/Sidebar.tsx (Line 44)
<div className={`
  ${collapsed ? "w-16" : "w-56"}
  h-screen
  bg-slate-800
  // ... 기타 클래스
`}>
```

### 4.2 변경 후 코드

```typescript
// frontend/src/app/_components/Sidebar.tsx (Line 44)
<div className={`
  ${collapsed ? "w-16" : "w-16 sm:w-20 md:w-24 lg:w-56"}
  h-screen
  bg-slate-800
  transition-all
  duration-200
  // ... 기타 클래스
`}>
```

### 4.3 변경 이유

| 요소          | 변경 내용                    | 이유                           |
| ------------- | ---------------------------- | ------------------------------ |
| 기본 너비     | `w-56` → `w-16`              | 모바일 우선 접근법            |
| sm 브레이크   | 추가: `sm:w-20`              | 소형 태블릿 대응              |
| md 브레이크   | 추가: `md:w-24`              | 중형 태블릿 대응              |
| lg 브레이크   | `w-56` → `lg:w-56`           | 데스크톱 기존 동작 유지       |
| transition    | `transition-all duration-200` | 부드러운 너비 전환 애니메이션 |

### 4.4 참고 패턴

`frontend/src/app/trend/page.tsx:121`의 그리드 반응형 패턴:

```typescript
// 유사한 반응형 패턴 적용 예시
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
```

본 SPEC에서는 동일한 Tailwind 반응형 클래스 구조를 따름

---

## 5. 아키텍처 설계 방향

### 5.1 컴포넌트 구조 (변경 없음)

```
Sidebar.tsx
├── Sidebar Header (로고)
├── Navigation Menu
│   ├── MenuItem (홈)
│   ├── MenuItem (트렌드 분석)
│   ├── MenuItem (설정)
│   └── ...
└── Collapse Button
```

### 5.2 상태 관리 (변경 없음)

```typescript
// 기존 useState 유지
const [collapsed, setCollapsed] = useState(false);
```

### 5.3 스타일링 전략

```
CSS 클래스 구조 (우선순위):
1. collapse 상태 → w-16 (최우선)
2. collapse 아님 → 반응형 클래스 적용
   └── 기본: w-16 (모바일)
   └── sm: w-20 (소형 태블릿)
   └── md: w-24 (중형 태블릿)
   └── lg: w-56 (데스크톱)
```

---

## 6. 위험 분석 및 대응

### 6.1 식별된 위험

| 위험 ID | 위험 내용                        | 가능성 | 영향도 | 위험 등급 |
| ------- | -------------------------------- | ------ | ------ | --------- |
| R-01    | 기존 레이아웃 깨짐               | 낮음   | 높음   | 중간      |
| R-02    | 특정 브라우저 호환性问题         | 낮음   | 중간   | 낮음      |
| R-03    | 전환 애니메이션 성능 저하        | 낮음   | 낮음   | 낮음      |

### 6.2 완화 전략

**R-01: 기존 레이아웃 깨짐**
- 예방: 변경 전후 스크린샷 비교 테스트
- 탐지: 시각적 회귀 테스트 도구 활용
- 대응: 즉시 롤백 가능한 단일 파일 변경

**R-02: 브라우저 호환성**
- 예방: Tailwind CSS 표준 브레이크포인트 사용
- 탐지: 크로스 브라우저 테스트
- 대응: 필요시 벤더 프리픽스 추가

**R-03: 애니메이션 성능**
- 예방: CSS transform 활용 (GPU 가속)
- 탐지: Lighthouse 성능 모니터링
- 대응: 애니메이션 비활성화 옵션 고려

---

## 7. 테스트 전략

### 7.1 단위 테스트

**테스트 대상**: 해당 없음 (CSS 변경만 수행)

### 7.2 통합 테스트

**테스트 시나리오**:
1. 모바일 뷰포트에서 사이드바 너비 64px 확인
2. 태블릿 뷰포트에서 사이드바 너비 80-96px 확인
3. 데스크톱 뷰포트에서 사이드바 너비 224px 확인
4. collapse 버튼 클릭 시 모든 뷰포트에서 64px 확인

### 7.3 시각적 회귀 테스트

**도구**: 수동 스크린샷 비교

**테스트 매트릭스**:

| 디바이스       | 뷰포트  | 예상 너비 | 테스트 상태 |
| -------------- | ------- | --------- | ----------- |
| iPhone SE      | 375px   | 64px      | 대기        |
| iPad Mini      | 768px   | 96px      | 대기        |
| iPad Pro       | 1024px  | 224px     | 대기        |
| Desktop HD     | 1920px  | 224px     | 대기        |

---

## 8. 롤백 계획

### 8.1 롤백 조건

다음 경우 즉시 롤백:
- [ ] 주요 브라우저에서 레이아웃 깨짐 발생
- [ ] Lighthouse 성능 점수 10점 이상 저하
- [ ] 사용자 불만 접수

### 8.2 롤백 절차

```bash
# 1. 이전 커밋으로 되돌리기
git revert <commit-hash>

# 2. 긴급 배포
git push origin main

# 3. 이슈 등록 및 원인 분석
```

---

## 9. 의존성

### 9.1 선행 의존성

없음

### 9.2 후속 의존성

없음

### 9.3 관련 시스템

- 인증 시스템 (사이드바 메뉴 구성에만 영향)
- 라우팅 시스템 (변경 없음)

---

## 10. 승인

| 역할          | 이름        | 승인 상태 | 승인일자   |
| ------------- | ----------- | --------- | ---------- |
| 작성자        | Hosung Kim  | 작성 완료 | 2026-03-15 |
| 리뷰어        | -           | 대기      | -          |
| 승인자        | -           | 대기      | -          |

---

## 11. 참고 자료

- [Tailwind CSS 반응형 디자인](https://tailwindcss.com/docs/responsive-design)
- [Tailwind CSS 너비 유틸리티](https://tailwindcss.com/docs/width)
- [Next.js 반응형 디자인 가이드](https://nextjs.org/docs/app/building-your-application/optimizing/fonts#responsive-fonts)
