# SPEC-MTT-002: 인수 기준 (Acceptance Criteria)

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-002 |
| 제목 | 데이터 파이프라인 완성 및 트렌드 대시보드 MVP |

---

## AC-01: 데이터 수집 (F-01)

### AC-01-1: 전체 파일 일괄 수집 성공

```gherkin
Given backend/data/ 디렉토리에 77개 HTML 파일이 존재하고
  And SQLite DB가 초기화된 상태에서
When python scripts/ingest.py --dir backend/data/ 를 실행하면
Then 처리 완료 메시지에 "총 처리: 77개" 가 포함되어야 하고
 And theme_daily 테이블에 1개 이상의 레코드가 존재해야 하고
 And data_source = '52w_high' 인 레코드와 data_source = 'mtt' 인 레코드가 각각 존재해야 한다
```

### AC-01-2: 중복 재수집 시 오류 없음

```gherkin
Given 이미 2026-03-13 날짜의 52w_high 데이터가 수집된 상태에서
When 동일 파일을 포함한 디렉토리로 ingest.py를 재실행하면
Then 오류(Exception) 없이 정상 종료되어야 하고
 And theme_daily 테이블의 총 레코드 수가 이전과 동일하거나 더 많아야 한다
```

### AC-01-3: 파싱 실패 파일 건너뛰기

```gherkin
Given backend/data/ 디렉토리에 파싱 불가능한 HTML 파일 1개가 추가된 상태에서
When python scripts/ingest.py --dir backend/data/ 를 실행하면
Then 해당 파일 오류가 stderr 또는 콘솔에 경고로 출력되어야 하고
 And 나머지 파일의 수집은 정상 완료되어야 하고
 And 최종 요약에 "실패: 1개" 가 표시되어야 한다
```

### AC-01-4: 수집 결과 요약 출력

```gherkin
Given backend/data/ 에 정상 HTML 파일이 있는 상태에서
When 일괄 수집이 완료되면
Then 콘솔에 "성공: N개", "실패: M개" 형태의 요약이 출력되어야 한다
```

---

## AC-02: 날짜 목록 API (F-02)

### AC-02-1: 소스별 날짜 목록 반환

```gherkin
Given theme_daily 테이블에 52w_high 소스의 2026-03-13, 2026-03-12 데이터와
      mtt 소스의 2026-03-11 데이터가 존재하는 상태에서
When GET /api/dates?source=52w_high 를 호출하면
Then 응답 상태가 200 OK 여야 하고
 And 응답 body가 { "dates": ["2026-03-13", "2026-03-12"] } 형태여야 하고
 And 날짜가 내림차순(최신순)으로 정렬되어야 한다
When GET /api/dates?source=mtt 를 호출하면
Then 응답에 "2026-03-11" 만 포함되어야 한다
```

### AC-02-2: source 파라미터 기본값

```gherkin
Given theme_daily 테이블에 52w_high 소스 데이터가 존재하는 상태에서
When GET /api/dates (source 파라미터 없이) 를 호출하면
Then 응답 상태가 200 OK 여야 하고
 And 52w_high 소스의 날짜 목록이 반환되어야 한다
```

### AC-02-3: 빈 데이터 처리

```gherkin
Given theme_daily 테이블에 mtt 소스 데이터가 전혀 없는 상태에서
When GET /api/dates?source=mtt 를 호출하면
Then 응답 상태가 200 OK 여야 하고
 And 응답 body가 { "dates": [] } 여야 한다
```

### AC-02-4: 프론트엔드 날짜 자동 선택

```gherkin
Given 트렌드 대시보드 페이지가 마운트되는 상태에서
When 페이지가 처음 로드되면
Then GET /api/dates?source=52w_high 가 호출되어야 하고
 And 반환된 dates 배열의 첫 번째 항목(최신 날짜)이 자동으로 선택되어야 한다
```

---

## AC-03: 테마 트렌드 화면 (F-03)

### AC-03-1: 일별 상위 테마 바차트 렌더링

```gherkin
Given theme_daily 테이블에 2026-03-13 날짜, 52w_high 소스의 테마 데이터가 존재하고
  And 사용자가 트렌드 대시보드를 열었을 때
When 날짜 선택기에서 "2026-03-13" 을 선택하면
Then GET /api/themes/daily?date=2026-03-13&source=52w_high 가 호출되어야 하고
 And TopThemesBar 컴포넌트가 테마 목록을 바차트로 렌더링해야 하고
 And 차트 항목이 종목수 기준 내림차순으로 정렬되어야 하고
 And 최대 20개 테마가 표시되어야 한다
```

### AC-03-2: 데이터 없는 날짜 처리

```gherkin
Given 특정 날짜의 테마 데이터가 존재하지 않는 상태에서
When 해당 날짜를 선택하면
Then TopThemesBar 자리에 "데이터가 없습니다" 메시지가 표시되어야 한다
```

### AC-03-3: 테마 클릭 시 히스토리 차트 업데이트

```gherkin
Given TopThemesBar에 테마 목록이 표시된 상태에서
When 사용자가 특정 테마 바를 클릭하면
Then GET /api/themes/{테마명}/history?source=52w_high 가 호출되어야 하고
 And ThemeTrendChart 컴포넌트가 해당 테마의 날짜별 종목수 추이를 라인 차트로 표시해야 한다
```

---

## AC-04: 급등 테마 화면 (F-04)

### AC-04-1: 급등 테마 목록 조회

```gherkin
Given theme_daily 테이블에 여러 날짜의 테마 데이터가 존재하고
  And threshold 기본값이 10인 상태에서
When 사용자가 급등 테마 탭을 선택하면
Then GET /api/themes/surging?source=52w_high&threshold=10 이 호출되어야 하고
 And 증가율이 10% 이상인 테마 목록이 테이블로 표시되어야 하고
 And 증가율 내림차순으로 정렬되어야 한다
```

### AC-04-2: Threshold 변경 시 목록 갱신

```gherkin
Given 급등 테마 탭이 선택된 상태에서
When 사용자가 threshold 값을 20으로 변경하면
Then GET /api/themes/surging?source=52w_high&threshold=20 이 즉시 호출되어야 하고
 And 20% 이상 증가한 테마만 표시되어야 한다
```

---

## AC-05: 지속 강세 종목 화면 (F-05)

### AC-05-1: 지속 강세 종목 테이블 표시

```gherkin
Given theme_stock_daily 테이블에 여러 날짜에 걸쳐 등장하는 종목 데이터가 있고
  And 사용자가 지속 강세 종목 탭을 선택하면
When 컴포넌트가 마운트되면
Then GET /api/stocks/persistent?source=52w_high 가 호출되어야 하고
 And StrongStocksTable에 종목명, 등장 횟수, 마지막 등장 날짜가 표시되어야 하고
 And 등장 횟수 내림차순으로 정렬되어야 한다
```

### AC-05-2: 그룹 동시 행동 테이블 표시

```gherkin
When 사용자가 그룹 동시 행동 탭을 선택하면
Then GET /api/stocks/group-action?source=52w_high 가 호출되어야 하고
 And GroupActionTable 컴포넌트에 결과가 표시되어야 한다
```

---

## AC-06: 공통 UX 요구사항 (F-06)

### AC-06-1: 로딩 상태 표시

```gherkin
Given API 호출이 진행 중인 상태에서
When 네트워크 응답 대기 중이면
Then 해당 컴포넌트 영역에 스피너 또는 스켈레톤 UI가 표시되어야 한다
```

### AC-06-2: API 에러 처리

```gherkin
Given 백엔드 서버가 응답 불가한 상태에서
When API 호출이 실패하면
Then 사용자에게 에러 메시지가 표시되어야 하고
 And 재시도 버튼이 표시되어야 하고
 And 재시도 버튼 클릭 시 API를 다시 호출해야 한다
```

### AC-06-3: 소스 전환 시 데이터 초기화

```gherkin
Given 사용자가 52w_high 소스의 2026-03-13 날짜를 선택한 상태에서
When 소스를 mtt 로 전환하면
Then GET /api/dates?source=mtt 가 호출되어야 하고
 And 날짜 선택이 mtt 소스의 최신 날짜로 초기화되어야 하고
 And 모든 차트가 mtt 소스 데이터로 갱신되어야 한다
```

### AC-06-4: API 응답 시간

```gherkin
Given DB에 충분한 데이터가 수집된 상태에서
When 임의의 API 엔드포인트를 호출하면
Then 응답 시간이 2000ms 이하여야 한다
```

---

## 완료 기준 (Definition of Done)

### 필수 조건 (Must Have)

- [ ] `backend/data/` 의 77개 HTML 파일 전량이 DB에 수집됨
- [ ] `theme_daily` 테이블에 `52w_high` 및 `mtt` 소스 데이터 모두 존재
- [ ] `GET /api/dates` — 소스별 날짜 목록 정상 반환 (200 OK)
- [ ] `GET /api/themes/daily` — 날짜·소스별 테마 목록 정상 반환
- [ ] `GET /api/themes/surging` — 급등 테마 목록 정상 반환
- [ ] `GET /api/themes/{name}/history` — 테마 히스토리 정상 반환
- [ ] `GET /api/stocks/persistent` — 지속 강세 종목 정상 반환
- [ ] `GET /api/stocks/group-action` — 그룹 동시 행동 정상 반환
- [ ] 브라우저에서 날짜 선택 시 TopThemesBar에 실제 데이터 렌더링
- [ ] 소스 전환(52w_high ↔ mtt) 시 데이터 정상 갱신
- [ ] 로딩/에러 상태 UI 표시

### 선택 조건 (Nice to Have)

- [ ] Threshold 슬라이더 UI 구현
- [ ] 테마 클릭 → ThemeTrendChart 연동 확인
- [ ] API 응답 시간 2초 이내 확인

---

## 수동 검증 시나리오 (Manual Verification Scenarios)

### 시나리오 1: 전체 MVP 플로우

1. `python backend/scripts/ingest.py --dir backend/data/` 실행
2. 콘솔에 수집 완료 요약 확인
3. `uvicorn app.main:app --reload` 실행
4. `http://localhost:8000/docs` 에서 API 확인
5. `npm run dev` 실행
6. `http://localhost:3000/trend` 접속
7. 소스 "52주 신고가" 선택 → 날짜 자동 선택 확인
8. TopThemesBar에 테마 바차트 렌더링 확인
9. 소스 "MTT 종목" 전환 → 날짜 초기화 및 차트 갱신 확인

### 시나리오 2: 에러 복구 플로우

1. 백엔드 서버 중지
2. 프론트엔드에서 데이터 로딩 시도
3. 에러 메시지와 재시도 버튼 표시 확인
4. 백엔드 서버 재시작
5. 재시도 버튼 클릭 → 정상 데이터 로딩 확인
