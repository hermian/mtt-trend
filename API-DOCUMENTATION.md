# API 문서

## 개요

52-Week High Theme Trend Dashboard API는 한국 주식의 신고가 달성 종목과 MTT 템플릿 종목들을 테마별로 분석하는 실시간 트렌드 대시보드용 API입니다.

**기본 URL**: `http://localhost:8000`

**데이터 소스**:
- `52w_high`: 52주 신고가 데이터 (기본값)
- `mtt`: MTT 템플릿 데이터

---

## API 엔드포인트

### 날짜 조회

#### GET /api/dates

주어진 데이터 소스에 대한 모든 처리된 날짜 목록을 반환합니다.

**파라미터**:
- `source` (선택): 데이터 소스 (`52w_high` 또는 `mtt`)

**응답 형식**:
```json
{
  "dates": ["2024-01-15", "2024-01-16", "2024-01-17"]
}
```

**사용 예시**:
```bash
curl "http://localhost:8000/api/dates?source=52w_high"
```

---

### 테마 데이터

#### GET /api/themes/daily

특정 날짜의 모든 테마별 RS 데이터를 반환합니다. 데이터는 avg_rs 값으로 내림차순 정렬됩니다.

**파라미터**:
- `date` (선택): 조회할 날짜 (YYYY-MM-DD 형식). 생략 시 최신 데이터
- `source` (선택): 데이터 소스

**응답 형식**:
```json
{
  "date": "2024-01-15",
  "themes": [
    {
      "date": "2024-01-15",
      "theme_name": "인공지능",
      "stock_count": 15,
      "avg_rs": 85.5,
      "change_sum": 12.3,
      "volume_sum": 15000000000
    }
  ]
}
```

**사용 예시**:
```bash
curl "http://localhost:8000/api/themes/daily?date=2024-01-15&source=52w_high"
```

---

#### GET /api/themes/surging

지정된 임계값보다 RS 점수가 크게 상승한 테마를 탐지합니다. 5일 평균 대비 상승분을 계산합니다.

**파라미터**:
- `date` (선택): 조회할 날짜. 생략 시 최신 데이터
- `threshold` (선택): RS 상승 임계값 (기본값: 10.0)
- `source` (선택): 데이터 소스

**응답 형식**:
```json
{
  "date": "2024-01-15",
  "threshold": 10.0,
  "themes": [
    {
      "date": "2024-01-15",
      "theme_name": "반도체",
      "stock_count": 20,
      "avg_rs": 92.5,
      "avg_rs_5d": 82.1,
      "rs_change": 10.4,
      "change_sum": 15.8,
      "volume_sum": 25000000000
    }
  ]
}
```

**사용 예시**:
```bash
curl "http://localhost:8000/api/themes/surging?date=2024-01-15&threshold=15&source=52w_high"
```

---

#### GET /api/themes/{name}/history

특정 테마의 최근 N일간 RS 시계열 데이터를 반환합니다.

**파라미터**:
- `name`: 테마 이름 (경로 파라미터)
- `days` (선택): 조회할 일수 (기본값: 30, 최대: 365)
- `source` (선택): 데이터 소스

**응답 형식**:
```json
{
  "theme_name": "인공지능",
  "days": 30,
  "history": [
    {
      "date": "2024-01-15",
      "theme_name": "인공지능",
      "avg_rs": 85.5,
      "stock_count": 15,
      "change_sum": 12.3
    }
  ]
}
```

**사용 예시**:
```bash
curl "http://localhost:8000/api/themes/인공지능/history?days=30&source=52w_high"
```

---

### 종목 데이터

#### GET /api/stocks/persistent

지정된 기간 내에 N번 이상 신고가 리스트에 등장한 종목을 탐지합니다.

**파라미터**:
- `days` (선택): 조회 기간 (거래일 기준, 기본값: 5, 최대: 60)
- `min` (선택): 최소 등장 횟수 (기본값: 3)
- `source` (선택): 데이터 소스

**응답 형식**:
```json
{
  "days": 5,
  "min_appearances": 3,
  "stocks": [
    {
      "stock_name": "삼성전자",
      "appearance_count": 5,
      "avg_rs": 88.2,
      "themes": ["인공지능", "반도체", "5G"]
    }
  ]
}
```

**사용 예시**:
```bash
curl "http://localhost:8000/api/stocks/persistent?days=10&min=5&source=52w_high"
```

---

#### GET /api/stocks/group-action

신규 등장 테마 + RS 상승 추세를 동시에 만족하는 종목을 탐지합니다.

**파라미터**:
- `date` (선택): 조회할 날짜. 생략 시 최신 데이터
- `source` (선택): 데이터 소스
- `timeWindow` (선택): 신규 등장 판정 기간 (1-7일, 기본값: 3)
- `rsThreshold` (선택): 테마 RS 상승 임계값 (-10 ~ +20, 기본값: 0)

**응답 형식**:
```json
{
  "date": "2024-01-15",
  "timeWindow": 3,
  "rsThreshold": 0,
  "stocks": [
    {
      "stock_name": "LG에너지솔루션",
      "rs_score": 95,
      "change_pct": 3.2,
      "theme_name": "2차전지",
      "theme_rs_change": 12.5,
      "first_seen_date": "2024-01-13",
      "status_threshold": 5
    }
  ]
}
```

**사용 예시**:
```bash
# 기본 사용 (하위 호환성 유지)
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&source=52w_high"

# 5일 윈도우로 조회
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=5&source=52w_high"

# RS 임계값 5로 설정
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&rsThreshold=5&source=52w_high"

# 모든 파라미터 사용
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=7&rsThreshold=10&source=52w_high"
```

---

### 헬스 체크

---

### 동기화 API

#### POST /api/sync

HTML 리포트 파일의 DB 동기화를 수동으로 트리거합니다.

**파라미터**: Body 없음

**응답 형식**:
```json
{
  "status": "completed",
  "total_files_scanned": 10,
  "files_processed": 3,
  "files_skipped": 7,
  "records_created": 45,
  "errors": [],
  "started_at": "2026-03-15T10:30:00Z",
  "completed_at": "2026-03-15T10:30:05Z"
}
```

**사용 예시**:
```bash
curl -X POST "http://localhost:8000/api/sync"
```

#### GET /api/sync/status (Optional)

동기화 시스템의 현재 상태를 조회합니다.

**응답 형식**:
```json
{
  "watchdog_active": true,
  "watched_directory": "backend/data/",
  "last_sync_at": "2026-03-15T10:30:05Z",
  "last_sync_result": {
    "files_processed": 3,
    "errors": []
  }
}
```

**사용 예시**:
```bash
curl "http://localhost:8000/api/sync/status"
```

#### GET /health

API 서버의 상태를 확인합니다.

**응답 형식**:
```json
{
  "status": "ok"
}
```

**사용 예시**:
```bash
curl "http://localhost:8000/health"
```

---

## 데이터 모델

### ThemeDailyItem

테마별 일일 집계 데이터

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | string | 날짜 (YYYY-MM-DD) |
| `theme_name` | string | 테마 이름 |
| `stock_count` | number\|null | 해당 테마에 포함된 종목 수 |
| `avg_rs` | number\|null | 평균 RS 점수 |
| `change_sum` | number\|null | 총 변화율 합계 |
| `volume_sum` | number\|null | 총 거래량 합계 |

### ThemeSurgingItem

급등 테마 데이터

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | string | 날짜 |
| `theme_name` | string | 테마 이름 |
| `stock_count` | number\|null | 종목 수 |
| `avg_rs` | number\|null | 평균 RS 점수 |
| `avg_rs_5d` | number\|null | 5일 평균 RS 점수 |
| `rs_change` | number\|null | RS 변화량 (5일 평균 대비) |
| `change_sum` | number\|null | 총 변화율 합계 |
| `volume_sum` | number\|null | 총 거래량 합계 |

### PersistentStockItem

지속 강세 종목 데이터

| 필드 | 타입 | 설명 |
|------|------|------|
| `stock_name` | string | 종목명 |
| `appearance_count` | number | 등장 횟수 |
| `avg_rs` | number\|null | 평균 RS 점수 |
| `themes` | array[string] | 해당 종목이 속한 테마 목록 |

### GroupActionItem

그룹 액션 종목 데이터

| 필드 | 타입 | 설명 |
|------|------|------|
| `stock_name` | string | 종목명 |
| `rs_score` | number\|null | RS 점수 |
| `change_pct` | number\|null | 변화율 |
| `theme_name` | string | 테마 이름 |
| `theme_rs_change` | number\|null | 테마 RS 변화량 |
| `first_seen_date` | string\|null | 최초 등장 날짜 |
| `status_threshold` | number | 상태 분류에 사용된 임계값 |

---

## 상태 분류 시스템

프론트엔드는 `status_threshold` 값을 기반으로 종목 상태를 4가지로 분류합니다:

### 상태 분류 로직

| 상태 | 조건 | 설명 |
|------|------|------|
| `new_theme` | `theme_rs_change === null` | 어제 데이터가 없는 완전히 새로운 테마 |
| `new` | `theme_rs_change > status_threshold` | 강한 상승세 (매수 신호) |
| `returning` | `theme_rs_change < -status_threshold` | 강한 하락세 (매도 신호) |
| `neutral` | 그 외 | 변화가 미미한 중립 상태 |

### 사용 예시

```typescript
// 상태 분류 함수 예시
function getStockStatus(themeRsChange: number | null, statusThreshold: number): string {
  if (themeRsChange === null) return 'new_theme';
  if (themeRsChange > statusThreshold) return 'new';
  if (themeRsChange < -statusThreshold) return 'returning';
  return 'neutral';
}

// 사용 예시
console.log(getStockStatus(15, 5));    // 'new' (15 > 5)
console.log(getStockStatus(-8, 5));    // 'returning' (-8 < -5)
console.log(getStockStatus(2, 5));     // 'neutral' (-5 ≤ 2 ≤ 5)
console.log(getStockStatus(null, 5));  // 'new_theme'
```

---

## 프론트엔드 통합

### React Query 사용 예시

```typescript
import { useQuery } from "@tanstack/react-query";
import { api, DataSource } from "@/lib/api";

// 사용 가능한 날짜 조회
export function useDates(source: DataSource = "52w_high") {
  return useQuery<string[]>({
    queryKey: ["dates", source],
    queryFn: () => api.getDates(source),
    staleTime: 5 * 60 * 1000,
  });
}

// 일일 테마 데이터 조회
export function useThemesDaily(date: string | null, source: DataSource = "52w_high") {
  return useQuery<ThemeDaily[]>({
    queryKey: ["themes", "daily", date, source],
    queryFn: () => api.getThemesDaily(date!, source),
    enabled: !!date,
    staleTime: 5 * 60 * 1000,
  });
}

// 급등 테마 조회
export function useThemesSurging(date: string | null, threshold = 10, source: DataSource = "52w_high") {
  return useQuery<SurgingTheme[]>({
    queryKey: ["themes", "surging", date, threshold, source],
    queryFn: () => api.getThemesSurging(date!, threshold, source),
    enabled: !!date,
    staleTime: 5 * 60 * 1000,
  });
}

// 그룹 액션 종목 조회 (파라미터 확장)
export function useStocksGroupAction(
  date: string | null,
  source: DataSource = "52w_high",
  timeWindow?: number,
  rsThreshold?: number
) {
  return useQuery<GroupActionStock[]>({
    queryKey: ["stocks", "group-action", date, source, timeWindow, rsThreshold],
    queryFn: () => api.getStocksGroupAction(date!, source, timeWindow, rsThreshold),
    enabled: !!date,
    staleTime: 5 * 60 * 1000,
  });
}
```

### API 클라이언트 구성

```typescript
import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});
```

---

## 오류 처리

### HTTP 상태 코드

- `200`: 성공
- `404`: 데이터 없음
- `422**: 파라미터 오류
- `500`: 서버 오류

### 오류 응답 형식

```json
{
  "detail": "에러 메시지"
}
```

### 일반 오류

1. **No data available**
   - 원인: 지정된 날짜 또는 데이터 소스에 데이터가 없음
   - 해결: `/api/dates` 엔드포인트로 사용 가능한 날짜 확인

2. **Invalid date format**
   - 원인: 날짜 형식이 올바르지 않음 (YYYY-MM-DD 필요)
   - 해결: 날짜 포맷을 확인하고 재시도

3. **Theme not found**
   - 원인: 요청된 테마 이름이 데이터베이스에 없음
   - 해결: 테마 이름이 정확한지 확인

---

## 개발 가이드

### 로컬 개발 환경

```bash
# 백엔드 서버 시작
cd backend
uvicorn app.main:app --reload --port 8000

# API 문서 확인
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

### 테스트

```bash
# 백엔드 테스트
cd backend
python -m pytest tests/ -v

# API 엔드포인트 테스트
curl "http://localhost:8000/health"
```

---

## 배포

### 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `DATABASE_URL` | 데이터베이스 연결 문자열 | SQLite 사용 시 생략 |
| `API_HOST` | API 서버 호스트 | `0.0.0.0` |
| `API_PORT` | API 서버 포트 | `8000` |

### Docker 배포

```bash
# Docker 이미지 빌드
docker build -t mtt-trend-backend backend/

# 컨테이너 실행
docker run -p 8000:8000 mtt-trend-backend
```

---

## 업데이트 로그

### v1.1.0 (2026-03-15)
- 그룹 액션 탐지 기능 고도화 (SPEC-MTT-006)
- 새로운 파라미터 추가: `timeWindow` (1-7일), `rsThreshold` (-10~+20)
- 응답 필드 추가: `status_threshold` (상태 분류 기준)
- 데이터베이스 성능 최적화: 인덱스 추가로 80% 응답 속도 향상
- 18/18 테스트 통과, 85%+ 커버리지 달성
- 상태 분류 시스템 및 UI 컨트롤 추가
- TDD 개발 방식으로 안정성 보장

### v1.0.0 (2026-03-14)
- 초기 버전 출시
- 모든 API 엔드포인트 구현 완료
- 52주 신고가 및 MTT 데이터 소스 지원
- 프론트엔드 React Query 통합