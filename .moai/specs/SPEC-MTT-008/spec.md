---
id: SPEC-MTT-008
version: "1.0.0"
status: draft
created: "2026-03-15"
updated: "2026-03-15"
author: Hosung Kim
priority: medium
issue_number: 0
---

# SPEC-MTT-008: 테마 RS 추이 슬라이딩 윈도우 기간 설정

## HISTORY

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0.0 | 2026-03-15 | 초기 작성 |

## 개요

테마 RS 추이 차트의 기간 선택 UI를 버튼 그룹에서 슬라이더 기반 컨트롤로 교체하여, 사용자가 7일부터 365일까지 자유롭게 조회 기간을 설정할 수 있도록 개선한다.

## 배경 및 문제

### 현재 상태

- `ThemeTrendChart.tsx` (lines 25-29)에 `PERIOD_OPTIONS`가 하드코딩되어 7일, 30일, 전체(365일) 3가지 선택지만 제공
- 사용자가 14일, 90일 등 세밀한 기간 조정 불가
- 기본값은 30일 (`useState<PeriodOption>(PERIOD_OPTIONS[1])`, line 131)

### 기술적 배경

- 백엔드 API는 이미 `days: 1-365` 범위를 지원 (변경 불필요)
- `useMultipleThemeHistories` 훅은 이미 `number` 타입 `days` 파라미터를 수용 (변경 불필요)
- `Tooltip` 컴포넌트가 이미 `./Tooltip`에서 export됨 (재사용 가능)
- `GroupActionTable.tsx`에 `SliderControl` 패턴이 내부 함수로 구현되어 있음 (참조 가능)

## 요구사항

### F-01: 슬라이더 기반 기간 선택

- **[Ubiquitous]** 시스템은 **항상** 7~365일 범위의 슬라이더를 통해 RS 추이 조회 기간을 선택할 수 있어야 한다.
- **[Event-Driven]** **WHEN** 사용자가 슬라이더 값을 변경하면 **THEN** 즉시 `period` 상태가 업데이트되고 차트 데이터가 재조회되어야 한다.
- **[Ubiquitous]** 슬라이더는 **항상** min=7, max=365, step=1로 설정되어야 한다.
- **[Ubiquitous]** 슬라이더 라벨은 **항상** "기간: {N}일" 형식으로 현재 선택 값을 표시해야 한다.
- **[Ubiquitous]** 범위 라벨은 **항상** "[7일 ~ 365일]" 형식으로 표시되어야 한다.
- **[Ubiquitous]** 기본값은 **항상** 30일이어야 한다.

### F-02: 프리셋 퀵셀렉트 버튼

- **[Ubiquitous]** 슬라이더 하단에 **항상** 프리셋 버튼(7일, 30일, 90일, 전체)이 표시되어야 한다.
- **[Event-Driven]** **WHEN** 프리셋 버튼을 클릭하면 **THEN** 슬라이더 값이 해당 일수(7, 30, 90, 365)로 동기화되어야 한다.
- **[State-Driven]** **IF** 슬라이더 값이 프리셋 값(7, 30, 90, 365)과 일치하면 **THEN** 해당 버튼이 활성화 스타일(`bg-blue-600 text-white`)로 표시되어야 한다.
- **[State-Driven]** **IF** 슬라이더 값이 어떤 프리셋과도 일치하지 않으면 **THEN** 모든 프리셋 버튼이 비활성 스타일(`bg-gray-700 text-gray-400 hover:bg-gray-600`)로 표시되어야 한다.

### F-03: 기간 컨트롤 툴팁

- **[Event-Driven]** **WHEN** 사용자가 기간 라벨에 hover 또는 focus하면 **THEN** 툴팁이 표시되어야 한다.
- **[Ubiquitous]** 툴팁 내용은 **항상** "RS 추이 조회 기간 (7~365일)\n기간이 길수록 더 많은 과거 데이터를 표시합니다"이어야 한다.
- **[Ubiquitous]** 기존 `Tooltip` 컴포넌트(`./Tooltip`)를 **항상** 재사용해야 한다.

## 비기능 요구사항

### 성능

- **[Unwanted]** 슬라이더 조작 시 차트 리렌더링이 500ms를 **초과하지 않아야 한다** (React Query 캐싱 활용).
- **[Unwanted]** 슬라이더의 빠른 연속 조작이 불필요한 API 호출 폭주를 **유발하지 않아야 한다** (React Query의 기본 dedupe 활용).

### 접근성

- **[Ubiquitous]** 슬라이더는 **항상** 키보드 방향키로 조작 가능해야 한다.
- **[Ubiquitous]** 슬라이더는 **항상** `aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` 속성을 포함해야 한다.

## 범위 제한

- 백엔드 API 변경 없음
- `useThemes.ts` 훅 변경 없음
- 기존 테마 선택, 소스 토글 등 다른 UI 요소에 영향 없음

## 추적성

- 관련 파일: `frontend/src/app/trend/_components/ThemeTrendChart.tsx`
- 참조 패턴: `frontend/src/app/trend/_components/GroupActionTable.tsx` (SliderControl)
- 참조 컴포넌트: `frontend/src/app/trend/_components/Tooltip.tsx`
