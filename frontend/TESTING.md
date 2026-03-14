# Frontend Testing Guide

## Overview

이 문서는 SPEC-MTT-002 프론트엔드 통합을 위한 테스트 전략과 실행 방법을 설명합니다.

## Test Structure

```
frontend/
├── src/
│   ├── lib/
│   │   └── __tests__/
│   │       └── api.test.ts           # API 레이어 테스트
│   ├── hooks/
│   │   └── __tests__/
│   │       ├── useThemes.test.ts     # 테마 훅 테스트
│   │       └── useStocks.test.ts     # 종목 훅 테스트
│   └── app/
│       └── trend/
│           ├── __tests__/
│           │   └── page.test.tsx     # 페이지 통합 테스트
│           └── _components/
│               └── __tests__/
│                   ├── TopThemesBar.test.tsx
│                   └── StockAnalysisTabs.test.tsx
└── e2e/
    └── trend-page.spec.ts            # E2E 테스트
```

## Testing Technologies

- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **Coverage**: Vitest Coverage (v8)

## Test Categories

### 1. Unit Tests (단위 테스트)

개별 함수, 훅, 컴포넌트의 동작을 검증합니다.

#### API Layer Tests (`api.test.ts`)
- 모든 API 함수의 요청/응답 검증
- 에러 처리 검증
- 파라미터 전달 검증

#### Hook Tests (`useThemes.test.ts`, `useStocks.test.ts`)
- 데이터 fetching 동작 검증
- 로딩/에러 상태 검증
- 캐싱 동작 검증
- 의존성 조건부 fetch 검증

#### Component Tests (`*.test.tsx`)
- 렌더링 동작 검증
- 사용자 인터랙션 검증
- 상태 변화에 따른 UI 업데이트 검증

### 2. Integration Tests (통합 테스트)

여러 컴포넌트와 훅이 함께 동작하는 시나리오를 검증합니다.

#### Page Integration Tests (`page.test.tsx`)
- 전체 페이지 렌더링
- 소스 전환 동작
- 날짜 선택 및 초기화
- 섹션 간 데이터 흐름

### 3. E2E Tests (End-to-End 테스트)

실제 사용자 시나리오를 브라우저에서 검증합니다.

#### E2E Tests (`trend-page.spec.ts`)
- 페이지 로드 및 초기 상태
- 소스 전환
- 날짜 선택
- 탭 전환
- API 에러 처리
- 로딩 상태 표시

## Running Tests

### Prerequisites

```bash
# 개발 의존성 설치 (npm이 있는 경우)
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react jsdom @vitest/coverage-v8 @playwright/test

# 또는 package.json에 이미 포함되어 있으면
npm install
```

### Unit Tests

```bash
# 모든 단위 테스트 실행
npm test

# watch mode (파일 변경 시 자동 재실행)
npm test -- --watch

# UI 모드 (브라우저에서 테스트 결과 확인)
npm run test:ui

# 커버리지 리포트 생성
npm run test:coverage
```

### E2E Tests

```bash
# 모든 E2E 테스트 실행
npm run test:e2e

# 헤드리스 모드 (CI 환경)
npm run test:e2e -- --headed=false

# UI 모드 (디버깅용)
npm run test:e2e:ui

# 특정 테스트만 실행
npm run test:e2e -- -g "should switch between data sources"
```

### Coverage Goals

- **최소 커버리지**: 80%
- **권장 커버리지**: 85%
- **모든 공개 API**: 테스트 필요
- **에지 케이스**: 검증 필요

## TDD Workflow

### RED 단계: 실패하는 테스트 작성

1. 테스트를 먼저 작성
2. 테스트가 실패하는 것을 확인
3. 예상되는 동작을 문서화

### GREEN 단계: 최소 구현

1. 테스트를 통과하는 최소 코드 작성
2. 하드코딩 허용
3. 올바른 동작에 집중

### REFACTOR 단계: 코드 개선

1. 테스트를 통과하면서 코드 개선
2. 중복 제거
3. 이름 개선
4. 구조 개선

## Test Examples

### API Test Example

```typescript
describe("getDates", () => {
  it("should fetch dates for 52w_high source", async () => {
    // Arrange
    const mockDates = ["2024-01-01", "2024-01-02"];
    vi.spyOn(api, "getDates").mockResolvedValue(mockDates);

    // Act
    const result = await api.getDates("52w_high");

    // Assert
    expect(result).toEqual(mockDates);
  });
});
```

### Hook Test Example

```typescript
describe("useDates", () => {
  it("should fetch dates", async () => {
    // Arrange
    const mockDates = ["2024-01-01", "2024-01-02"];
    vi.spyOn(api.api, "getDates").mockResolvedValue(mockDates);

    // Act
    const { result } = renderHook(() => useDates("52w_high"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDates);
  });
});
```

### Component Test Example

```typescript
describe("TopThemesBar", () => {
  it("should render top 15 themes", () => {
    // Arrange
    const mockThemes = Array.from({ length: 15 }, ...);
    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText("Theme 1")).toBeInTheDocument();
  });
});
```

## Debugging Tests

### Vitest

```bash
# 디버그 모드
npm test -- --inspect-brk --no-coverage

# 특정 파일만 테스트
npm test -- api.test.ts

# 특정 테스트만 실행 (t.only 사용)
npm test -- -t "should fetch dates"
```

### Playwright

```bash
# UI 모드로 디버깅
npm run test:e2e:ui

# 특정 테스트만 실행
npm run test:e2e -- -g "should switch between data sources"

# 슬로우 모션 (디버깅용)
npm run test:e2e -- --slow-mo=1000
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - run: npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **테스트가 타임아웃됨**
   - `vi.useFakeTimers()` 사용
   - 비동기 코드 properly await

2. **Mock가 작동하지 않음**
   - 모듈 경로 확인 (@/ alias 사용)
   - `vi.mock()` 호출 위치 확인

3. **E2E 테스트가 불안정함**
   - `await page.waitForSelector()` 사용
   - 네트워크 요청 완료 대기
   - 재시도 메커니즘 활성화

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
