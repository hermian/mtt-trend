# SPEC-MTT-001: MTT 데이터 소스 지원

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-001 |
| 제목 | MTT 데이터 소스 지원 (Multi Data Source Support) |
| 상태 | IMPLEMENTED (소급 SPEC) |
| 작성일 | 2026-03-11 |
| 구현 완료일 | 2026-03-11 |

---

## 문제 정의

### 배경

기존 대시보드는 **52주 신고가(52w_high)** HTML 리포트 단일 소스만 지원했다. 파일 패턴은 `★52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html`이며, 테마별 52주 신고가 종목의 RS 점수를 분석하는 데이터였다.

### 요구사항 발생 배경

Mark Minervini Template(MTT) 기준을 충족하는 종목 분석 리포트가 별도로 생성되기 시작했다. MTT는 52주 신고가와는 다른 필터링 기준을 적용하며, 테마 내 7개 이상의 MTT 기준 종목이 있는 테마만 포함한다. 두 데이터 소스는 서로 보완적인 시각을 제공하므로, 동일한 대시보드에서 전환하여 분석할 수 있어야 한다.

### 해결해야 할 핵심 문제

1. **파일 형식 차이**: MTT 리포트는 52주 신고가 리포트와 HTML 구조가 다르다. 종목 정보가 `종목명(RS/등락률%)` 형식으로 단일 셀에 결합되어 있다.
2. **데이터 혼재 방지**: 기존 52w_high 데이터와 MTT 데이터를 동일 테이블에 저장하면서도 소스별로 독립적으로 조회해야 한다.
3. **하위 호환성**: 기존에 저장된 52w_high 데이터에 영향을 주지 않고 신규 컬럼을 추가해야 한다.
4. **UI 전환**: 사용자가 두 데이터 소스를 편리하게 전환할 수 있어야 한다.

---

## 요구사항 (EARS 형식)

### R-01: 파일 자동 감지

WHEN 인제스트 스크립트에 HTML 파일이 입력되면 THE SYSTEM SHALL 파일명 패턴을 분석하여 데이터 소스(`52w_high` 또는 `mtt`)를 자동으로 결정해야 한다.

- MTT 파일 감지 조건: 파일명에 `Themes_With` 및 `MTT` 문자열 포함 (대소문자 무시)
- 감지 실패 시: 기본값 `52w_high` 적용

### R-02: MTT HTML 파싱

WHEN 데이터 소스가 `mtt`로 감지된 HTML 파일을 파싱할 때 THE SYSTEM SHALL MTT 전용 파서(`_try_mtt_layout`)를 우선 적용해야 한다.

- MTT 테이블 헤더 감지: `테마명`, `RS 평균`, `상위` 키워드 포함 여부 확인
- 종목 셀 파싱: `종목명(RS점수/등락률%)` 형식의 정규식 패턴 적용
- stock-tag CSS 클래스 지원: HTML에 `class="stock-tag"` 요소가 있을 경우 우선 파싱

### R-03: 데이터베이스 소스 구분 저장

WHEN 파싱된 데이터를 DB에 저장할 때 THE SYSTEM SHALL `data_source` 컬럼에 소스 값을 함께 저장해야 한다.

- `theme_daily` 테이블: `data_source` 컬럼 포함
- `theme_stock_daily` 테이블: `data_source` 컬럼 포함
- 유니크 제약 조건: `(date, theme_name, data_source)` 조합으로 중복 방지

### R-04: 기존 DB 자동 마이그레이션

WHEN 애플리케이션이 시작될 때 THE SYSTEM SHALL `data_source` 컬럼이 없는 기존 DB를 자동으로 마이그레이션해야 한다.

- 마이그레이션 방식: `ALTER TABLE ... ADD COLUMN data_source TEXT NOT NULL DEFAULT '52w_high'`
- 이미 컬럼이 존재하는 경우: 예외 무시하고 정상 진행

### R-05: API 소스 파라미터

WHEN 클라이언트가 API를 호출할 때 THE SYSTEM SHALL `?source=52w_high|mtt` 쿼리 파라미터를 지원해야 한다.

적용 엔드포인트:
- `GET /api/dates?source=`
- `GET /api/themes/daily?source=`
- `GET /api/themes/surging?source=`
- `GET /api/themes/{name}/history?source=`
- `GET /api/stocks/persistent?source=`
- `GET /api/stocks/group-action?source=`

기본값: `source` 파라미터 생략 시 `52w_high` 적용

### R-06: 소스별 날짜 목록 분리

WHEN 클라이언트가 `/api/dates`를 호출할 때 THE SYSTEM SHALL 요청한 소스에 해당하는 날짜 목록만 반환해야 한다.

- 52w_high 날짜와 mtt 날짜는 서로 독립적으로 관리

### R-07: 프론트엔드 소스 토글 UI

WHEN 사용자가 대시보드를 사용할 때 THE SYSTEM SHALL "52주 신고가" / "MTT 종목" 토글 버튼을 제공해야 한다.

- 소스 전환 시: 날짜 선택 상태 초기화 및 최신 날짜 자동 선택
- 토글 UI: 페이지 헤더 우측에 세그먼트 버튼 형태로 배치

### R-08: 컴포넌트 소스 전파

WHEN 사용자가 소스를 전환할 때 THE SYSTEM SHALL 선택된 소스 값을 모든 하위 컴포넌트 및 API 호출에 전파해야 한다.

- `TopThemesBar`, `ThemeTrendChart`, `StockAnalysisTabs` 등 모든 차트 컴포넌트에 `source` prop 전달
- 각 컴포넌트는 `source` 값을 API 호출 시 포함

### R-09: 하위 호환성 보장

IF `data_source` 컬럼이 없는 기존 DB가 존재하더라도 THE SYSTEM SHALL 기존 52w_high 데이터를 손상 없이 유지하고 정상 조회해야 한다.

- 기존 레코드의 `data_source` 기본값: `52w_high`
- 소스 필터 없는 기존 쿼리는 모두 소스 필터 포함으로 리팩터링

---

## 기술 설계

### DB 스키마 변경

#### theme_daily 테이블

```sql
-- 신규 컬럼
data_source TEXT NOT NULL DEFAULT '52w_high'

-- 유니크 제약 조건 변경
-- 기존: UNIQUE(date, theme_name)
-- 변경: UNIQUE(date, theme_name, data_source)
CONSTRAINT uq_theme_daily_date_name_src UNIQUE (date, theme_name, data_source)

-- 신규 인덱스
CREATE INDEX idx_td_source ON theme_daily(data_source);
```

#### theme_stock_daily 테이블

```sql
-- 신규 컬럼
data_source TEXT NOT NULL DEFAULT '52w_high'

-- 신규 인덱스
CREATE INDEX idx_tsd_source ON theme_stock_daily(data_source);
```

### 파일명 감지 로직

```python
_MTT_FILENAME_RE = re.compile(r"Themes_With.*MTT", re.IGNORECASE)

def detect_source_from_filename(path: Path) -> str:
    if _MTT_FILENAME_RE.search(path.name):
        return SOURCE_MTT  # "mtt"
    return SOURCE_52W      # "52w_high"
```

감지 대상 파일명 예시:
- `★Themes_With_7_or_More_MTT_Stocks-Top7_2026-03-11.html` → `mtt`
- `★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-11.html` → `52w_high`

### MTT 파서 전략

MTT HTML 구조:

```
테마명 | 테마내 종목수 | RS 평균 | 상위 7종목 (RS 점수) | 등락률 합계 | 거래대금 합계
```

종목 셀 내 데이터 형식:

```
삼성전자(98/+3.5%),SK하이닉스(85/+2.1%),현대차(76/-0.8%)
```

파싱 정규식:

```python
_MTT_STOCK_RE = re.compile(
    r"([가-힣A-Za-z0-9\s\.\-\&]+?)"   # 종목명
    r"\((\d{1,3})"                      # RS 점수
    r"/([+\-]?\d+(?:\.\d+)?)%\)"        # 등락률
)
```

파서 우선순위 (MTT 소스):
1. `_try_mtt_layout` (MTT 전용)
2. `_try_flat_table_layout` (폴백)
3. `_try_table_layout` (폴백)
4. `_try_heading_layout` (폴백)

### API 파라미터 설계

모든 엔드포인트에 공통 파라미터 추가:

```python
source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'")
```

TypeScript 타입:

```typescript
export type DataSource = "52w_high" | "mtt";
```

---

## 구현 노트

### 수정된 주요 파일

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/models.py` | `ThemeDaily`, `ThemeStockDaily`에 `data_source` 컬럼 추가, 상수 `SOURCE_52W`, `SOURCE_MTT` 정의 |
| `backend/app/database.py` | `create_tables()`에 자동 마이그레이션 로직 추가 (ALTER TABLE) |
| `backend/scripts/ingest.py` | `detect_source_from_filename()`, `_try_mtt_layout()`, `_parse_mtt_stock_tag()` 신규 추가; `parse_html()`에 소스별 파서 전략 분기 |
| `backend/app/routers/themes.py` | 모든 엔드포인트에 `source` 쿼리 파라미터 추가 |
| `backend/app/routers/stocks.py` | 모든 엔드포인트에 `source` 쿼리 파라미터 추가 |
| `backend/app/main.py` | `/api/dates` 엔드포인트에 `source` 파라미터 추가 |
| `frontend/src/lib/api.ts` | `DataSource` 타입 추가, 모든 API 함수에 `source` 파라미터 추가 |
| `frontend/src/app/trend/page.tsx` | 소스 상태 관리, 소스 토글 버튼 UI 추가 |
| `frontend/src/app/trend/_components/*` | 모든 컴포넌트에 `source` prop 추가 및 전파 |

### 하위 호환성 처리

1. **기존 DB 보호**: `ALTER TABLE ... ADD COLUMN` 실행 시 이미 컬럼이 있으면 예외를 무시 (`try/except pass`)
2. **기본값 설정**: 기존 레코드에 `52w_high`가 자동으로 채워짐
3. **API 기본값**: `source` 파라미터 생략 시 `52w_high` 반환 — 기존 클라이언트 동작 불변
4. **유니크 제약 조건 확장**: `(date, theme_name)` → `(date, theme_name, data_source)`로 확장하여 동일 날짜/테마의 두 소스 데이터 공존 가능

### 자동 마이그레이션 방식

별도 마이그레이션 도구(Alembic 등) 없이 애플리케이션 시작 시 `create_tables()` 내에서 처리:

```python
for table, col, default in [
    ("theme_daily", "data_source", "52w_high"),
    ("theme_stock_daily", "data_source", "52w_high"),
]:
    try:
        conn.execute(text(
            f"ALTER TABLE {table} ADD COLUMN data_source TEXT NOT NULL DEFAULT '{default}'"
        ))
    except Exception:
        pass  # 이미 존재하는 경우 무시
```

**선택 이유**: 소규모 프로젝트에서 Alembic 의존성 없이 단순하게 관리. 컬럼 존재 여부만 체크하므로 멱등성 보장.

---

## 범위 외 (Out of Scope)

다음 기능은 이번 구현에 포함되지 않았다:

1. **소스 목록 API**: `/api/sources` 엔드포인트 (지원 소스 목록 동적 조회) — 현재는 `52w_high`와 `mtt`로 하드코딩
2. **커스텀 소스 추가 UI**: 사용자가 직접 새로운 데이터 소스를 등록하는 기능
3. **소스 간 비교 뷰**: 두 소스의 데이터를 나란히 비교하는 차트나 테이블
4. **소스별 데이터 삭제**: 특정 소스의 데이터만 선택적으로 삭제하는 API
5. **Alembic 마이그레이션**: 정식 DB 마이그레이션 도구 도입 (현재 인라인 ALTER TABLE로 처리)
6. **소스 유효성 검증**: API 레이어에서 허용되지 않은 source 값 입력 시 422 에러 반환 (현재 미검증)
