---
id: SPEC-MTT-007
version: "1.0.0"
status: completed
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
priority: Medium
issue_number: 0
---

# SPEC-MTT-007: 그룹 액션 탐지 파라미터 툴팁 추가

## 변경 이력 (History)

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2026-03-15 | Hosung Kim | 초기 SPEC 문서 작성 |

---

## 배경 (Background)

SPEC-MTT-006에서 그룹 액션 탐지 파라미터(시간 윈도우, RS 임계값, 상태 임계값)를 조절할 수 있는 슬라이더 UI를 구현했습니다. 그러나 각 파라미터의 역할과 의미가 사용자에게 명확하지 않아, 적절한 값 설정에 어려움이 있습니다.

본 SPEC은 각 파라미터에 대한 설명을 툴팁으로 제공하여 사용자 경험을 개선합니다:

1. **정보 제공**: 파라미터의 역할을 명확히 설명
2. **사용성 향상**: 적절한 값 설정 가이드 제공
3. **일관성**: 기존 UI 디자인 시스템 준수

---

## 가정 (Assumptions)

### A-01: 프론트엔드 기술 스택
- Next.js 14.1.0+, React 18.2.0+, Tailwind CSS 3.4.1 호환
- Headless UI 1.7.0+ 툴팁 컴포넌트 사용 가능
- 기존 Heroicons 2.0+ 아이콘 활용

### A-02: 기존 컴포넌트 구조
- `GroupActionTable.tsx`의 `SliderControl` 컴포넌트 확장 가능
- 기존 `@MX:NOTE` 태그로 주석된 코드 영역 존중

### A-03: 접근성 요구사항
- WCAG 2.1 레벨 AA 준수
- 키보드 네비게이션 지원 (Tab, Enter)
- 스크린 리더 호환성

---

## 요구사항 (Requirements)

### F-01: 시간 윈도우 툴팁

**WHEN** 사용자가 시간 윈도우 파라미터 레이블에 마우스를 호버하거나 포커스하면, **THEN** 시스템은 다음 설명을 툴팁으로 표시 **SHALL** 한다.

**툴팁 내용:**
```
신규 등장 종목 판정 기간 (일)
```

**상세 사양:**
- 툴팁 위치: 레이블 하단 중앙
- 툴팁 너비: 최대 200px, 텍스트 자동 줄바꿈
- 표시 지연: 호버 후 300ms
- 숨김 지연: 마우스 이탈 후 100ms

**접근성:**
- `aria-describedby` 속성으로 툴팁 연결
- 키보드 포커스 시에도 툴팁 표시
- `role="tooltip"` 속성 적용

---

### F-02: RS 임계값 툴팁

**WHEN** 사용자가 RS 임계값 파라미터 레이블에 마우스를 호버하거나 포커스하면, **THEN** 시스템은 다음 설명을 툴팁으로 표시 **SHALL** 한다.

**툴팁 내용:**
```
테마 RS 상승 판정 기준 (-10~+20)
```

**상세 사양:**
- 툴팁 위치: 레이블 하단 중앙
- 툴팁 너비: 최대 200px, 텍스트 자동 줄바꿈
- 표시 지연: 호버 후 300ms
- 숨김 지연: 마우스 이탈 후 100ms

**접근성:**
- `aria-describedby` 속성으로 툴팁 연결
- 키보드 포커스 시에도 툴팁 표시
- `role="tooltip"` 속성 적용

---

### F-03: 상태 임계값 툴팁

**WHEN** 사용자가 상태 임계값 파라미터 레이블에 마우스를 호버하거나 포커스하면, **THEN** 시스템은 다음 설명을 툴팁으로 표시 **SHALL** 한다.

**툴팁 내용:**
```
주식 상태 분류 기준 (1~20)
테마 RS 변화량이 임계값을 초과하면 '신규',
-임계값 미만이면 '재등장', 그 외는 '유지'로 분류
```

**상세 사양:**
- 툴팁 위치: 레이블 하단 중앙
- 툴팁 너비: 최대 200px, 텍스트 자동 줄바꿈
- 표시 지연: 호버 후 300ms
- 숨김 지연: 마우스 이탈 후 100ms

**접근성:**
- `aria-describedby` 속성으로 툴팁 연결
- 키보드 포커스 시에도 툴팁 표시
- `role="tooltip"` 속성 적용

---

### F-04: 툴팁 아이콘 표시

**WHEN** 파라미터 레이블이 표시되면, **THEN** 시스템은 툴팁 존재를 나타내는 정보 아이콘을 레이블 옆에 표시 **SHALL** 한다.

**상세 사양:**
- 아이콘: Heroicons `InformationCircleIcon` (solid variant)
- 아이콘 크기: 16x16px (w-4 h-4)
- 아이콘 색상: `text-gray-400` (기본), `text-gray-300` (호버 시)
- 위치: 레이블 텍스트 오른쪽, 4px 간격
- 인터랙션: 아이콘 호버/포커스 시에도 툴팁 표시

**접근성:**
- `aria-hidden="true"` 속성 (장식용 아이콘)
- 레이블 텍스트에 `aria-label`로 추가 설명 불필요
- 아이콘 클릭 불필요 (호버/포커스만으로 충분)

---

### NFR-01: 툴팁 성능

**WHEN** 툴팁이 표시되면, **THEN** 시스템은 100ms 이내에 렌더링을 완료 **SHALL** 한다.

**상세 사양:**
- 측정 기준: 마우스 호버부터 툴팁 표시까지의 시간
- 최적화: 툴팁 컴포넌트 지연 로딩 불필요 (작은 컴포넌트)
- 애니메이션: fade-in 효과 (duration-150)

---

### NFR-02: 반응형 디자인

**WHEN** 화면 크기가 변경되면, **THEN** 시스템은 툴팁 위치를 자동으로 조정 **SHALL** 한다.

**상세 사양:**
- 모바일 (640px 미만): 툴팁을 레이블 하단에 표시
- 태블릿/데스크톱 (640px 이상): 툴팁을 레이블 하단 중앙에 표시
- 화면 경계 처리: 툴팁이 화면을 벗어나지 않도록 자동 조정

---

### NFR-03: 접근성 준수

**WHEN** 툴팁이 표시되면, **THEN** 시스템은 WCAG 2.1 레벨 AA 기준을 준수 **SHALL** 한다.

**상세 사양:**
- 색상 대비: 툴팁 배경(#1F2937)과 텍스트(#F9FAFB) 대비율 7:1 이상
- 키보드 접근: Tab 키로 아이콘 포커스, Enter로 툴팁 토글
- 스크린 리더: `aria-describedby`로 툴팁 내용 읽기
- 포커스 표시: 포커스 시 명확한 아웃라인 표시

---

## 제약사항 (Constraints)

### C-01: 기술 스택 제약
- 프론트엔드: Next.js 14.1.0+, React 18.2.0+, Tailwind CSS 3.4.1
- 아이콘: Heroicons 2.0+ (기존 의존성 활용)
- 툴팁: Headless UI 1.7.0+ 또는 커스텀 구현

### C-02: UI 제약
- 기존 `SliderControl` 컴포넌트 구조 유지
- 기존 디자인 시스템 색상 팔레트 준수
- 슬라이더 기능 변경 없음 (툴팁만 추가)

### C-03: 접근성 제약
- WCAG 2.1 레벨 AA 준수 필수
- 키보드 네비게이션 지원 필수
- 스크린 리더 호환성 필수

---

## 기술 참고 (Technical Notes)

### T-01: Headless UI 툴팁 패턴

**참고 구현:**
```tsx
import { Popover } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/solid';

function Tooltip({ content, children }) {
  return (
    <Popover className="relative inline-block">
      <Popover.Button className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
        {children}
      </Popover.Button>
      <Popover.Panel className="absolute z-10 w-48 px-3 py-2 text-sm text-gray-100 bg-gray-800 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2">
        {content}
      </Popover.Panel>
    </Popover>
  );
}
```

### T-02: 커스텀 툴팁 구현 (Headless UI 미사용 시)

**참고 구현:**
```tsx
import { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/solid';

function Tooltip({ content, children }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <InformationCircleIcon className="w-4 h-4 ml-1 text-gray-400" aria-hidden="true" />
      {isVisible && (
        <div
          role="tooltip"
          className="absolute z-10 w-48 px-3 py-2 text-sm text-gray-100 bg-gray-800 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2"
        >
          {content}
        </div>
      )}
    </div>
  );
}
```

### T-03: SliderControl 컴포넌트 확장

**기존 코드 (Line 17-58):**
```tsx
function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  rangeLabel,
  onChange,
  unit = "",
}: {...}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={`${label}-slider`} className="text-sm text-gray-400">
          {label}: {value}{unit}
        </label>
        <span className="text-xs text-gray-500">[{rangeLabel}]</span>
      </div>
      {/* slider element */}
    </div>
  );
}
```

**확장 후 코드 (예상):**
```tsx
function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  rangeLabel,
  onChange,
  unit = "",
  tooltip, // NEW: 툴팁 내용
}: {...} & { tooltip?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="relative inline-flex items-center">
          <label htmlFor={`${label}-slider`} className="text-sm text-gray-400">
            {label}: {value}{unit}
          </label>
          {tooltip && (
            <Tooltip content={tooltip}>
              <InformationCircleIcon className="w-4 h-4 ml-1 text-gray-400" aria-hidden="true" />
            </Tooltip>
          )}
        </div>
        <span className="text-xs text-gray-500">[{rangeLabel}]</span>
      </div>
      {/* slider element */}
    </div>
  );
}
```

### T-04: 접근성 속성 적용

**ARIA 속성 예시:**
```tsx
<div className="relative">
  <label
    id={`${label}-label`}
    htmlFor={`${label}-slider`}
    className="text-sm text-gray-400"
    aria-describedby={tooltip ? `${label}-tooltip` : undefined}
  >
    {label}: {value}{unit}
  </label>
  {tooltip && (
    <div
      id={`${label}-tooltip`}
      role="tooltip"
      className="absolute z-10 ..."
    >
      {tooltip}
    </div>
  )}
</div>
```

### T-05: 테스트 전략

**프론트엔드 테스트 (Jest + React Testing Library):**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupActionTable } from './GroupActionTable';

describe('GroupActionTable Tooltips', () => {
  it('should display time window tooltip on hover', async () => {
    render(<GroupActionTable date="2024-01-15" />);

    const timeWindowLabel = screen.getByLabelText(/시간 윈도우/);
    fireEvent.mouseOver(timeWindowLabel);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/신규 등장 종목 판정 기간/);
  });

  it('should display tooltip on keyboard focus', async () => {
    const user = userEvent.setup();
    render(<GroupActionTable date="2024-01-15" />);

    await user.tab(); // 첫 번째 포커스 가능 요소로 이동
    await user.tab(); // 시간 윈도우 아이콘으로 이동

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeVisible();
  });

  it('should have correct ARIA attributes', () => {
    render(<GroupActionTable date="2024-01-15" />);

    const label = screen.getByLabelText(/시간 윈도우/);
    expect(label).toHaveAttribute('aria-describedby', '시간 윈도우-tooltip');

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveAttribute('id', '시간 윈도우-tooltip');
  });
});
```

---

## 추적성 (Traceability)

### 태그 매핑

| 태그 | 참조 문서 | 설명 |
|------|----------|------|
| SPEC-MTT-007 | 본 문서 | 그룹 액션 탐지 파라미터 툴팁 추가 |
| SPEC-MTT-006 | `.moai/specs/SPEC-MTT-006/` | 슬라이더 UI 구현 (선행) |

### 의존성

| 관계 | 대상 | 설명 |
|------|------|------|
| 선행 | SPEC-MTT-006 | 슬라이더 UI 컴포넌트 확장 필요 |
| 후행 | - | 없음 |

### 코드 참조

| 파일 | 라인 | 관련 요구사항 |
|------|------|--------------|
| `frontend/src/app/trend/_components/GroupActionTable.tsx` | 17-58 | F-01, F-02, F-03, F-04 (SliderControl 확장) |
| `frontend/src/app/trend/_components/GroupActionTable.tsx` | 216-244 | F-01, F-02, F-03 (툴팁 prop 전달) |

---

## 수용 기준 (Acceptance Criteria)

### AC-01: 시간 윈도우 툴팁 표시
- [ ] 시간 윈도우 레이블 호버 시 "신규 등장 종목 판정 기간 (일)" 툴팁 표시
- [ ] 툴팁이 300ms 지연 후 표시됨
- [ ] 키보드 포커스 시에도 툴팁 표시됨
- [ ] `aria-describedby` 속성이 올바르게 설정됨

### AC-02: RS 임계값 툴팁 표시
- [ ] RS 임계값 레이블 호버 시 "테마 RS 상승 판정 기준 (-10~+20)" 툴팁 표시
- [ ] 툴팁이 300ms 지연 후 표시됨
- [ ] 키보드 포커스 시에도 툴팁 표시됨
- [ ] `aria-describedby` 속성이 올바르게 설정됨

### AC-03: 상태 임계값 툴팁 표시
- [ ] 상태 임계값 레이블 호버 시 "주식 상태 분류 기준 (1~20). 테마 RS 변화량이 임계값을 초과하면 '신규', -임계값 미만이면 '재등장', 그 외는 '유지'로 분류" 툴팁 표시
- [ ] 툴팁이 300ms 지연 후 표시됨
- [ ] 키보드 포커스 시에도 툴팁 표시됨
- [ ] `aria-describedby` 속성이 올바르게 설정됨

### AC-04: 툴팁 아이콘 표시
- [ ] 각 파라미터 레이블 옆에 InformationCircleIcon 표시
- [ ] 아이콘 크기가 16x16px임
- [ ] 아이콘 색상이 `text-gray-400`임
- [ ] 아이콘 호버 시 `text-gray-300`으로 변경됨

### AC-05: 접근성 준수
- [ ] WCAG 2.1 레벨 AA 색상 대비 기준 충족
- [ ] Tab 키로 툴팁 아이콘 포커스 가능
- [ ] 스크린 리더가 툴팁 내용 읽기 가능
- [ ] 포커스 시 명확한 아웃라인 표시

### AC-06: 반응형 디자인
- [ ] 모바일 (640px 미만)에서 툴팁이 적절히 표시됨
- [ ] 태블릿/데스크톱 (640px 이상)에서 툴팁이 중앙 정렬됨
- [ ] 화면 경계를 벗어나지 않도록 자동 조정됨

### AC-07: 기존 기능 유지
- [ ] 슬라이더 기능이 변경되지 않음
- [ ] API 호출 로직이 변경되지 않음
- [ ] 기존 테스트가 모두 통과함
