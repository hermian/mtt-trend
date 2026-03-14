# SPEC-MTT-005: 구현 계획서

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-005 |
| 제목 | 테마 RS 추이 차트 인터랙티브 개선 |
| 상태 | Planned |
| 작성일 | 2026-03-14 |
| 우선순위 | Medium |

---

## 구현 전략

ThemeTrendChart 컴포넌트에 집중하여 3가지 인터랙티브 기능을 추가한다. 기존 `useThemesDaily` 훅을 활용하여 초기 자동 선택을 구현하고, Recharts API의 `strokeOpacity`, `dot`, `Legend` 커스터마이징을 통해 시각적 개선을 적용한다.

### 핵심 설계 원칙

1. **기존 데이터 흐름 재사용**: `useThemesDaily` 훅의 정렬된 데이터를 활용하여 추가 API 호출 없이 자동 선택 구현
2. **Recharts 네이티브 API 활용**: 커스텀 렌더러보다 Recharts 내장 props(`strokeOpacity`, `dot`) 우선 사용
3. **이벤트 분리**: 기존 단일 클릭 동작과 더블클릭 동작의 충돌 방지
4. **점진적 개선**: 각 기능이 독립적으로 동작하여 부분 구현 가능

---

## 마일스톤

### Primary Goal: 상위 5개 테마 자동 선택 (F-01)

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/app/trend/_components/ThemeTrendChart.tsx` | 초기 선택 로직 추가 |

**작업 분해:**

1. `useThemesDaily(date, source)` 훅 호출을 ThemeTrendChart 내부 또는 page.tsx에서 수행
2. 데이터 로드 완료 시 상위 5개 테마명 추출: `themesDaily.slice(0, 5).map(t => t.theme_name)`
3. `selectedThemes` 상태의 초기값을 빈 배열 대신 상위 5개 테마명으로 설정
4. 사용자가 수동 선택 변경 시 자동 선택 재적용 방지 플래그 관리
5. 테마 데이터가 5개 미만인 경우 방어 처리

**기술 접근:**

- `useEffect`로 `themesDaily` 데이터 로드 후 초기 선택값 설정
- `isUserModified` ref 또는 상태로 사용자 수동 변경 여부 추적
- `useThemesDaily`가 이미 avg_rs 내림차순 정렬이므로 추가 정렬 불필요

### Secondary Goal: 라인 더블클릭 비활성화/활성화 (F-03)

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/app/trend/_components/ThemeTrendChart.tsx` | 비활성화 상태 관리, 더블클릭 핸들러, 스타일 적용 |

**작업 분해:**

1. `disabledThemes: Set<string>` 상태 추가
2. Legend 항목에 `onDoubleClick` 이벤트 핸들러 연결
   - Recharts `Legend`의 `content` prop으로 커스텀 Legend 렌더링
   - 각 Legend 항목에 `onDoubleClick` 이벤트 바인딩
3. `Line` 컴포넌트의 `strokeOpacity`를 비활성화 상태에 따라 동적 설정
   - 비활성화: `strokeOpacity={0.2}`
   - 활성화: `strokeOpacity={1.0}`
4. 비활성화된 Legend 항목의 시각적 표현 (연한 텍스트, 취소선)
5. 기존 단일 클릭 동작과 충돌 방지

**기술 접근:**

- Recharts `Legend`의 `content` prop으로 커스텀 Legend 컴포넌트 구현
- 더블클릭 시 `disabledThemes` Set에 테마명 추가/제거 토글
- `Line` 컴포넌트에 조건부 `strokeOpacity` 적용
- 단일 클릭과 더블클릭 구분: `setTimeout`을 사용한 클릭 디바운싱 또는 이벤트 타입 분리

### Final Goal: 단일 데이터 포인트 dot 표시 (F-04)

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/app/trend/_components/ThemeTrendChart.tsx` | 단일 포인트 감지 및 커스텀 dot 렌더링 |

**작업 분해:**

1. 각 테마의 유효 데이터 포인트 수 계산 로직 추가
2. 데이터 포인트가 1개인 테마 식별
3. 해당 테마의 `Line` 컴포넌트에 커스텀 `dot` 렌더링 적용
   - `dot={{ r: 4, strokeWidth: 2, fill: themeColor }}`
   - 또는 `dot` prop에 커스텀 SVG 컴포넌트 전달
4. 단일 포인트 테마의 라인 렌더링 억제 (데이터 포인트 1개이므로 자동으로 라인 미렌더링)
5. 툴팁 호버 동작 검증

**기술 접근:**

- Recharts `Line`의 `dot` prop에 조건부 커스텀 렌더러 전달
- 단일 포인트 테마: `activeDot={{ r: 6 }}`, `dot={{ r: 4, strokeWidth: 2 }}`
- `connectNulls={false}`로 설정하여 불필요한 연결선 방지
- 데이터 포인트 수 계산: `themeData.filter(d => d.value !== null).length`

### Optional Goal: 기간 기본값 확인 (F-02)

**작업 분해:**

1. 현재 기간 기본값이 30일인지 코드에서 확인
2. 이미 30일이 기본값이므로 추가 변경 불필요 (코드 검증만 수행)

---

## 위험 분석 (Risk Analysis)

| 위험 요소 | 심각도 | 가능성 | 대응 방안 |
|-----------|--------|--------|-----------|
| 더블클릭과 단일 클릭 이벤트 충돌 | 높음 | 중간 | 타이머 기반 클릭/더블클릭 구분 구현, 또는 Legend에서만 더블클릭 지원 |
| `useThemesDaily` 데이터 로딩 타이밍 이슈 | 중간 | 중간 | `useEffect` 의존성 배열에 데이터 로딩 상태 포함, 로딩 완료 후 자동 선택 |
| 단일 포인트 dot이 다른 라인에 가려짐 | 낮음 | 낮음 | dot 크기(8px)와 z-index 조정으로 가시성 확보 |
| 모바일에서 더블클릭(더블탭) 인식 불안정 | 중간 | 중간 | 대안으로 롱프레스 이벤트 추가 고려, 또는 Legend 항목에만 더블클릭 적용 |
| 자동 선택과 사용자 수동 선택 간 상태 충돌 | 중간 | 낮음 | `isUserModified` 플래그로 자동 선택 재적용 방지 |

---

## 추적성 (Traceability)

| TAG | 마일스톤 | 파일 |
|-----|----------|------|
| SPEC-MTT-005-F01 | Primary Goal | `ThemeTrendChart.tsx` |
| SPEC-MTT-005-F02 | Optional Goal | `ThemeTrendChart.tsx` |
| SPEC-MTT-005-F03 | Secondary Goal | `ThemeTrendChart.tsx` |
| SPEC-MTT-005-F04 | Final Goal | `ThemeTrendChart.tsx` |
