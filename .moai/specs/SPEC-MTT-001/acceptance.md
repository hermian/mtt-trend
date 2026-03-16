# SPEC-MTT-001 인수 기준

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-001 |
| 상태 | Completed |
| 작성일 | 2026-03-11 |

---

## 인수 기준 (Acceptance Criteria)

### AC-01: MTT 파일명 자동 감지

**Given** 파일명이 `★Themes_With_7_or_More_MTT_Stocks-FullList_2026-03-11.html`인 HTML 파일이 존재할 때
**When** `detect_source_from_filename()` 함수에 해당 경로를 전달하면
**Then** 반환값은 `"mtt"` 이어야 한다

---

**Given** 파일명이 `★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-11.html`인 HTML 파일이 존재할 때
**When** `detect_source_from_filename()` 함수에 해당 경로를 전달하면
**Then** 반환값은 `"52w_high"` 이어야 한다

---

**Given** 파일명에 MTT 관련 키워드가 없는 임의의 HTML 파일이 있을 때
**When** `detect_source_from_filename()` 함수에 해당 경로를 전달하면
**Then** 반환값은 기본값 `"52w_high"` 이어야 한다

---

### AC-02: MTT HTML 파싱 정확도

**Given** MTT 형식의 HTML 테이블이 다음 구조로 존재할 때:
- 헤더: `테마명 | 테마내 종목수 | RS 평균 | 상위 7종목 | 등락률 합계`
- 데이터 행: 테마명과 `삼성전자(98/+3.5%),SK하이닉스(85/+2.1%)` 형식의 종목 셀

**When** `_try_mtt_layout()` 함수로 파싱하면
**Then**:
- 테마명이 올바르게 추출되어야 한다
- 각 종목의 `stock_name`, `rs_score`, `change_pct`가 정확히 파싱되어야 한다
- RS 점수는 정수, 등락률은 부호 포함 소수로 반환되어야 한다

---

**Given** MTT 종목 셀에 `삼성전자(98/+3.5%),SK하이닉스(85/-2.1%)` 텍스트가 있을 때
**When** `_parse_mtt_stock_tag()` 함수로 파싱하면
**Then**:
- 2개의 종목 항목이 반환되어야 한다
- 첫 번째: `{"stock_name": "삼성전자", "rs_score": 98, "change_pct": 3.5}`
- 두 번째: `{"stock_name": "SK하이닉스", "rs_score": 85, "change_pct": -2.1}`

---

### AC-03: 데이터베이스 소스 격리

**Given** `52w_high` 소스의 데이터 10건과 `mtt` 소스의 데이터 8건이 동일 날짜로 DB에 저장되어 있을 때
**When** `GET /api/themes/daily?date=2026-03-11&source=52w_high`를 호출하면
**Then** 응답에는 `52w_high` 소스의 테마 10건만 포함되어야 한다 (mtt 데이터 포함 없음)

---

**Given** `mtt` 소스의 데이터가 DB에 저장되어 있을 때
**When** `GET /api/themes/daily?date=2026-03-11&source=mtt`를 호출하면
**Then** 응답에는 `mtt` 소스의 테마만 포함되어야 한다

---

### AC-04: 자동 마이그레이션

**Given** `data_source` 컬럼이 없는 레거시 SQLite DB가 존재할 때
**When** 애플리케이션을 시작하여 `create_tables()`가 실행되면
**Then**:
- `theme_daily` 테이블에 `data_source TEXT NOT NULL DEFAULT '52w_high'` 컬럼이 생성되어야 한다
- `theme_stock_daily` 테이블에 동일 컬럼이 생성되어야 한다
- 기존 레코드의 `data_source` 값은 `52w_high`로 채워져야 한다
- 애플리케이션이 오류 없이 정상 시작되어야 한다

---

**Given** 이미 `data_source` 컬럼이 있는 DB가 존재할 때
**When** 애플리케이션을 재시작하여 `create_tables()`가 재실행되면
**Then** 오류 없이 정상 시작되어야 한다 (멱등성)

---

### AC-05: API 기본값 하위 호환성

**Given** 기존 방식으로 `source` 파라미터 없이 API를 호출할 때
**When** `GET /api/themes/daily?date=2026-03-11`를 호출하면
**Then** `52w_high` 소스의 데이터가 반환되어야 한다 (기존 동작 유지)

---

**Given** `source` 파라미터 없이 날짜 목록을 요청할 때
**When** `GET /api/dates`를 호출하면
**Then** `52w_high` 소스의 날짜 목록이 반환되어야 한다

---

### AC-06: 프론트엔드 소스 전환 동작

**Given** 사용자가 대시보드를 열었을 때
**When** 페이지 헤더의 "MTT 종목" 버튼을 클릭하면
**Then**:
- 날짜 선택기가 MTT 소스의 날짜 목록으로 교체되어야 한다
- 가장 최신 MTT 날짜가 자동으로 선택되어야 한다
- 모든 차트 및 테이블이 MTT 데이터로 갱신되어야 한다
- "MTT 종목" 버튼이 활성화 상태(파란색)로 표시되어야 한다

---

**Given** 사용자가 "MTT 종목" 소스를 보고 있을 때
**When** "52주 신고가" 버튼을 클릭하면
**Then**:
- 날짜 선택기가 52w_high 날짜 목록으로 교체되어야 한다
- 차트 및 테이블이 52w_high 데이터로 갱신되어야 한다

---

### AC-07: 인제스트 파이프라인 통합

**Given** MTT HTML 파일이 `backend/data/` 디렉토리에 위치할 때
**When** `python scripts/ingest.py` 또는 `python scripts/ingest.py <파일경로>`를 실행하면
**Then**:
- 파일 소스가 자동으로 `mtt`로 감지되어야 한다
- 파싱된 데이터가 `data_source = 'mtt'`로 DB에 저장되어야 한다
- 기존 52w_high 데이터가 영향받지 않아야 한다
- 로그에 소스 감지 결과가 출력되어야 한다

---

## 정의 완료 기준 (Definition of Done)

- [x] `detect_source_from_filename()` 함수가 MTT 파일명을 정확히 감지함
- [x] `_try_mtt_layout()` 파서가 MTT HTML 구조에서 종목 데이터를 정확히 추출함
- [x] `data_source` 컬럼이 `theme_daily`, `theme_stock_daily` 양쪽 테이블에 존재함
- [x] 레거시 DB에서 마이그레이션이 멱등하게 실행됨
- [x] 모든 API 엔드포인트가 `?source=` 파라미터를 수용함
- [x] `source` 파라미터 기본값이 `52w_high`로 설정되어 기존 API 호환성 유지
- [x] 프론트엔드 소스 토글 버튼이 `trend/page.tsx`에 구현됨
- [x] 소스 전환 시 날짜 초기화 및 자동 재선택 동작
- [x] 모든 하위 컴포넌트에 `source` prop이 전달되고 API 호출에 포함됨

---

## 테스트 시나리오

### 수동 검증 절차

1. **MTT 파일 인제스트 테스트**
   - MTT HTML 파일을 `backend/data/`에 배치
   - `python scripts/ingest.py` 실행
   - DB에서 `SELECT * FROM theme_daily WHERE data_source = 'mtt'` 확인

2. **API 소스 필터 테스트**
   - `curl http://localhost:8000/api/dates?source=mtt`
   - `curl http://localhost:8000/api/themes/daily?source=mtt`
   - `curl http://localhost:8000/api/dates` (파라미터 없음 → 52w_high)

3. **프론트엔드 전환 테스트**
   - 브라우저에서 대시보드 접속
   - "MTT 종목" 버튼 클릭 → 데이터 변경 확인
   - "52주 신고가" 버튼 클릭 → 원래 데이터 복원 확인

4. **마이그레이션 멱등성 테스트**
   - 서버 재시작 반복 실행 → 오류 없음 확인
