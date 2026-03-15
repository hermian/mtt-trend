---
spec_id: SPEC-MTT-007
version: "1.0.0"
status: Completed
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
---

# 수용 기준: 그룹 액션 탐지 파라미터 툴팁 추가

## 개요

본 문서는 SPEC-MTT-007 "그룹 액션 탐지 파라미터 툴팁 추가"의 수용 기준을 정의합니다. 각 기능 요구사항에 대한 구체적인 테스트 시나리오를 포함합니다.

---

## 테스트 시나리오

### AC-01: 시간 윈도우 툴팁 표시

**Given:** 사용자가 그룹 액션 탐지 탭을 열었다
**When:** 시간 윈도우 파라미터 레이블에 마우스를 호버한다
**Then:** "신규 등장 종목 판정 기간 (일)" 툴팁이 표시된다

**테스트 케이스:**

```gherkin
Feature: 시간 윈도우 툴팁
  As a 사용자
  I want 시간 윈도우 파라미터에 대한 설명을 볼 수 있다
  So that 적절한 값을 설정할 수 있다

  Scenario: 마우스 호버로 툴팁 표시
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 시간 윈도우 레이블에 마우스를 호버한다
    Then 300ms 후에 툴팁이 표시된다
    And 툴팁 내용이 "신규 등장 종목 판정 기간 (일)"이다

  Scenario: 키보드 포커스로 툴팁 표시
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When Tab 키를 눌러 시간 윈도우 아이콘에 포커스한다
    Then 툴팁이 즉시 표시된다
    And 툴팁 내용이 "신규 등장 종목 판정 기간 (일)"이다

  Scenario: 툴팁 ARIA 속성 검증
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 시간 윈도우 레이블을 검사한다
    Then aria-describedby 속성이 "시간 윈도우-tooltip"으로 설정되어 있다
    And 툴팁 요소의 id가 "시간 윈도우-tooltip"이다
    And 툴팁 요소의 role이 "tooltip"이다
```

**자동화 테스트:**
- Jest + React Testing Library: 마우스 호버, 키보드 포커스, ARIA 속성

---

### AC-02: RS 임계값 툴팁 표시

**Given:** 사용자가 그룹 액션 탐지 탭을 열었다
**When:** RS 임계값 파라미터 레이블에 마우스를 호버한다
**Then:** "테마 RS 상승 판정 기준 (-10~+20)" 툴팁이 표시된다

**테스트 케이스:**

```gherkin
Feature: RS 임계값 툴팁
  As a 사용자
  I want RS 임계값 파라미터에 대한 설명을 볼 수 있다
  So that 적절한 값을 설정할 수 있다

  Scenario: 마우스 호버로 툴팁 표시
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When RS 임계값 레이블에 마우스를 호버한다
    Then 300ms 후에 툴팁이 표시된다
    And 툴팁 내용이 "테마 RS 상승 판정 기준 (-10~+20)"이다

  Scenario: 키보드 포커스로 툴팁 표시
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When Tab 키를 눌러 RS 임계값 아이콘에 포커스한다
    Then 툴팁이 즉시 표시된다
    And 툴팁 내용이 "테마 RS 상승 판정 기준 (-10~+20)"이다

  Scenario: 툴팁 ARIA 속성 검증
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When RS 임계값 레이블을 검사한다
    Then aria-describedby 속성이 "RS 임계값-tooltip"으로 설정되어 있다
    And 툴팁 요소의 id가 "RS 임계값-tooltip"이다
    And 툴팁 요소의 role이 "tooltip"이다
```

**자동화 테스트:**
- Jest + React Testing Library: 마우스 호버, 키보드 포커스, ARIA 속성

---

### AC-03: 상태 임계값 툴팁 표시

**Given:** 사용자가 그룹 액션 탐지 탭을 열었다
**When:** 상태 임계값 파라미터 레이블에 마우스를 호버한다
**Then:** "상태 분류 기준 (1~20)" 툴팁이 표시된다

**테스트 케이스:**

```gherkin
Feature: 상태 임계값 툴팁
  As a 사용자
  I want 상태 임계값 파라미터에 대한 설명을 볼 수 있다
  So that 적절한 값을 설정할 수 있다

  Scenario: 마우스 호버로 툴팁 표시
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 상태 임계값 레이블에 마우스를 호버한다
    Then 300ms 후에 툴팁이 표시된다
    And 툴팁 내용이 "상태 분류 기준 (1~20)"이다

  Scenario: 키보드 포커스로 툴팁 표시
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When Tab 키를 눌러 상태 임계값 아이콘에 포커스한다
    Then 툴팁이 즉시 표시된다
    And 툴팁 내용이 "상태 분류 기준 (1~20)"이다

  Scenario: 툴팁 ARIA 속성 검증
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 상태 임계값 레이블을 검사한다
    Then aria-describedby 속성이 "상태 임계값-tooltip"으로 설정되어 있다
    And 툴팁 요소의 id가 "상태 임계값-tooltip"이다
    And 툴팁 요소의 role이 "tooltip"이다
```

**자동화 테스트:**
- Jest + React Testing Library: 마우스 호버, 키보드 포커스, ARIA 속성

---

### AC-04: 툴팁 아이콘 표시

**Given:** 사용자가 그룹 액션 탐지 탭을 열었다
**When:** 파라미터 컨트롤 영역이 렌더링된다
**Then:** 각 파라미터 레이블 옆에 InformationCircleIcon이 표시된다

**테스트 케이스:**

```gherkin
Feature: 툴팁 아이콘 표시
  As a 사용자
  I want 파라미터 옆에 툴팁 아이콘이 표시되기를 원한다
  So that 툴팁이 있음을 시각적으로 알 수 있다

  Scenario: 아이콘 크기 및 색상 검증
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 시간 윈도우 아이콘을 검사한다
    Then 아이콘 크기가 16x16px (w-4 h-4)이다
    And 아이콘 색상이 text-gray-400이다

  Scenario: 아이콘 호버 색상 변경
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 시간 윈도우 아이콘에 마우스를 호버한다
    Then 아이콘 색상이 text-gray-300으로 변경된다

  Scenario: 아이콘 ARIA 속성 검증
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 시간 윈도우 아이콘을 검사한다
    Then aria-hidden 속성이 "true"로 설정되어 있다
    And 아이콘이 장식용으로 스크린 리더에 숨겨진다
```

**자동화 테스트:**
- Jest + React Testing Library: 아이콘 렌더링, 크기, 색상, ARIA 속성

---

### AC-05: 접근성 준수

**Given:** 사용자가 그룹 액션 탐지 탭을 열었다
**When:** 툴팁이 표시된다
**Then:** WCAG 2.1 레벨 AA 기준을 준수한다

**테스트 케이스:**

```gherkin
Feature: 접근성 준수
  As a 스크린 리더 사용자
  I want 툴팁에 접근할 수 있다
  So that 파라미터 설명을 들을 수 있다

  Scenario: 색상 대비 검증
    Given 툴팁이 표시된다
    When 툴팁 배경색(#1F2937)과 텍스트 색상(#F9FAFB)의 대비율을 측정한다
    Then 대비율이 7:1 이상이다

  Scenario: 키보드 네비게이션
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When Tab 키를 3회 누른다
    Then 시간 윈도우 아이콘에 포커스된다
    And 툴팁이 표시된다

  Scenario: 스크린 리더 호환성
    Given 스크린 리더가 활성화되어 있다
    When 시간 윈도우 레이블에 포커스한다
    Then 스크린 리더가 "시간 윈도우: 3일, 신규 등장 종목 판정 기간 (일)"을 읽는다

  Scenario: 포커스 표시
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When Tab 키로 아이콘에 포커스한다
    Then 명확한 포커스 아웃라인이 표시된다
    And 아웃라인 색상이 ring-blue-500이다
```

**자동화 테스트:**
- axe-core: 색상 대비, ARIA 속성
- React Testing Library: 키보드 네비게이션
- 수동 테스트: NVDA/JAWS 스크린 리더

---

### AC-06: 반응형 디자인

**Given:** 사용자가 다양한 화면 크기로 그룹 액션 탐지 탭을 연다
**When:** 화면 크기가 변경된다
**Then:** 툴팁 위치가 자동으로 조정된다

**테스트 케이스:**

```gherkin
Feature: 반응형 디자인
  As a 모바일 사용자
  I want 화면 크기에 관계없이 툴팁을 볼 수 있다
  So that 작은 화면에서도 파라미터 설명을 확인할 수 있다

  Scenario: 모바일 화면 (640px 미만)
    Given 화면 너비가 375px이다
    When 시간 윈도우 레이블에 마우스를 호버한다
    Then 툴팁이 레이블 하단에 표시된다
    And 툴팁이 화면을 벗어나지 않는다

  Scenario: 태블릿 화면 (640px 이상)
    Given 화면 너비가 768px이다
    When 시간 윈도우 레이블에 마우스를 호버한다
    Then 툴팁이 레이블 하단 중앙에 표시된다
    And 툴팁이 중앙 정렬된다

  Scenario: 데스크톱 화면 (1024px 이상)
    Given 화면 너비가 1920px이다
    When 시간 윈도우 레이블에 마우스를 호버한다
    Then 툴팁이 레이블 하단 중앙에 표시된다
    And 툴팁이 최대 너비 200px로 표시된다

  Scenario: 화면 경계 처리
    Given 화면 너비가 375px이다
    And RS 임계값 레이블이 화면 오른쪽에 위치한다
    When RS 임계값 레이블에 마우스를 호버한다
    Then 툴팁이 화면 오른쪽 경계를 벗어나지 않도록 왼쪽으로 조정된다
```

**자동화 테스트:**
- Jest + React Testing Library: viewport 변경 시 툴팁 위치
- 수동 테스트: Chrome DevTools 디바이스 모드

---

### AC-07: 기존 기능 유지

**Given:** 사용자가 그룹 액션 탐지 탭을 열었다
**When:** 툴팁 기능이 추가된다
**Then:** 기존 슬라이더 기능이 변경되지 않는다

**테스트 케이스:**

```gherkin
Feature: 기존 기능 유지
  As a 기존 사용자
  I want 슬라이더 기능이 이전과 동일하게 작동하기를 원한다
  So that 익숙한 방식으로 파라미터를 조절할 수 있다

  Scenario: 슬라이더 값 변경
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 시간 윈도우 슬라이더를 5로 변경한다
    Then 시간 윈도우 값이 5로 변경된다
    And API가 새로운 timeWindow=5 파라미터로 호출된다

  Scenario: 슬라이더 범위 제한
    Given 사용자가 그룹 액션 탐지 탭을 열었다
    When 시간 윈도우 슬라이더를 최소값(1)으로 설정한다
    Then 슬라이더가 1 이하로 내려가지 않는다

  Scenario: 기존 테스트 통과
    Given 기존 GroupActionTable 테스트가 있다
    When 테스트를 실행한다
    Then 모든 기존 테스트가 통과한다
    And 새로운 테스트도 통과한다
```

**자동화 테스트:**
- Jest: 기존 테스트 회귀 확인
- React Testing Library: 슬라이더 기능 검증

---

## 품질 검증 방법

### 자동화 테스트

| 도구 | 용도 | 커버리지 목표 |
|------|------|---------------|
| Jest | 단위 테스트 | 100% (Tooltip), 85%+ (GroupActionTable) |
| React Testing Library | 컴포넌트 테스트 | 모든 시나리오 |
| axe-core | 접근성 자동화 | WCAG 2.1 AA |

### 수동 테스트

| 항목 | 도구 | 브라우저 |
|------|------|----------|
| 스크린 리더 | NVDA (Windows), VoiceOver (macOS) | Chrome, Safari |
| 키보드 네비게이션 | 수동 | Chrome, Firefox, Safari |
| 반응형 디자인 | Chrome DevTools | 모바일, 태블릿, 데스크톱 |
| 색상 대비 | Colour Contrast Analyser | - |

### 성능 검증

| 항목 | 목표 | 측정 도구 |
|------|------|-----------|
| 툴팁 렌더링 시간 | 100ms 이내 | React DevTools Profiler |
| Lighthouse 접근성 점수 | 90+ | Lighthouse |
| First Contentful Paint 영향 | 없음 | Lighthouse |

---

## 완료 확인清单

### 기능 검증

- [ ] AC-01: 시간 윈도우 툴팁 표시 (모든 시나리오 통과)
- [ ] AC-02: RS 임계값 툴팁 표시 (모든 시나리오 통과)
- [ ] AC-03: 상태 임계값 툴팁 표시 (모든 시나리오 통과)
- [ ] AC-04: 툴팁 아이콘 표시 (모든 시나리오 통과)
- [ ] AC-05: 접근성 준수 (모든 시나리오 통과)
- [ ] AC-06: 반응형 디자인 (모든 시나리오 통과)
- [ ] AC-07: 기존 기능 유지 (모든 시나리오 통과)

### 자동화 테스트

- [ ] Jest 단위 테스트 100% 통과 (Tooltip)
- [ ] Jest 단위 테스트 85%+ 통과 (GroupActionTable)
- [ ] React Testing Library 컴포넌트 테스트 통과
- [ ] axe-core 접근성 테스트 통과

### 수동 테스트

- [ ] NVDA/VoiceOver 스크린 리더 테스트 통과
- [ ] 키보드 네비게이션 테스트 통과 (Chrome, Firefox, Safari)
- [ ] 반응형 디자인 테스트 통과 (모바일, 태블릿, 데스크톱)
- [ ] 색상 대비 검증 통과 (7:1 이상)

### 성능 검증

- [ ] 툴팁 렌더링 100ms 이내
- [ ] Lighthouse 접근성 점수 90+
- [ ] First Contentful Paint 영향 없음

### 문서화

- [ ] SPEC-MTT-006 문서에 툴팁 내용 추가
- [ ] README 업데이트 (필요 시)
- [ ] CHANGELOG 업데이트 (필요 시)
