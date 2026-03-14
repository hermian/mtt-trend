# SPEC-MTT-003: 구현 계획서

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-003 |
| 제목 | 신규 급등 테마 탐지 UI 컴포넌트 |
| 상태 | Planned |
| 작성일 | 2026-03-14 |
| 우선순위 | High |

---

## 구현 전략

기존 대시보드 패턴(TopThemesBar, StockAnalysisTabs)을 참고하여 일관된 컴포넌트 구조와 스타일을 유지한다. 백엔드 API와 React Query 훅이 이미 구현되어 있으므로, 순수 프론트엔드 UI 구현에 집중한다.

### 핵심 설계 원칙

1. **패턴 일관성**: TopThemesBar의 로딩/에러/빈 상태 처리 패턴을 그대로 따른다
2. **기존 훅 재사용**: `useThemesSurging` 훅을 변경 없이 사용한다
3. **다크 테마 준수**: `bg-gray-800`, `text-white`, `text-gray-400` 등 기존 색상 체계 유지
4. **타입 안전성**: `SurgingTheme` 인터페이스를 `@/lib/api`에서 재사용

---

## 마일스톤

### Primary Goal: SurgingThemesCard 컴포넌트 구현 (F-01)

**변경 파일:**
- `frontend/src/app/trend/_components/SurgingThemesCard.tsx` (신규 생성)

**구현 내용:**
1. SurgingThemesCardProps 인터페이스 정의 (`date: string`, `source?: DataSource`)
2. threshold 상태 관리 (`useState`, 기본값: 10, 범위: 5~50)
3. `useThemesSurging(date, threshold, source)` 훅 연동
4. 테이블 기반 레이아웃 구현:
   - 컬럼: 테마명, RS 변화량(+N.N), 현재 avg_rs, 5일 평균, 종목 수
   - RS 변화량은 `text-green-400` + `+` 접두사로 강조
5. Threshold 슬라이더 UI:
   - `<input type="range">` + 현재 값 표시
   - 범위: 5~50, 기본값: 10
   - 레이블: "기준: +{threshold}"
6. 로딩/에러/빈 상태 처리 (TopThemesBar 패턴 참조)

**참조 패턴:**
- `TopThemesBar.tsx`: 로딩 스켈레톤, 에러 메시지, 빈 상태 처리
- `StockAnalysisTabs.tsx`: Props 패턴, DataSource 타입 사용

### Secondary Goal: 트렌드 페이지 통합 (F-02)

**변경 파일:**
- `frontend/src/app/trend/page.tsx` (수정)

**구현 내용:**
1. `SurgingThemesCard` import 추가
2. TopThemesBar 섹션과 ThemeTrendChart 섹션 사이에 새 섹션 삽입
3. 섹션 제목: "신규 급등 테마 탐지"
4. Props 전달: `date={selectedDate}`, `source={source}`

**구현 위치** (page.tsx 기준):
```
{/* Section 2: Top Themes Bar Chart */}  ← 기존
<TopThemesBar ... />

{/* Section 2.5: Surging Themes */}      ← 신규 추가
<SurgingThemesCard ... />

{/* Section 3: Theme RS Trend Chart */}  ← 기존
<ThemeTrendChart ... />
```

### Tertiary Goal: 빈 상태 및 에러 처리 (F-03)

**이미 Primary Goal에 포함됨** (SurgingThemesCard 내부 구현)

구현 세부사항:
- 로딩: `bg-gray-700 rounded animate-pulse` 스켈레톤 3~5개
- 빈 결과: "현재 기준(+{threshold}) 이상 급등한 테마가 없습니다" + 보조 안내
- 에러: "데이터를 불러오는데 실패했습니다" (`text-red-400`)

### Optional Goal: 단위 테스트 (F-04)

**변경 파일:**
- `frontend/src/app/trend/_components/__tests__/SurgingThemesCard.test.tsx` (신규 생성)

**테스트 케이스:**
1. 데이터 렌더링: 급등 테마 목록이 올바르게 표시됨
2. 로딩 상태: 스켈레톤 UI 표시 확인
3. 빈 상태: 안내 메시지 표시 확인
4. 에러 상태: 에러 메시지 표시 확인
5. Threshold 변경: 슬라이더 조작 시 훅 재호출 확인

**테스트 전략:**
- `useThemesSurging` 훅을 모킹하여 각 상태(로딩/성공/에러/빈 결과)를 시뮬레이션
- React Testing Library의 `render`, `screen`, `fireEvent` 사용
- 프로젝트 테스트 프레임워크(Vitest 또는 Jest) 따름

---

## 기술적 접근

### 컴포넌트 구조

```
SurgingThemesCard (client component)
├── Threshold 슬라이더 영역
│   ├── <label> "기준: +{threshold}"
│   └── <input type="range" min={5} max={50} />
│
├── 데이터 테이블 영역
│   └── <table>
│       ├── <thead>: 테마명 | RS 변화 | 현재 RS | 5일 평균 | 종목 수
│       └── <tbody>: SurgingTheme[] 매핑
│
├── 로딩 상태: 스켈레톤 UI
├── 빈 상태: 안내 메시지
└── 에러 상태: 에러 메시지
```

### 의존성

| 의존 대상 | 용도 | 변경 필요 |
|-----------|------|----------|
| `useThemesSurging` | 데이터 조회 | 없음 |
| `SurgingTheme` 타입 | 데이터 모델 | 없음 |
| `DataSource` 타입 | Props 타입 | 없음 |
| Tailwind CSS | 스타일링 | 없음 |

### 파일 변경 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| `frontend/src/app/trend/_components/SurgingThemesCard.tsx` | 신규 | 급등 테마 카드 컴포넌트 |
| `frontend/src/app/trend/page.tsx` | 수정 | SurgingThemesCard 섹션 추가 |
| `frontend/src/app/trend/_components/__tests__/SurgingThemesCard.test.tsx` | 신규 | 단위 테스트 |

---

## 리스크 및 대응

### R-1: API 응답 형식 불일치

- **위험**: `SurgingTheme` 프론트엔드 타입과 백엔드 응답 필드가 다를 가능성
- **대응**: `api.ts`의 `SurgingTheme` 인터페이스와 `schemas.py`의 `ThemeSurgingItem` 비교 확인 완료. `change_sum`, `volume_sum` 필드가 백엔드에만 존재하나 프론트에서 사용하지 않으므로 영향 없음
- **심각도**: Low

### R-2: 테스트 환경 미설정

- **위험**: 프로젝트에 Vitest/Jest + React Testing Library 설정이 아직 없을 수 있음
- **대응**: 테스트 환경 설정이 없을 경우 기본 설정 파일 추가 (vitest.config.ts, setupTests.ts)
- **심각도**: Medium

### R-3: 대량 급등 테마 시 UI 스크롤

- **위험**: threshold를 낮게 설정하면 많은 테마가 표시될 수 있음
- **대응**: 최대 표시 개수 제한(상위 20개) 또는 스크롤 가능 컨테이너 적용
- **심각도**: Low

---

## 추적성 (Traceability)

| 태그 | 참조 |
|------|------|
| SPEC-MTT-003 | 본 구현 계획 |
| SPEC-MTT-002/F-04 | 급등 테마 화면 원본 요구사항 |
| SPEC-MTT-002/R-04-1 | 급등 테마 목록 조회 |
| SPEC-MTT-002/R-04-2 | Threshold 조절 UI |
