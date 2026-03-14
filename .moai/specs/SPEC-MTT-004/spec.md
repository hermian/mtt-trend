---
id: SPEC-MTT-004
version: "1.0.0"
status: completed
created: 2026-03-14
updated: 2026-03-14
author: Hosung Kim
priority: Medium
issue_number: 0
completed: 2026-03-14
---

# SPEC-MTT-004: 테마 RS 대시보드 레이아웃 개선

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-004 |
| 제목 | 테마 RS 대시보드 레이아웃 개선 |
| 상태 | Completed |
| 작성일 | 2026-03-14 |
| 완료일 | 2026-03-14 |
| 우선순위 | Medium |
| 의존 SPEC | SPEC-MTT-003 (신규 급등 테마 탐지 UI 컴포넌트) |

---

## 변경 이력 (History)

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-03-14 | Hosung Kim | 최초 작성 |

---

## 배경 (Background)

현재 테마 트렌드 대시보드(`/trend`)는 TopThemesBar, SurgingThemesCard, ThemeTrendChart, StockAnalysisTabs 4개 섹션이 세로로 순차 배치되어 있다. TopThemesBar는 상위 15개 테마를 하드코딩(`.slice(0, 15)`)으로 표시하며, 사용자가 표시 개수를 조절할 수 없다.

또한 TopThemesBar(테마별 RS 점수 막대 차트)와 SurgingThemesCard(신규 급등 테마 탐지 테이블)는 의미적으로 관련이 높은 컴포넌트임에도 세로로 나열되어 화면 공간을 비효율적으로 사용하고 있다.

### 현재 레이아웃 구조

```
[TopThemesBar - 전체 너비]          ← 상위 15개 하드코딩
[SurgingThemesCard - 전체 너비]     ← 전체 너비로 세로 배치
[ThemeTrendChart - 전체 너비]
[StockAnalysisTabs - 전체 너비]
```

### 목표 레이아웃 구조

```
[TopThemesBar - 50%] [SurgingThemesCard - 50%]  ← 2분할 가로 배치
[ThemeTrendChart - 전체 너비]
[StockAnalysisTabs - 전체 너비]
```

---

## 가정 (Assumptions)

| 가정 | 근거 | 신뢰도 |
|------|------|--------|
| TopThemesBar와 SurgingThemesCard는 독립적인 props를 사용한다 | 두 컴포넌트 모두 `date`, `source` props만 사용 | 높음 |
| 기존 다크 테마(bg-gray-800) 색상 체계를 유지한다 | 프로젝트 전반에 걸친 일관된 다크 모드 디자인 | 높음 |
| 모바일 브레이크포인트는 TailwindCSS 기본값(md: 768px)을 사용한다 | 기존 프로젝트에서 TailwindCSS 기본 설정 사용 중 | 중간 |
| 상위 테마 개수 설정은 클라이언트 상태로 관리한다 | 서버 API 변경 불필요, useThemesDaily 훅이 전체 데이터 반환 | 높음 |

---

## 요구사항 (Requirements)

### F-01: 상위 테마 표시 개수 동적 설정

**THE** TopThemesBar 컴포넌트 **SHALL** 사용자가 화면에서 표시할 상위 테마 개수를 동적으로 설정할 수 있는 UI 컨트롤을 제공한다.

- 설정 범위: 5 ~ 30
- 기본값: 10
- 현재 하드코딩된 `.slice(0, 15)` 로직을 동적 값으로 대체한다
- 설정값 변경 시 차트가 즉시 업데이트된다

**WHEN** 사용자가 상위 테마 개수 설정값을 변경하면, **THEN** TopThemesBar **SHALL** 변경된 개수만큼의 테마를 avg_rs 내림차순으로 표시한다.

**IF** 설정된 개수가 실제 데이터 수보다 많으면, **THEN** TopThemesBar **SHALL** 실제 데이터 수만큼만 표시하고 에러를 발생시키지 않아야 한다.

### F-02: 2분할 가로 레이아웃 배치

**THE** 트렌드 페이지 **SHALL** TopThemesBar와 SurgingThemesCard를 같은 행에 나란히 2분할 레이아웃으로 배치한다.

- 데스크탑(md 이상): 좌측 TopThemesBar(50%), 우측 SurgingThemesCard(50%)
- 두 컴포넌트 사이 간격(gap)은 기존 섹션 간격과 동일하게 유지한다

**WHILE** 화면 너비가 md 브레이크포인트(768px) 이상인 상태에서, **THE** 트렌드 페이지 **SHALL** TopThemesBar와 SurgingThemesCard를 가로 2분할로 배치한다.

**WHILE** 화면 너비가 md 브레이크포인트(768px) 미만인 상태에서, **THE** 트렌드 페이지 **SHALL** TopThemesBar와 SurgingThemesCard를 세로 스택으로 배치한다.

### F-03: 동일 높이 유지

**WHILE** 두 컴포넌트가 가로 배치된 상태에서, **THE** TopThemesBar와 SurgingThemesCard **SHALL** 동일한 높이를 유지한다.

- 콘텐츠 양에 관계없이 두 컴포넌트의 높이가 동기화되어야 한다
- 콘텐츠가 컨테이너를 초과하는 경우 내부 스크롤로 처리한다

### F-04: 콘텐츠 기반 동적 높이 조정

**THE** TopThemesBar와 SurgingThemesCard 컨테이너 **SHALL** 각 콘텐츠의 실제 높이에 따라 동적으로 조정되어야 한다.

- 두 컴포넌트 중 더 큰 높이를 가진 콘텐츠에 맞춰 컨테이너 높이가 자동 조정되어야 한다
- 데스크탑에서 두 컴포넌트는 동일한 높이를 유지해야 함 (CSS Grid items-stretch)
- 모바일에서는 각 컴포넌트가 자신의 콘텐츠 높이만큼만 차지해야 함
- "테마 RS 추이" 섹션과의 간격은 `space-y-6`으로 일정하게 유지되어야 함

**WHILE** 화면 너비가 md 브레이크포인트(768px) 이상인 상태에서, **THE** 컨테이너 높이 **SHALL** 콘텐츠에 따라 자동 조정된다.

---

## 제약사항 (Constraints)

| 제약사항 | 유형 |
|----------|------|
| TailwindCSS 유틸리티 클래스만 사용하여 레이아웃 구현 | 기술 |
| 기존 `useThemesDaily` 훅의 API 인터페이스 변경 금지 | 기술 |
| 서버 사이드(백엔드 API) 변경 없이 프론트엔드만 수정 | 범위 |
| 기존 다크 테마 색상 체계(bg-gray-800, text-white 등) 유지 | 디자인 |

---

## 기술 참고 (Technical Notes)

### 영향받는 파일

| 파일 | 변경 유형 |
|------|-----------|
| `frontend/src/app/trend/page.tsx` | 수정 - 레이아웃 구조 변경 |
| `frontend/src/app/trend/_components/TopThemesBar.tsx` | 수정 - 슬라이스 로직 동적화, UI 컨트롤 추가 |

### 기존 코드 참조

TopThemesBar 현재 하드코딩:
```typescript
// 현재: .slice(0, 15) 하드코딩
const topThemes = sortedThemes.slice(0, 15);
// 변경: 동적 topN 값 사용
const topThemes = sortedThemes.slice(0, topN);
```

---

## 추적성 (Traceability)

| TAG | 설명 |
|-----|------|
| SPEC-MTT-004-F01 | 상위 테마 표시 개수 동적 설정 |
| SPEC-MTT-004-F02 | 2분할 가로 레이아웃 배치 |
| SPEC-MTT-004-F03 | 동일 높이 유지 |
| SPEC-MTT-004-F04 | 콘텐츠 기반 동적 높이 조정 |
