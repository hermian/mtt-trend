# SPEC-MTT-006 수락 기준

## 개요

본 문서는 SPEC-MTT-006 (그룹 액션 탐지 기능 고도화)의 수락 기준을 정의합니다. 각 수락 기준(AC)은 Given-When-Then 형식의 테스트 시나리오를 포함합니다.

---

## AC-01: 시간 윈도우 파라미터

### Scenario 1.1: 최소값 (1일)

- **Given** 사용자가 그룹 액션 탐지 페이지에 접속하고
- **When** 시간 윈도우를 1일로 설정하고
- **Then** 1일 내 등장한 종목만 표시된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=1"
# 응답에 first_seen_date가 2024-01-15인 종목만 포함되어야 함
```

### Scenario 1.2: 최대값 (7일)

- **Given** 사용자가 그룹 액션 탐지 페이지에 접속하고
- **When** 시간 윈도우를 7일로 설정하고
- **Then** 7일 내 등장한 종목만 표시된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=7"
# 응답에 first_seen_date가 2024-01-09 ~ 2024-01-15 범위인 종목만 포함
```

### Scenario 1.3: 기본값 (3일)

- **Given** 사용자가 그룹 액션 탐지 페이지에 접속하고
- **When** 시간 윈도우 파라미터를 생략하고
- **Then** 기존 SPEC-MTT-002와 동일한 결과 (3일 윈도우)가 반환된다

**검증 방법:**
```bash
# 새 API 호출
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15"
# 기존 API 호출 결과와 비교 (동일해야 함)
```

### Scenario 1.4: 범위 외 값 거부

- **Given** 사용자가 그룹 액션 탐지 API를 호출하고
- **When** 시간 윈도우를 0 또는 8로 설정하고
- **Then** 400 Bad Request 오류가 반환된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=0"
# 응답: 400 Bad Request

curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=8"
# 응답: 400 Bad Request
```

---

## AC-02: RS 임계값 파라미터

### Scenario 2.1: 양수 임계값 (5)

- **Given** 사용자가 그룹 액션 탐지 페이지에 접속하고
- **When** RS 임계값을 5로 설정하고
- **Then** RS 변화량이 5보다 큰 종목만 표시된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&rsThreshold=5"
# 응답의 모든 종목이 theme_rs_change > 5 조건 충족
```

### Scenario 2.2: 음수 임계값 (-5)

- **Given** 사용자가 그룹 액션 탐지 페이지에 접속하고
- **When** RS 임계값을 -5로 설정하고
- **Then** RS 변화량이 -5보다 큰 종목만 표시된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&rsThreshold=-5"
# 응답의 모든 종목이 theme_rs_change > -5 조건 충족
```

### Scenario 2.3: 기본값 (0)

- **Given** 사용자가 그룹 액션 탐지 페이지에 접속하고
- **When** RS 임계값 파라미터를 생략하고
- **Then** 기존 동작(RS 변화량 > 0)과 동일한 결과가 반환된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15"
# 응답의 모든 종목이 theme_rs_change > 0 조건 충족
```

### Scenario 2.4: 범위 외 값 거부

- **Given** 사용자가 그룹 액션 탐지 API를 호출하고
- **When** RS 임계값을 -11 또는 21로 설정하고
- **Then** 400 Bad Request 오류가 반환된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&rsThreshold=-11"
# 응답: 400 Bad Request

curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&rsThreshold=21"
# 응답: 400 Bad Request
```

---

## AC-03: 상태 분류 임계값 파라미터

### Scenario 3.1: 기본값 (5)

- **Given** 그룹 액션 API 응답을 받고
- **When** 프론트엔드에서 상태를 분류하면
- **Then** `theme_rs_change`가 5 초과 시 "new", -5 미만 시 "returning"으로 분류된다

**검증 방법:**
```typescript
const stock = { theme_rs_change: 6, ... };
const status = getStockStatus(stock); // "new"
```

### Scenario 3.2: 사용자 정의 임계값 (10)

- **Given** 사용자가 상태 임계값 슬라이더를 10으로 조정하고
- **When** 프론트엔드에서 상태를 분류하면
- **Then** `theme_rs_change`가 10 초과 시 "new", -10 미만 시 "returning"으로 분류된다

**검증 방법:**
```typescript
const stock = { theme_rs_change: 8, status_threshold: 10, ... };
const status = getStockStatus(stock); // "neutral" (8 <= 10)
```

### Scenario 3.3: 스키마 필드 추가

- **Given** 그룹 액션 API를 호출하고
- **When** 응답을 받으면
- **Then** 각 종목에 `status_threshold` 필드가 포함된다

**검증 방법:**
```bash
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15"
# 응답 JSON의 각 stock 항목에 status_threshold 필드 존재 확인
```

---

## AC-04: UI 파라미터 컨트롤

### Scenario 4.1: 시간 윈도우 슬라이더 조작

- **Given** 사용자가 그룹 액션 테이블을 조회하고
- **When** 시간 윈도우 슬라이더를 1에서 5로 변경하면
- **Then** API가 `timeWindow=5`로 재호출되고 테이블이 갱신된다

**검증 방법:**
```typescript
// Jest 테스트
fireEvent.change(slider, { target: { value: 5 } });
await waitFor(() => {
  expect(mockApi.getGroupAction).toHaveBeenCalledWith(
    expect.stringContaining('timeWindow=5')
  );
});
```

### Scenario 4.2: RS 임계값 슬라이더 조작

- **Given** 사용자가 그룹 액션 테이블을 조회하고
- **When** RS 임계값 슬라이더를 0에서 10으로 변경하면
- **Then** API가 `rsThreshold=10`으로 재호출되고 테이블이 갱신된다

**검증 방법:**
```typescript
fireEvent.change(rsSlider, { target: { value: 10 } });
await waitFor(() => {
  expect(mockApi.getGroupAction).toHaveBeenCalledWith(
    expect.stringContaining('rsThreshold=10')
  );
});
```

### Scenario 4.3: 상태 임계값 슬라이더 조작

- **Given** 사용자가 그룹 액션 테이블을 조회하고
- **When** 상태 임계값 슬라이더를 5에서 10으로 변경하면
- **Then** API 호출 없이 테이블이 즉시 갱신된다 (클라이언트에서 재분류)

**검증 방법:**
```typescript
fireEvent.change(statusSlider, { target: { value: 10 } });
// API 호출 없이 상태 분류만 변경
expect(mockApi.getGroupAction).not.toHaveBeenCalledTimes(
  previousCallCount + 1
);
```

### Scenario 4.4: 슬라이더 범위 표시

- **Given** 사용자가 그룹 액션 테이블을 조회하고
- **When** 페이지가 로드되면
- **Then** 각 슬라이더의 현재 값과 범위가 표시된다

**검증 방법:**
```typescript
expect(getByLabelText('시간 윈도우')).toHaveAttribute('min', '1');
expect(getByLabelText('시간 윈도우')).toHaveAttribute('max', '7');
expect(getByLabelText('시간 윈도우')).toHaveValue('3');
```

---

## AC-05: 데이터베이스 인덱스 최적화

### Scenario 5.1: 인덱스 생성

- **Given** 데이터베이스가 초기화되고
- **When** 인덱스 생성 스크립트를 실행하면
- **Then** `idx_stock_first_seen` 인덱스가 생성된다

**검증 방법:**
```bash
sqlite3 backend/app.db "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_stock_first_seen';"
# 결과: idx_stock_first_seen
```

### Scenario 5.2: 성능 개선

- **Given** 인덱스가 생성되고
- **When** 그룹 액션 API를 호출하면
- **Then** 응답 시간이 기존 대비 80% 단축된다 (500ms → 100ms 목표)

**검증 방법:**
```bash
# 인덱스 적용 전
time curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15"
# 평균 응답 시간 측정

# 인덱스 적용 후
time curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15"
# 응답 시간 비교 (100ms 이하 목표)
```

---

## AC-06: API 응답 시간

### Scenario 6.1: 기본 호출 응답 시간

- **Given** 그룹 액션 API가 정상 동작하고
- **When** 기본 파라미터로 호출하면
- **Then** 500ms 이내에 응답을 반환한다

**검증 방법:**
```bash
for i in {1..10}; do
  time curl -s "http://localhost:8000/api/stocks/group-action?date=2024-01-15" > /dev/null
done
# P95 응답 시간이 500ms 이하인지 확인
```

### Scenario 6.2: 파라미터 조합 응답 시간

- **Given** 그룹 액션 API가 정상 동작하고
- **When** 모든 파라미터를 조합하여 호출하면
- **Then** 여전히 500ms 이내에 응답을 반환한다

**검증 방법:**
```bash
time curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=7&rsThreshold=10"
# 응답 시간이 500ms 이하인지 확인
```

---

## AC-07: 하위 호환성

### Scenario 7.1: 기존 API 호출

- **Given** 기존 프론트엔드 코드가 존재하고
- **When** 파라미터 없이 API를 호출하면
- **Then** SPEC-MTT-002와 동일한 결과가 반환된다

**검증 방법:**
```bash
# SPEC-MTT-002 구현 시점의 스냅샷과 비교
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15" > new_result.json
diff old_result.json new_result.json
# 차이가 없어야 함
```

### Scenario 7.2: 기존 프론트엔드 동작

- **Given** 프론트엔드 코드를 수정하지 않고
- **When** 새 백엔드 API를 배포하면
- **Then** 기존 UI가 정상 동작한다

**검증 방법:**
```bash
# 프론트엔드 빌드 후 E2E 테스트 실행
npm run build
npm run test:e2e -- --spec "group-action.spec.ts"
# 모든 테스트 통과 확인
```

### Scenario 7.3: 기존 테스트 통과

- **Given** 기존 백엔드 테스트가 존재하고
- **When** 새 파라미터를 추가한 후 테스트를 실행하면
- **Then** 모든 기존 테스트가 통과한다

**검증 방법:**
```bash
cd backend
pytest tests/test_api_group_action.py -v
# 모든 테스트 통과 확인
```

---

## AC-08: 통합 테스트

### Scenario 8.1: 파라미터 조합 E2E

- **Given** 사용자가 그룹 액션 페이지에 접속하고
- **When** 시간 윈도우=5, RS 임계값=10, 상태 임계값=8로 설정하면
- **Then** 올바른 결과가 표시되고 UI에 현재 설정값이 표시된다

**검증 방법:**
```typescript
// Playwright E2E 테스트
await page.goto('/trend?date=2024-01-15');

await page.fill('[aria-label="시간 윈도우"]', '5');
await page.fill('[aria-label="RS 임계값"]', '10');
await page.fill('[aria-label="상태 임계값"]', '8');

// API 호출 대기
await page.waitForResponse('**/api/stocks/group-action**');

// 결과 검증
const tableRows = await page.$$eval('table tbody tr', rows => rows.length);
expect(tableRows).toBeGreaterThan(0);
```

### Scenario 8.2: 로딩 상태

- **Given** 사용자가 파라미터를 변경하고
- **When** API 호출이 진행 중이면
- **Then** 로딩 인디케이터가 표시된다

**검증 방법:**
```typescript
fireEvent.change(slider, { target: { value: 5 } });
expect(getByRole('progressbar')).toBeInTheDocument();
await waitForElementToBeRemoved(() => queryByRole('progressbar'));
```

### Scenario 8.3: 에러 처리

- **Given** API 서버가 응답하지 않고
- **When** 사용자가 파라미터를 변경하면
- **Then** 에러 메시지가 표시되고 기본값 복원 버튼이 제공된다

**검증 방법:**
```typescript
mockApi.getGroupAction.mockRejectedValue(new Error('Network Error'));
fireEvent.change(slider, { target: { value: 5 } });
await waitFor(() => {
  expect(getByText('데이터를 불러오는데 실패했습니다')).toBeInTheDocument();
  expect(getByText('기본값 복원')).toBeInTheDocument();
});
```

---

## 수락 체크리스트

### 기능 요구사항
- [ ] AC-01: 시간 윈도우 파라미터 (4개 시나리오 통과)
- [ ] AC-02: RS 임계값 파라미터 (4개 시나리오 통과)
- [ ] AC-03: 상태 분류 임계값 파라미터 (3개 시나리오 통과)
- [ ] AC-04: UI 파라미터 컨트롤 (4개 시나리오 통과)

### 비기능 요구사항
- [ ] AC-05: 데이터베이스 인덱스 최적화 (2개 시나리오 통과)
- [ ] AC-06: API 응답 시간 (2개 시나리오 통과)
- [ ] AC-07: 하위 호환성 (3개 시나리오 통과)

### 통합 테스트
- [ ] AC-08: 통합 테스트 (3개 시나리오 통과)

### 품질 게이트
- [ ] 백엔드 테스트 커버리지 >= 85%
- [ ] 프론트엔드 테스트 커버리지 >= 80%
- [ ] E2E 테스트 모두 통과
- [ ] Lint 오류 0개
- [ ] TypeScript 컴파일 오류 0개
- [ ] TRUST 5 품질 게이트 통과

---

## 테스트 실행 명령

### 백엔드 테스트
```bash
cd backend
pytest tests/test_api_group_action.py -v --cov=app/routers/stocks --cov-report=term-missing
```

### 프론트엔드 테스트
```bash
cd frontend
npm test -- src/app/trend/_components/__tests__/GroupActionTable.test.tsx --coverage
```

### E2E 테스트
```bash
cd frontend
npm run test:e2e -- --spec "group-action.spec.ts"
```

### 성능 테스트
```bash
cd backend
python scripts/benchmark_group_action.py
```

---

## 추적성

| 수락 기준 | 관련 요구사항 | 테스트 파일 |
|----------|--------------|------------|
| AC-01 | F-01 | `test_api_group_action.py::test_time_window` |
| AC-02 | F-02 | `test_api_group_action.py::test_rs_threshold` |
| AC-03 | F-03 | `GroupActionTable.test.tsx::test_status_classification` |
| AC-04 | F-04 | `GroupActionTable.test.tsx::test_slider_interaction` |
| AC-05 | NFR-01 | `test_database_indexes.py` |
| AC-06 | NFR-02 | `benchmark_group_action.py` |
| AC-07 | NFR-03 | `test_backward_compatibility.py` |
| AC-08 | 전체 | `e2e/group-action.spec.ts` |
