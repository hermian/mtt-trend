---
id: SPEC-MTT-008
version: "1.0.0"
status: completed
created: "2026-03-15"
updated: "2026-03-15"
author: Hosung Kim
priority: medium
---

# SPEC-MTT-008 구현 계획: 테마 RS 추이 슬라이딩 윈도우 기간 설정

## 구현 전략

프론트엔드 단일 파일(`ThemeTrendChart.tsx`) 수정으로 완결되는 UI 개선 작업이다. 백엔드와 훅은 이미 숫자 기반 `days` 파라미터를 지원하므로 변경이 불필요하다. 기존 `GroupActionTable.tsx`의 `SliderControl` 패턴을 참조하여 로컬 구현하고, `Tooltip` 컴포넌트를 재사용한다.

## 단계별 구현 계획

### Phase 1: 상태 리팩토링

**우선순위: Primary Goal**

**변경 대상:** `ThemeTrendChart.tsx`

1. `PeriodOption` 타입 및 `PERIOD_OPTIONS` 상수 제거 (lines 23-29)
2. `period` 상태 변경:
   - Before: `const [period, setPeriod] = useState<PeriodOption>(PERIOD_OPTIONS[1])`
   - After: `const [period, setPeriod] = useState<number>(30)`
3. 훅 호출부 업데이트 (line 164-165):
   - Before: `useMultipleThemeHistories(selectedThemes, period.days, source)`
   - After: `useMultipleThemeHistories(selectedThemes, period, source)`
4. `period.days` 참조를 모두 `period`로 변경

**완료 기준:** 기존 버튼 UI는 그대로 두되, 타입이 `number`로 변경되어 컴파일 오류 없음

### Phase 2: UI 컴포넌트 구현

**우선순위: Primary Goal**

**변경 대상:** `ThemeTrendChart.tsx`

1. 프리셋 상수 정의:
   ```typescript
   const PRESET_PERIODS = [
     { label: "7일", days: 7 },
     { label: "30일", days: 30 },
     { label: "90일", days: 90 },
     { label: "전체", days: 365 },
   ] as const;
   ```

2. `SliderControl` 로컬 컴포넌트 구현 (`GroupActionTable.tsx` 패턴 참조):
   - Props: `label`, `value`, `min`, `max`, `step`, `unit`, `tooltip`, `onChange`
   - `<input type="range">` 기반 슬라이더
   - 접근성 속성 (`aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`)

3. `Tooltip` import 추가:
   ```typescript
   import { Tooltip } from "./Tooltip";
   ```

### Phase 3: UI 렌더링 교체

**우선순위: Primary Goal**

**변경 대상:** `ThemeTrendChart.tsx` (lines 378-397)

1. 기존 버튼 그룹 UI 제거
2. 신규 UI 구성:
   - `SliderControl` (label: "기간", value: period, min: 7, max: 365, step: 1, unit: "일")
   - 툴팁: "RS 추이 조회 기간 (7~365일)\n기간이 길수록 더 많은 과거 데이터를 표시합니다"
   - 프리셋 버튼 행:
     - 활성 스타일: `bg-blue-600 text-white`
     - 비활성 스타일: `bg-gray-700 text-gray-400 hover:bg-gray-600`

### Phase 4: 테스트 업데이트

**우선순위: Secondary Goal**

**변경 대상:** `ThemeTrendChart.test.tsx` (존재 시)

1. 기존 기간 버튼 관련 테스트 업데이트
2. 슬라이더 동작 테스트 추가
3. 프리셋 버튼 동기화 테스트 추가

## 수정 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `frontend/src/app/trend/_components/ThemeTrendChart.tsx` | Modify | 상태 리팩토링, 슬라이더 UI 구현, 프리셋 버튼 추가 |
| `frontend/src/hooks/useThemes.ts` | No change | 이미 `number` 타입 `days` 지원 |
| `backend/app/routers/themes.py` | No change | 이미 `days: 1-365` 지원 |

## 리스크 및 대응

### R-01: 슬라이더 즉시 반응 시 API 호출 부하

- **리스크:** 슬라이더 드래그 중 매 step마다 API 호출 발생 가능
- **대응:** React Query의 기본 dedupe/caching 메커니즘 활용. 사용자 결정에 따라 즉시 반응 방식 채택. React Query가 동일 쿼리키에 대해 중복 요청을 자동으로 방지함
- **심각도:** Low

### R-02: 접근성 미충족

- **리스크:** 슬라이더가 키보드/스크린리더로 조작 불가
- **대응:** 네이티브 `<input type="range">` 사용으로 기본 접근성 확보, ARIA 속성 명시적 추가
- **심각도:** Low

### R-03: SliderControl 코드 중복

- **리스크:** `GroupActionTable.tsx`에도 유사한 SliderControl이 존재하여 코드 중복 발생
- **대응:** 현재는 로컬 구현으로 진행. 향후 공통 컴포넌트로 추출 가능하나 이번 SPEC 범위 외
- **심각도:** Low

## 의존성 확인

- [x] 백엔드 API: `days: 1-365` 지원 확인
- [x] `useMultipleThemeHistories` 훅: `number` 타입 `days` 파라미터 확인
- [x] `Tooltip` 컴포넌트: export 확인, import 가능
- [x] `GroupActionTable.tsx`: SliderControl 패턴 참조 가능

## 아키텍처 영향

- 이번 변경은 `ThemeTrendChart.tsx` 단일 파일에 한정
- 컴포넌트 인터페이스 변경 없음 (외부에서 호출하는 Props 변경 없음)
- 기존 테마 선택, disabled 상태, 소스 토글 등 다른 기능에 영향 없음
