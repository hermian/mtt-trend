# SPEC-MTT-012: Acceptance Criteria

**TAG**: SPEC-MTT-012
**Parent SPEC**: spec.md
**Status**: Completed

---

## Acceptance Criteria

### AC-012-01: 교집합 API 정상 응답

**Given** DB에 2026-03-14 날짜로 `52w_high`와 `mtt` 양쪽에 "반도체" 테마가 존재한다
**And** "반도체" 테마 내 "삼성전자" 종목이 양쪽 소스에 모두 존재한다
**When** `GET /api/intersection?date=2026-03-14`를 호출한다
**Then** 응답 status code가 200이다
**And** 응답 `themes` 배열에 "반도체" 테마가 포함된다
**And** "반도체" 테마의 `intersection_stocks`에 "삼성전자"가 포함된다
**And** `intersection_stock_count`가 1 이상이다

### AC-012-02: 교집합 없는 경우 빈 결과 반환

**Given** DB에 2026-03-14 날짜로 `52w_high`에는 "반도체" 테마가 있지만 `mtt`에는 없다
**When** `GET /api/intersection?date=2026-03-14`를 호출한다
**Then** 응답 status code가 200이다
**And** 응답의 `themes` 배열이 비어 있다
**And** `theme_count`가 0이다

### AC-012-03: 날짜 미지정 시 최신 날짜 자동 선택

**Given** DB에 여러 날짜의 데이터가 존재한다
**And** 두 소스 모두 데이터가 있는 가장 최근 날짜가 2026-03-14이다
**When** `GET /api/intersection` (date 파라미터 없이)을 호출한다
**Then** 응답의 `date` 필드가 "2026-03-14"이다
**And** 해당 날짜 기준으로 교집합 결과를 반환한다

### AC-012-04: 교집합 랭킹 정렬

**Given** 교집합 결과에 "반도체" (교집합 종목 3개)와 "2차전지" (교집합 종목 1개) 테마가 있다
**When** `GET /api/intersection` API를 호출한다
**Then** 응답 `themes` 배열에서 "반도체"가 "2차전지"보다 앞에 위치한다

### AC-012-05: 교집합 탭 UI 렌더링

**Given** 대시보드의 `StockAnalysisTabs` 컴포넌트가 렌더링된다
**When** 사용자가 "교집합 추천" 탭을 클릭한다
**Then** `IntersectionTab` 컴포넌트가 화면에 표시된다
**And** 교집합 테마 목록과 종목 정보가 표시된다
**And** 각 테마에 교집합 종목 수, avg RS (52w) 정보가 표시된다

### AC-012-06: 빈 결과 UI 안내 메시지

**Given** 선택된 날짜에 교집합 결과가 없다
**When** 교집합 탭이 표시된다
**Then** "교집합 데이터가 없습니다" 또는 유사한 안내 메시지가 표시된다
**And** 에러 상태가 아닌 정상 렌더링 상태이다

### AC-012-07: 로딩 및 에러 상태 처리

**Given** 교집합 탭이 활성화되어 있다
**When** API 호출이 진행 중이다
**Then** 로딩 인디케이터가 표시된다

**Given** 교집합 탭이 활성화되어 있다
**When** API 호출이 실패한다
**Then** 에러 메시지가 표시된다
**And** 앱이 크래시되지 않는다

---

## Test Scenarios

### Test Case 1: 교집합 API 정확성 검증

```python
def test_intersection_returns_common_themes(client, test_db_session):
    """
    Given: 두 소스에 공통 테마/종목 데이터 삽입
    When: GET /api/intersection?date=2026-03-14
    Then: 공통 테마/종목만 반환됨
    """
    # Setup: 52w_high 및 mtt 소스에 테마/종목 삽입
    # Action: client.get("/api/intersection?date=2026-03-14")
    # Assert: 공통 테마 포함, 단독 소스 테마 미포함
```

### Test Case 2: 최신 날짜 자동 선택

```python
def test_intersection_uses_latest_common_date(client, test_db_session):
    """
    Given: 여러 날짜에 두 소스 데이터 존재
    When: GET /api/intersection (date 없음)
    Then: 두 소스 모두 있는 최신 날짜 사용
    """
    # Setup: 2026-03-13 (52w만), 2026-03-14 (양쪽) 데이터 삽입
    # Action: client.get("/api/intersection")
    # Assert: response["date"] == "2026-03-14"
```

### Test Case 3: 랭킹 정렬 검증

```python
def test_intersection_sorted_by_stock_count(client, test_db_session):
    """
    Given: 교집합 종목 수가 다른 여러 테마
    When: GET /api/intersection
    Then: 교집합 종목 수 내림차순으로 정렬됨
    """
    # Setup: 테마 A (3개), 테마 B (1개), 테마 C (5개) 삽입
    # Action: client.get("/api/intersection?date=...")
    # Assert: themes[0].theme_name == "테마C", themes[1].theme_name == "테마A"
```

### Test Case 4: 빈 교집합 처리

```python
def test_intersection_empty_when_no_common_data(client, test_db_session):
    """
    Given: 두 소스에 공통 테마 없음
    When: GET /api/intersection?date=...
    Then: 빈 themes 배열, theme_count=0 반환
    """
    # Setup: 52w_high에만 테마 삽입
    # Action: client.get("/api/intersection?date=...")
    # Assert: response["themes"] == [], response["theme_count"] == 0
```

### Test Case 5: 응답 스키마 검증

```python
def test_intersection_response_schema(client, test_db_session):
    """
    Given: 교집합 데이터 존재
    When: GET /api/intersection
    Then: 응답이 IntersectionResponse 스키마를 준수함
    """
    # Assert: date, theme_count, total_stock_count, themes 필드 존재
    # Assert: themes[0] 에 theme_name, intersection_stock_count, avg_rs_52w 존재
    # Assert: themes[0].intersection_stocks[0] 에 stock_name, rs_score_52w 존재
```

---

## Quality Gates

### Coverage Requirements

- Line Coverage: >= 85% for new backend code
- Branch Coverage: >= 80% for intersection query logic

### Linting

- ruff: No errors
- mypy: No type errors for new schemas and endpoint
- TypeScript: No type errors in new frontend files

### Performance

- `GET /api/intersection` 응답 시간: 500ms 이내 (SQLite 기준)
- 프론트엔드 탭 전환 시 로딩: 1초 이내

---

## Verification Checklist

- [x] AC-012-01: 교집합 API 정상 응답 확인
- [x] AC-012-02: 빈 교집합 시 200 + 빈 배열 반환 확인
- [x] AC-012-03: 날짜 미지정 시 최신 날짜 자동 선택 확인
- [x] AC-012-04: 교집합 종목 수 기준 정렬 확인
- [x] AC-012-05: "교집합 추천" 탭 UI 렌더링 확인
- [x] AC-012-06: 빈 결과 안내 메시지 표시 확인
- [x] AC-012-07: 로딩/에러 상태 처리 확인
- [x] 기존 탭("지속 강세 종목", "그룹 액션 탐지") 회귀 없음 확인
- [x] Backend 단위 테스트 11개 통과 (5개 이상 충족)
- [x] 커버리지 >= 85%
