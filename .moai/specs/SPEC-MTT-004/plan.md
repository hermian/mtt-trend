# SPEC-MTT-004: 구현 계획서 및 분기점 보고서

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-004 |
| 제목 | 테마 RS 대시보드 레이아웃 개선 |
| 상태 | Completed |
| 작성일 | 2026-03-14 |
| 완료일 | 2026-03-14 |
| 우선순위 | Medium |

### 구현 분기점 (Implementation Divergence Report)

**실제 구현 내용**

기존 계획과 대비하여 다음과 같은 추가 구현이 수행되었습니다:

1. **F-04 추가 구현**: 콘텐츠 기반 동적 높이 조정 기능 추가
   - CSS Grid `items-stretch`로 두 컴포넌트 자동 높이 동기화
   - 모바일에서 각 컴포넌트 독립적 높이 유지
   - `space-y-6`으로 섹션 간격 일관성 유지

2. **E2E 테스트 추가**: 동적 높이 조정 기능 검증
   - 화면 리사이즈 시 레이아웃 유지 확인 테스트
   - 모바일/데스크탑 브레이크포인트 테스트

**구현 완료 사항**

- ✅ F-01: 상위 테마 표시 개수 동적 설정 (5-30, 기본값 10)
- ✅ F-02: 2분할 가로 레이아웃 배치 (데스크탑 50/50, 모바일 세로)
- ✅ F-03: 동일 높이 유지 (CSS Grid items-stretch)
- ✅ F-04: 콘텐츠 기반 동적 높이 조정 (추가 구현)

**테스트 커버리지**

- Unit 테스트: 63개 테스트 모두 통과
- E2E 테스트: 동적 높이 조정 시나리오 포함
- 컴포넌트 테스트: TopThemesBar 렌더링 및 상태 변경 검증

---

## 구현 전략

기존 TailwindCSS 유틸리티 클래스를 활용하여 레이아웃을 변경하고, TopThemesBar 내부의 하드코딩된 슬라이스 로직을 동적 상태 값으로 대체한다. 백엔드 API 변경 없이 순수 프론트엔드 수정만으로 구현한다.

### 핵심 설계 원칙

1. **최소 변경**: 기존 컴포넌트 Props 인터페이스 변경 최소화
2. **TailwindCSS 활용**: CSS Grid 또는 Flexbox로 2분할 레이아웃 구현
3. **반응형 우선**: TailwindCSS 브레이크포인트(md:)를 활용한 모바일 대응
4. **상태 관리 단순화**: `useState`로 topN 값 관리 (전역 상태 불필요)

---

## 마일스톤

### Primary Goal: 상위 테마 개수 동적 설정 (F-01)

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/app/trend/_components/TopThemesBar.tsx` | `.slice(0, 15)` 하드코딩을 `topN` 상태 변수로 대체, 슬라이더/셀렉트 UI 추가 |

**작업 분해:**

1. TopThemesBar 내부에 `topN` 상태 변수 추가 (기본값: 10)
2. 하드코딩된 `.slice(0, 15)`를 `.slice(0, topN)`으로 변경
3. 사용자가 topN 값을 조절할 수 있는 UI 컨트롤 구현 (범위: 5~30)
   - SurgingThemesCard의 threshold 슬라이더 패턴 참고
4. 설정값이 데이터 수를 초과하는 경우의 방어 로직 추가

**기술 접근:**

- SurgingThemesCard에 이미 구현된 threshold 슬라이더 패턴을 참고하여 일관된 UI 제공
- `<input type="range">` 또는 `<select>` 중 기존 패턴과 일관된 방식 선택

### Secondary Goal: 2분할 레이아웃 적용 (F-02, F-03)

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/app/trend/page.tsx` | TopThemesBar와 SurgingThemesCard를 감싸는 flex/grid 컨테이너 추가 |

**작업 분해:**

1. `page.tsx`에서 TopThemesBar와 SurgingThemesCard를 감싸는 컨테이너 div 추가
2. TailwindCSS 클래스 적용:
   - 데스크탑: `md:grid md:grid-cols-2 md:gap-6` 또는 `md:flex`
   - 모바일: 기본 세로 스택 (별도 클래스 불필요)
3. 두 컴포넌트의 높이 동기화:
   - CSS Grid 사용 시 `items-stretch`로 자동 동기화
   - 콘텐츠 초과 시 내부 스크롤 처리 (`overflow-y-auto`, `max-h` 설정)

**기술 접근:**

- CSS Grid(`grid-cols-2`)가 동일 높이 유지에 가장 적합
- `items-stretch`(Grid 기본값)로 두 열의 높이가 자동 동기화
- 각 컴포넌트 내부에 `overflow-y-auto`와 적절한 `max-h` 설정

---

## 위험 분석 (Risk Analysis)

| 위험 요소 | 심각도 | 가능성 | 대응 방안 |
|-----------|--------|--------|-----------|
| 2분할 시 차트 너비 축소로 가독성 저하 | 중간 | 중간 | Recharts의 `responsiveContainer`가 자동 리사이즈 처리, 필요시 `aspect` 비율 조정 |
| 모바일에서 슬라이더 조작 어려움 | 낮음 | 낮음 | SurgingThemesCard의 기존 슬라이더 패턴이 모바일에서 정상 동작 확인됨 |
| 두 컴포넌트 높이 불일치 | 중간 | 낮음 | CSS Grid `items-stretch`로 해결, 내부 콘텐츠 overflow 처리 |
| TopThemesBar 차트 높이 변경 시 레이아웃 깨짐 | 낮음 | 낮음 | 고정 높이 또는 min-h 설정으로 안정화 |

---

## 추적성 (Traceability)

| TAG | 마일스톤 | 파일 |
|-----|----------|------|
| SPEC-MTT-004-F01 | Primary Goal | `TopThemesBar.tsx` |
| SPEC-MTT-004-F02 | Secondary Goal | `page.tsx` |
| SPEC-MTT-004-F03 | Secondary Goal | `page.tsx` |
