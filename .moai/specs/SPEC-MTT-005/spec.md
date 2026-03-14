---
id: SPEC-MTT-005
version: "1.0.0"
status: completed
created: 2026-03-14
updated: 2026-03-15
author: Hosung Kim
priority: Medium
issue_number: 0
---

# SPEC-MTT-005: 테마 RS 추이 차트 인터랙티브 개선

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-005 |
| 제목 | 테마 RS 추이 차트 인터랙티브 개선 |
| 상태 | Completed |
| 작성일 | 2026-03-14 |
| 완료일 | 2026-03-15 |
| 우선순위 | Medium |
| 의존 SPEC | SPEC-MTT-003 (신규 급등 테마 탐지 UI 컴포넌트) |

---

## 변경 이력 (History)

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-03-14 | Hosung Kim | 최초 작성 |

---

## 배경 (Background)

현재 ThemeTrendChart 컴포넌트는 Recharts `LineChart`를 사용하여 테마별 RS 추이를 시각화한다. 사용자가 직접 테마를 선택해야만 차트가 표시되며, 페이지 로드 시 빈 차트가 표시되어 초기 사용성이 떨어진다.

또한 차트 내 개별 라인의 비활성화/활성화 토글 기능이 없어, 여러 테마를 비교 분석할 때 특정 테마를 일시적으로 숨기려면 선택을 해제해야 한다. 선택 해제 시 데이터를 다시 불러와야 하므로 UX가 불편하다.

추가로, 신규 등장 테마처럼 데이터 포인트가 하루(마지막 날)에만 존재하는 경우 Recharts `Line` 컴포넌트가 라인을 렌더링하지 못해 해당 테마의 데이터가 화면에 표시되지 않는 문제가 있다.

### 현재 동작

| 기능 | 현재 상태 |
|------|-----------|
| 초기 테마 자동 선택 | 미구현 - 빈 차트 표시 |
| 기간 기본값 | 30일 (이미 구현) |
| 라인 비활성화 토글 | 미구현 - 선택 해제만 가능 |
| 단일 데이터 포인트 표시 | 미구현 - 라인이 그려지지 않음 |

### 관련 코드

- `ThemeTrendChart.tsx`: Recharts `LineChart`, `Line`, `Legend` 사용
- `useMultipleThemeHistories(themeNames[], days, source)`: 선택된 테마들의 히스토리 데이터 조회
- `useThemesDaily(date, source)`: 당일 테마 데이터 조회 (avg_rs 내림차순 정렬)
- 최대 10개 테마 동시 선택 가능
- 색상 팔레트: 10개 사전 정의 색상

---

## 가정 (Assumptions)

| 가정 | 근거 | 신뢰도 |
|------|------|--------|
| `useThemesDaily` 훅의 반환 데이터가 avg_rs 내림차순으로 정렬되어 있다 | 훅 내부에서 정렬 처리 확인됨 | 높음 |
| Recharts `Line` 컴포넌트의 `dot` prop으로 단일 포인트 렌더링이 가능하다 | Recharts 공식 API에서 `dot` 커스터마이징 지원 | 높음 |
| 더블클릭 이벤트가 모바일에서 정상 동작한다 | 모바일 브라우저에서 `dblclick` 이벤트 지원됨 | 중간 |
| 최대 선택 테마 수(10개)는 변경하지 않는다 | 색상 팔레트가 10개로 제한됨 | 높음 |

---

## 요구사항 (Requirements)

### F-01: 페이지 로드 시 상위 5개 테마 자동 선택

**WHEN** 트렌드 페이지가 로드되면, **THEN** ThemeTrendChart **SHALL** 당일 기준 RS 상위 5개 테마를 자동으로 선택하여 추이 차트를 표시한다.

- `useThemesDaily(date, source)`에서 반환된 데이터의 상위 5개 테마명을 초기 선택값으로 설정한다
- 기간 기본값은 30일이다
- 사용자가 수동으로 테마를 변경한 이후에는 자동 선택이 재적용되지 않는다

**IF** 당일 테마 데이터가 5개 미만이면, **THEN** ThemeTrendChart **SHALL** 존재하는 모든 테마를 자동 선택한다.

**IF** 당일 테마 데이터가 0개이면, **THEN** ThemeTrendChart **SHALL** 빈 차트와 함께 "데이터가 없습니다" 메시지를 표시한다.

### F-02: 기간 기본값 30일 명시

**THE** ThemeTrendChart **SHALL** 기간 선택의 기본값을 30일로 설정한다.

- 기존 구현에서 이미 30일이 기본값이나, 명시적 요구사항으로 고정한다

### F-03: 라인 더블클릭 비활성화/활성화 토글

**WHEN** 사용자가 차트의 라인 또는 Legend 항목을 더블클릭하면, **THEN** ThemeTrendChart **SHALL** 해당 테마 라인을 비활성화 상태(opacity 0.2)로 표시한다.

- 비활성화된 라인은 차트에서 제거되지 않고, 연한 색(opacity 0.2)으로 남아있다
- Legend 항목도 비활성화 상태를 시각적으로 반영한다 (연한 텍스트, 취소선 등)

**WHEN** 사용자가 비활성화된 라인 또는 Legend 항목을 다시 더블클릭하면, **THEN** ThemeTrendChart **SHALL** 해당 테마 라인을 원래 상태(opacity 1.0)로 복원한다.

**THE** ThemeTrendChart **SHALL** 기존 단일 클릭(Legend) 동작에 영향을 주지 않아야 한다.

### F-04: 단일 데이터 포인트 dot 표시

**IF** 특정 테마의 히스토리 데이터가 조회 기간 내에 단 하루(마지막 날)에만 존재하면, **THEN** ThemeTrendChart **SHALL** 해당 테마를 라인 대신 둥근 dot(8px)으로 표시한다.

- dot의 색상은 해당 테마에 할당된 색상 팔레트 값을 사용한다
- dot에 마우스 호버 시 툴팁이 정상적으로 표시되어야 한다
- 데이터 포인트가 2개 이상인 테마는 기존과 동일하게 라인으로 표시한다

---

## 제약사항 (Constraints)

| 제약사항 | 유형 |
|----------|------|
| Recharts 2.10.4 버전 내에서 구현 | 기술 |
| 기존 `useMultipleThemeHistories` 훅 인터페이스 변경 최소화 | 기술 |
| 최대 선택 테마 수 10개 제한 유지 | 기능 |
| 서버 사이드(백엔드 API) 변경 없이 프론트엔드만 수정 | 범위 |
| 기존 색상 팔레트(10개 사전 정의 색상) 유지 | 디자인 |

---

## 기술 참고 (Technical Notes)

### 영향받는 파일

| 파일 | 변경 유형 |
|------|-----------|
| `frontend/src/app/trend/_components/ThemeTrendChart.tsx` | 수정 - 자동 선택, 더블클릭 토글, dot 표시 로직 추가 |
| `frontend/src/app/trend/page.tsx` | 수정 가능성 - ThemeTrendChart에 추가 props 전달 필요 시 |

### Recharts API 참고

- `Line` 컴포넌트의 `strokeOpacity` prop으로 라인 투명도 제어
- `Line` 컴포넌트의 `dot` prop에 커스텀 렌더러 전달 가능
- `Legend`의 `onClick` 이벤트 핸들러로 커스텀 동작 구현 가능
- 단일 포인트 렌더링: `dot={{ r: 4, strokeWidth: 2 }}` 스타일 적용

---

## 추적성 (Traceability)

| TAG | 설명 |
|-----|------|
| SPEC-MTT-005-F01 | 페이지 로드 시 상위 5개 테마 자동 선택 |
| SPEC-MTT-005-F02 | 기간 기본값 30일 명시 |
| SPEC-MTT-005-F03 | 라인 더블클릭 비활성화/활성화 토글 |
| SPEC-MTT-005-F04 | 단일 데이터 포인트 dot 표시 |
