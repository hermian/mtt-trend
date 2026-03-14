# 데이터 수집 가이드

## 개요

이 가이드는 52-Week High Theme Trend Dashboard의 데이터 수집 프로세스를 설명합니다. HTML 파일로부터 테마별 주식 데이터를 추출하여 SQLite 데이터베이스로 저장합니다.

## 지원되는 데이터 소스

### 1. 52-Week High 데이터 (52w_high)

**파일 패턴**: `★52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html`

**특징**:
- 52주 신고가 달성 종목
- 테마별 분류
- RS(상대강도) 점수 포함
- 변화율 정보 포함

### 2. MTT 템플릿 데이터 (mtt)

**파일 패턴**: `★Themes_With_7_or_More_MTT_Stocks-Top7_YYYY-MM-DD.html`

**특징**:
- MTT(Market Trend Template) 기반 테마
- 7개 이상 종목 포함 테마
- 상위 7개 테마 데이터

## 데이터 수집 방법

### 1. 단일 파일 처리

특정 HTML 파일 하나를 처리합니다.

```bash
cd backend

# 특정 날짜의 데이터 처리
python scripts/ingest.py data/★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html
```

### 2. 배치 처리

디렉토리 내의 모든 HTML 파일을 일괄 처리합니다.

```bash
cd backend

# data 디렉토리 내 모든 HTML 파일 처리
python scripts/ingest.py ../data/

# 특정 소스의 파일만 처리
python scripts/ingest.py ../data/ --source 52w_high
```

### 3. 특정 소스로 처리

데이터 소스를 명시적으로 지정합니다.

```bash
# MTT 데이터만 처리
python scripts/ingest.py ../data/ --source mtt

# 52주 신고가 데이터만 처리
python scripts/ingest.py ../data/ --source 52w_high
```

## 파일 형식 요구사항

### HTML 파일 구조

성공적인 파싱을 위해 HTML 파일은 다음과 같은 구조를 따르는 것이 좋습니다:

```html
<h1>52-Week High Stocks By Theme</h1>
<h2>테마 이름 1</h2>
<table>
  <tr>
    <th>종목명</th>
    <th>RS 점수</th>
    <th>변화율</th>
  </tr>
  <tr>
    <td>삼성전자</td>
    <td>85.5</td>
    <td>2.3%</td>
  </tr>
</table>

<h2>테마 이름 2</h2>
<!-- ... -->
```

### 지원되는 형식

**테마 식별**:
- `<h1>`-`<h4>` 태그
- `<th>` 태그 (bold/large 텍스트)
- `<td>` 태그 (구조화된 데이터)

**종목 데이터**:
- 종목명: 텍스트 노드
- RS 점수: 숫자 값
- 변화율: 숫자 + % 기호

**날짜 추출**:
- 파일명에서 `YYYY-MM-DD` 패턴으로 추출
- 예: `★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html`

## 데이터 처리 과정

### 1. 파싱 단계

HTML 파일을 BeautifulSoup으로 파싱합니다:
- 테마 섹션 식별
- 종목 행 추출
- 데이터 필드 분리

### 2. 정제 단계

추출된 데이터를 정제합니다:
- 텍스트 노드 정규화
- 숫자 값 변환
- 이상값 처리

### 3. 저장 단계

SQLite 데이터베이스에 저장합니다:
- `theme_daily` 테이블: 테마별 일일 집계
- `theme_stock_daily` 테이블: 종목별 일일 상세

### 4. 중복 처리 방지

같은 날짜와 소스의 데이터는 중복으로 처리되지 않습니다:
- 날짜 + 테마명 + 소스 조합으로 중복 확인
- 기존 데이터가 있으면 건너뛰기

## 데이터베이스 스키마

### theme_daily

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | 기본 키 (자동 증가) |
| date | TEXT | 날짜 (YYYY-MM-DD) |
| theme_name | TEXT | 테마 이름 |
| data_source | TEXT | 데이터 소스 |
| stock_count | INTEGER | 종목 수 |
| avg_rs | REAL | 평균 RS 점수 |
| change_sum | REAL | 총 변화율 합계 |
| volume_sum | REAL | 총 거래량 합계 |

### theme_stock_daily

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | 기본 키 (자동 증가) |
| date | TEXT | 날짜 (YYYY-MM-DD) |
| theme_name | TEXT | 테마 이름 |
| stock_name | TEXT | 종목명 |
| data_source | TEXT | 데이터 소스 |
| rs_score | INTEGER | RS 점수 |
| change_pct | REAL | 변화율 |

## API 확인

데이터 처리 후 API를 통해 데이터를 확인할 수 있습니다:

### 처리된 날짜 목록 확인

```bash
curl "http://localhost:8000/api/dates?source=52w_high"
```

### 특정 날짜의 테마 데이터 확인

```bash
curl "http://localhost:8000/api/themes/daily?date=2024-01-15&source=52w_high"
```

### 데이터 검증

1. **API 응답 확인**: 모든 엔드포인트가 정상적으로 데이터를 반환하는지 확인
2. **데이터 일관성**: 동일 날짜의 여러 소스 간 데이터 비교
3. **테스트 실행**: 백엔드 테스트 수행

```bash
cd backend
python -m pytest tests/test_ingest_cli.py -v
```

## 고급 사용법

### 1. 로깅 레벨 조정

디버깅을 위해 로깅 레벨을 조정할 수 있습니다:

```python
import logging
logging.basicConfig(level=logging.DEBUG)  # 디버그 모드
```

### 2. 커스텀 파서 확장

HTML 구조가 다를 경우 파서를 수정할 수 있습니다:

```python
# scripts/ingest.py 수정
def parse_theme_sections(soup):
    # 커스텀 로직 구현
    pass
```

### 3. 대량 처리 최적화

많은 양의 파일을 처리할 경우:

```bash
# 병렬 처리 (Python multiprocessing 활용)
python scripts/ingest_batch.py ../data/
```

## 문제 해결

### 1. 파일 파싱 오류

**현상**: HTML 파일이 파싱되지 않음

**원인**: HTML 구조가 예상과 다름

**해결**:
- HTML 파일 구조 확인
- 파서 로직 조정
- 로그 레벨 DEBUG로 설정 후 상세 확인

```bash
# 디버그 모드로 실행
python scripts/ingest.py data/test.html --debug
```

### 2. 데이터 저장 오류

**현상**: 데이터베이스 오류 발생

**원인**: 중복 데이터 또는 데이터 형식 오류

**해결**:
- 데이터베이스 리셋 후 재처리
- 데이터 형식 검증
- 트랜잭션 로그 확인

```bash
# 데이터베이스 삭제 후 재생성 (주의)
rm -f app.db
python scripts/ingest.py data/
```

### 3. API 응답 없음

**현상**: API에서 데이터가 반환되지 않음

**원인**: 데이터베이스에 데이터 없음

**해결**:
- 데이터 수집 로그 확인
- API 엔드포인트 테스트
- 데이터베이스 연결 확인

```bash
# 데이터베이스 직접 확인
sqlite3 app.db "SELECT * FROM theme_daily LIMIT 5;"
```

## 성능 최적화

### 1. 인덱스 활용

데이터베이스에 적절한 인덱스가 생성되어 있습니다:
- 날짜별 조회 최적화
- 테마명별 조회 최적화
- 데이터 소스별 필터링 최적화

### 2. 쿼리 튜닝

API 쿼리는 최적화되어 있습니다:
- 필요한 데이터만 선택
- 적절한 정렬 방식
- 중복 계산 제거

### 3. 메모리 관리

대량 파일 처리 시 메모리 관리:
- 스트리밍 방식으로 대용량 파일 처리
- 일괄 처리로 메모리 최적화
- 가비지 컬렉션 활용

## 백업 및 복원

### 1. 데이터베이스 백업

```bash
# SQLite 데이터베이스 백업
cp app.db app_backup_$(date +%Y%m%d).db

# 전체 프로젝트 백업
tar -czf mtt-trend-backup-$(date +%Y%m%d).tar.gz ./
```

### 2. 데이터베이스 복원

```bash
# 백업 파일 복원
cp app_backup_20240314.db app.db

# 백업에서 특정 파일만 복원
sqlite3 app.db < backup_20240314.sql
```

## 업데이트 유지

### 1. 정기적 데이터 수집

매일 새로운 HTML 파일을 수집하여 데이터를 최신으로 유지합니다.

```bash
# 크론잡 예시 (매일 오후 3시 실행)
0 15 * * * cd /path/to/mtt-trend/backend && python scripts/ingest.py ../data/
```

### 2. 데이터 정기 검증

주간으로 데이터 무결성을 검증합니다:

```bash
# 데이터 통계 확인
curl "http://localhost:8000/api/dates?source=52w_high" | jq '.dates | length'
```

## 연관 자료

- [API 문서](API-DOCUMENTATION.md) - API 엔드포인트 상세 설명
- [프로젝트 구조](.moai/project/structure.md) - 전체 프로젝트 아키텍처
- [기술 스택](.moai/project/tech.md) - 사용된 기술 및 도구