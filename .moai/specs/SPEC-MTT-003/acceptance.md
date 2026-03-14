# SPEC-MTT-003: 인수 기준

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-003 |
| 제목 | 신규 급등 테마 탐지 UI 컴포넌트 |
| 상태 | Completed |
| 작성일 | 2026-03-14 |
| 완료일 | 2026-03-14 |

---

## F-01: SurgingThemesCard 컴포넌트 구현

### AC-01-1: 급등 테마 데이터 렌더링

```gherkin
Given 선택된 날짜에 급등 테마 데이터가 존재할 때
When SurgingThemesCard 컴포넌트가 렌더링되면
Then 각 급등 테마의 테마명, RS 변화량, 현재 RS, 5일 평균 RS, 종목 수가 표시된다
And 급등 테마 목록은 rs_change 내림차순으로 정렬되어 있다
```

### AC-01-2: RS 변화량 시각적 강조

```gherkin
Given 급등 테마의 rs_change 값이 양수일 때
When 해당 값이 화면에 표시되면
Then "+" 접두사가 붙어 표시된다 (예: "+15.3")
And 텍스트 색상이 녹색(text-green-400)으로 표시된다
And 소수점 1자리까지 표시된다
```

### AC-01-3: Threshold 슬라이더 동작

```gherkin
Given SurgingThemesCard 컴포넌트가 렌더링된 상태에서
When 사용자가 threshold 슬라이더를 5에서 20으로 변경하면
Then "기준: +20" 텍스트가 표시된다
And useThemesSurging 훅이 threshold=20으로 재호출된다
And 급등 테마 목록이 새 threshold 기준으로 갱신된다
```

### AC-01-4: Threshold 슬라이더 범위

```gherkin
Given Threshold 슬라이더가 표시된 상태에서
When 슬라이더의 범위를 확인하면
Then 최솟값은 5이다
And 최댓값은 50이다
And 기본값은 10이다
```

### AC-01-5: Props 인터페이스 준수

```gherkin
Given SurgingThemesCard 컴포넌트에 date="2026-03-13"과 source="mtt"을 전달하면
When 컴포넌트가 렌더링되면
Then useThemesSurging 훅이 date="2026-03-13", source="mtt"로 호출된다
```

### AC-01-6: source 기본값

```gherkin
Given SurgingThemesCard 컴포넌트에 source를 전달하지 않으면
When 컴포넌트가 렌더링되면
Then useThemesSurging 훅이 source="52w_high"(기본값)로 호출된다
```

---

## F-02: trend/page.tsx 통합

### AC-02-1: 섹션 위치 확인

```gherkin
Given 트렌드 페이지에서 날짜가 선택된 상태에서
When 페이지 DOM을 확인하면
Then "테마별 RS 점수" 섹션 아래에 "신규 급등 테마 탐지" 섹션이 위치한다
And "신규 급등 테마 탐지" 섹션 아래에 "테마 RS 추이" 섹션이 위치한다
```

### AC-02-2: 섹션 제목 스타일

```gherkin
Given 트렌드 페이지가 렌더링되면
When "신규 급등 테마 탐지" 섹션 제목을 확인하면
Then h2 태그로 렌더링된다
And "text-lg font-semibold text-white mb-4" 클래스가 적용되어 있다
```

### AC-02-3: Props 전달 확인

```gherkin
Given 트렌드 페이지에서 날짜 "2026-03-13"이 선택되고 소스가 "mtt"일 때
When SurgingThemesCard가 렌더링되면
Then date 속성에 "2026-03-13"이 전달된다
And source 속성에 "mtt"가 전달된다
```

---

## F-03: 빈 상태 및 에러 처리

### AC-03-1: 로딩 상태 표시

```gherkin
Given useThemesSurging 훅이 데이터를 로딩 중일 때
When SurgingThemesCard 컴포넌트가 렌더링되면
Then bg-gray-800 rounded-xl p-6 컨테이너가 표시된다
And animate-pulse 클래스를 가진 스켈레톤 요소가 3개 이상 표시된다
And 테이블이나 데이터는 표시되지 않는다
```

### AC-03-2: 빈 결과 상태

```gherkin
Given useThemesSurging 훅이 빈 배열을 반환했을 때 (threshold=30 기준)
When SurgingThemesCard 컴포넌트가 렌더링되면
Then "현재 기준(+30) 이상 급등한 테마가 없습니다" 메시지가 표시된다
And "기준값을 낮추면 더 많은 테마를 확인할 수 있습니다" 보조 안내가 표시된다
And 메시지가 중앙 정렬로 표시된다
```

### AC-03-3: 에러 상태

```gherkin
Given useThemesSurging 훅이 에러를 반환했을 때
When SurgingThemesCard 컴포넌트가 렌더링되면
Then "데이터를 불러오는데 실패했습니다" 에러 메시지가 표시된다
And 메시지가 text-red-400 색상으로 표시된다
And 컨테이너가 bg-gray-800 rounded-xl p-6 스타일이다
```

---

## F-04: 테스트

### AC-04-1: 데이터 렌더링 테스트

```gherkin
Given useThemesSurging 훅이 2개의 급등 테마 데이터를 반환하도록 모킹되었을 때
When SurgingThemesCard를 date="2026-03-13"으로 렌더링하면
Then 2개의 테마명이 화면에 표시된다
And 각 테마의 RS 변화량이 "+" 접두사와 함께 표시된다
And 각 테마의 종목 수가 표시된다
```

### AC-04-2: 로딩 상태 테스트

```gherkin
Given useThemesSurging 훅이 isLoading=true를 반환하도록 모킹되었을 때
When SurgingThemesCard를 렌더링하면
Then animate-pulse 클래스를 가진 요소가 존재한다
And 테마명 텍스트가 표시되지 않는다
```

### AC-04-3: 빈 상태 테스트

```gherkin
Given useThemesSurging 훅이 data=[]를 반환하도록 모킹되었을 때
When SurgingThemesCard를 렌더링하면
Then "급등한 테마가 없습니다" 텍스트가 화면에 존재한다
```

### AC-04-4: 에러 상태 테스트

```gherkin
Given useThemesSurging 훅이 error 객체를 반환하도록 모킹되었을 때
When SurgingThemesCard를 렌더링하면
Then "실패" 텍스트가 화면에 존재한다
```

### AC-04-5: Threshold 변경 테스트

```gherkin
Given SurgingThemesCard가 렌더링된 상태에서
When 사용자가 threshold 슬라이더를 25로 변경하면
Then useThemesSurging 훅이 threshold=25로 호출된다
```

---

## F-05: 공통 품질 요구사항

### AC-05-1: 다크 테마 일관성

```gherkin
Given SurgingThemesCard 컴포넌트가 렌더링되면
When 컴포넌트의 최상위 컨테이너를 확인하면
Then bg-gray-800 클래스가 적용되어 있다
And 주요 텍스트는 text-white 클래스가 적용되어 있다
And 보조 텍스트는 text-gray-400 또는 text-gray-500 클래스가 적용되어 있다
```

### AC-05-2: TypeScript 타입 안전성

```gherkin
Given SurgingThemesCard.tsx 파일을 TypeScript 컴파일러로 검사하면
When tsc --noEmit 를 실행하면
Then 타입 에러가 0건이다
And any 타입이 사용되지 않았다
```

---

## 완료 정의 (Definition of Done)

- [x] SurgingThemesCard.tsx 파일이 `frontend/src/app/trend/_components/`에 생성됨
- [x] 컴포넌트가 급등 테마 데이터를 테이블/카드 형식으로 올바르게 표시함
- [x] Threshold 슬라이더(5~50, 기본값 10)가 동작하며 데이터를 실시간 갱신함
- [x] 로딩/빈 결과/에러 상태가 기존 컴포넌트와 일관되게 처리됨
- [x] trend/page.tsx에 "신규 급등 테마 탐지" 섹션이 올바른 위치에 추가됨
- [x] 단위 테스트 5개 케이스가 모두 통과함
- [x] TypeScript 컴파일 에러 없음 (tsc --noEmit)
- [x] 다크 테마 UI 일관성 확인

---

## 추적성 (Traceability)

| 태그 | 참조 |
|------|------|
| SPEC-MTT-003 | 본 인수 기준 |
| SPEC-MTT-002/F-04 | 급등 테마 화면 원본 요구사항 |
