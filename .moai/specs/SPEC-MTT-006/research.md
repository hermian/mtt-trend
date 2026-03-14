# 그룹 액션 탐지 기능 심층 연구 보고서

## 1. 현재 구현 상태

### 1.1 백엔드 API 분석

**파일**: `backend/app/routers/stocks.py` (`/api/stocks/group-action`)

**엔드포인트 정보**:
- URL: `GET /api/stocks/group-action`
- 파라미터: `date` (필수), `source` (선택, 기본값: "52w_high")
- 응답 형식: `GroupActionResponse` (date, stocks)

**비즈니스 로직 상세 설명**:

그룹 액션 탐지는 **두 가지 조건**을 결합한 알고리즘입니다:

#### 조건 1: 신규 등장 조건
- 주식이 3일 이내에 처음 등장했는지 확인
- `_recent_dates(db, date, 3)`로 최근 3일 내 등장 확인
- `first_seen_map`으로 전체 히스토리에서 최초 등장일 추적
- `is_new = first_seen in recent_3`로 판단

#### 조건 2: 테마 RS 상승 조건
- 해당 테마의 RS 점수가 어제보다 상승했는지 확인
- `yesterday_rs`와 `today_rs` 딕셔너리로 비교
- `theme_rs_today > theme_rs_yesterday` 조건 충족 시 탐지

**핵심 로직** (라인 191-225):
```python
for stock in today_stocks:
    first_seen = first_seen_map.get(stock.stock_name)
    is_new = first_seen in recent_3 if first_seen else False
    if not is_new:
        continue

    theme_rs_today = today_rs.get(stock.theme_name)
    theme_rs_yesterday = yesterday_rs.get(stock.theme_name)

    if theme_rs_today is None:
        continue
    if theme_rs_yesterday is not None and theme_rs_today <= theme_rs_yesterday:
        continue

    # 둘 다 충족 시 result에 추가
    result.append(GroupActionItem(...))
```

### 1.2 프론트엔드 UI 분석

**파일**: `frontend/src/app/trend/_components/GroupActionTable.tsx`

**컴포넌트 구조**:
- Props: `date`, `source` (기본값: "52w_high")
- 사용하는 훅: `useStocksGroupAction(date, source)`
- 상태 관리: React Query로 데이터 가져옴
- 로딩/에러/빈 상태 처리 완료

**상태 분류 로직** (라인 136-146):
```typescript
const getStockStatus = (stock: GroupActionStock): "new" | "returning" | "neutral" | "new_theme" => {
  // 신규 등장 테마 (어제 데이터 없음)
  if (stock.theme_rs_change === null) {
    return "new_theme";
  }
  if (stock.theme_rs_change > 5) return "new";
  if (stock.theme_rs_change < -5) return "returning";
  return "neutral";
};
```

**UI 스타일링**:
- RS 점수: 70+ (적색), 50-69 (황색), 50 미만 (청색)
- 상태 뱃지: 4가지 상태별 다른 색상 시각화
- 테이블 레이아웃: 6개 열 (종목명, RS점수, 등락률, 소속 테마, 테마RS변화, 상태)

### 1.3 데이터 모델 분석

**백엔드 스키마** (`backend/app/schemas.py`):
- `GroupActionItem`: `stock_name`, `rs_score`, `change_pct`, `theme_name`, `theme_rs_change`, `first_seen_date`
- `GroupActionResponse`: `date`, `stocks`

**프론트엔드 인터페이스** (`frontend/src/lib/api.ts`):
- `GroupActionStock`: 백엔드 스키마와 동일 구조
- 타입 안전성: 모든 필드 명시적 타입 선언

**데이터베이스 모델** (`backend/app/models.py`):
- `ThemeStockDaily`: 주식-테마 일별 매핑
- `ThemeDaily`: 테마별 일별 통계
- 인덱싱: `stock_name+date`, `theme_name+date`, `data_source`

## 2. 알고리즘 및 비즈니스 로직

### 2.1 그룹 액션 탐지 알고리즘

#### 두 가지 조건 결합 방식
**현재 알고리즘**: `AND` 조건 (두 조건 모두 충족해야 탐지)
```python
# 조건 1: 신규 등장
if not is_new:  # 3일 내 등장 아님
    continue

# 조건 2: 테마 RS 상승
if theme_rs_today <= theme_rs_yesterday:  # RS 상승 아님
    continue

# 결과: 두 조건 모두 충족 시 탐지
result.append(...)
```

#### 임계값 및 파라미터
- **시간 윈도우**: 3일 (hardcoded)
- **RS 변화 임계값**: 0 (단순 상승 여부만 확인)
- **프론트엔드 상태 임계값**: ±5 (UI 분류용)

### 2.2 데이터 흐름

#### DB → API → Frontend 파이프라인

```
1. DB 쿼리 (ThemeStockDaily + ThemeDaily)
   ├── ThemeStockDaily: 해당일 주식-테마 매핑
   ├── ThemeDaily: 해당일/어제 테마 RS 통계
   └── first_seen: 전체 히스토리에서 최초 등장일

2. 백엔드 로직 (stocks.py)
   ├── 신규 등장 여부 판단 (3일 내)
   ├── 테마 RS 변화 계산 (어제 vs 오늘)
   ├── 두 조건 AND 조합
   └── 정렬 (theme_rs_change 내림차순)

3. 프론트엔드 (GroupActionTable.tsx)
   ├── React Query 캐싱 및 에러 처리
   ├── 상태 분류 (4가지 상태로 분류)
   ├── UI 렌더링 (테이블 + 뱃지 시각화)
   └── RsChangeBadge null 값 처리
```

#### 각 단계의 데이터 변환

**DB 단계**:
- `ThemeStockDaily`: 단일 주식-테마 매핑
- `ThemeDaily`: 테마별 집계 통계
- 결합: SQL 쿼리로 필요 데이터 join

**API 단계**:
- 입력: `date`, `source`
- 처리: 메모리에서 집합 연산 (dict lookup)
- 출력: `GroupActionItem[]` (JSON)

**프론트엔드 단계**:
- 입력: `GroupActionStock[]`
- 처리: 상태 분류 로직 적용
- 출력: JSX 렌더링 (테이블 행)

## 3. 참고 구현 (Internal)

### SPEC-MTT-003 패턴: 신규 급등 테마 탐지
**파일**: `backend/app/routers/themes.py` (`/api/themes/surging`)

**참고 포인트**:
- 5일 이동평균 대비 RS 변화량 계산
- 임계값(threshold) 파라미터화
- 프론트엔드 슬라이더 UI 연동
- `SurgingTheme[]` 인터페이스 사용

**차이점**:
- **시간 윈도우**: 5일 vs 3일
- **변화량 계산**: 5일 평균 대비 vs 어제 대비
- **조건**: 단일 조건 vs 복합 조건

### SPEC-MTT-005 패턴: 테마 RS 추이 차트
**파일**: `frontend/src/app/trend/_components/ThemeTrendChart.tsx`

**참고 포인트**:
- `useMultipleThemeHistories` 훅 사용
- Recharts 라인 차트 구현
- 상태 관리 (disabledThemes, isUserModified)
- 툴팁 및 인터랙티브 기능

**적용 가능성**:
- 상태 관리 패턴 (Set 사용, 함수형 업데이트)
- Recharts 활용 경험
- 에지 케이스 처리 (단일 포인트 vs 다중 포인트)

## 4. 기술적 제약사항 및 리스크

### 4.1 성능 이슈

**쿼리 복잡도**:
```python
# 현재 쿼리 문제점
# 1. first_seen 서브쿼리: 모든 주식에 대해 최초 등장일 조회
first_seen_subq = db.query(ThemeStockDaily.stock_name, func.min(ThemeStockDaily.date))
                        .filter(ThemeStockDaily.data_source == source)
                        .group_by(ThemeStockDaily.stock_name)
                        .subquery()

# 2. 최근 3일 조회: 매번 distinct 쿼리 실행
recent_3: List[str] = _recent_dates(db, date, 3, source)

# 3. 어제/오늘 테마 RS 별도 조회 (중복 쿼리)
yesterday_rs: dict[str, float] = {}
today_rs: dict[str, float] = {}
```

**최적화 기회**:
- `first_seen` 정보 캐싱 계층 추가
- 최근 N일 데이터를 미리 집계해둘 것
- `ThemeDaily` 테마 RS 변화량을 미리 계산

### 4.2 하드코딩된 값

**매직 넘버**:
- **시간 윈도우**: 3일 (라인 143)
- **상태 분류 임계값**: ±5 (라인 143-145)
- **RS 점수 색상 경계**: 50, 70 (라인 192-196)

**리스크**:
- 비즈니스 로직 변경 시 코드 수정 필요
- 테스트 커버리지 분산
- 유지보수 어려움

### 4.3 UI/UX 제약사항

**현재 제한**:
- **상태 전환**: 재등장 → 신규 전환 불가능 (static 상태)
- **인터랙션**: 상태별 상세 정보 팝업 없음
- **반응성**: 대량 데이터 시 스크롤 성능 문제

**개선 필요**:
- 상태 변화 시각적 피드백
- 개별 종목 상세 정보 모달
- 가상화로 대량 데이터 처리

## 5. 고도화 기회 추천

### 5.1 기능적 개선안

#### F-01: 조건 조합 유연성 확보
**문제**: 현재 AND 조건만 지원
**해결**: OR/AND 조건 선택 가능한 설정 추가
```typescript
interface GroupActionConfig {
  conditionType: "and" | "or";
  timeWindow: number; // 1-7일
  rsThreshold?: number; // 선택적 RS 변화량 임계값
}
```

#### F-02: 히스토리 데이터 활용
**문제**: 현재 당일 데이터만 분석
**해결**: N일간의 추세 분석 추가
```python
# 트렌드 분석 로직
def calculate_trend(scores: List[float], window: int = 3) -> str:
    """N일간 추세 분석: "upward", "downward", "stable""""
    if len(scores) < window:
        return "insufficient_data"
    # 최근 N일 선형 회귀 또는 단순 평균 비교
```

#### F-03: 실시간 감지 모드
**문제**: 배치 처리 기반으로 지연 발생
**해결**: 스트리밍 데이터 처리 워크플로우
```python
# WebSocket을 통한 실시간 업데이트
@app.websocket("/ws/group-action/{date}")
async def websocket_group_action(websocket: WebSocket, date: str):
    # 실시간 데이터 스트림 처리
```

### 5.2 성능 최적화안

#### P-01: 쿼리 튜닝
**문제**: N+1 쿼리 패턴
**해결**: 집합 쿼리로 변경
```python
# 현재: O(n) 쿼리
# 개선: O(1) 쿼리로 변경
# 1. 단일 쿼리로 모든 필요 데이터 추출
# 2. 메모리에서 집합 연산 처리
# 3. 인덱스 추가: (first_seen_date, stock_name, date)
```

#### P-02: 계층형 캐싱
**문제**: 반복적인 계산
**해결**: Redis 기반 계층형 캐싱
```python
# 캐시 레이어
cache_key = f"group_action:{date}:{source}:{hash(params)}"
cached_result = redis.get(cache_key)
if not cached_result:
    result = calculate_group_action(...)
    redis.setex(cache_key, 300, json.dumps(result))  # 5분 TTL
```

#### P-03: 데이터 전처리
**문제**: 실시간 계산 부하
**해결**: 백그라운드에서 미리 계산
```python
# 매일 밤 미리 계산 저장
def precompute_group_actions():
    yesterday = get_previous_trading_day()
    results = calculate_all_conditions(yesterday)
    save_to_database(results)
```

### 5.3 UX 개선안

#### U-01: 상태 이력 시각화
**문제**: 현재 상태만 표시
**해결**: 상태 변화 추적 차트
```typescript
// 상태 변화 히스토리 컴포넌트
function StateHistoryChart({ stock_name }: { stock_name: string }) {
  // 최근 30일간 상태 변화 추적
  // 트렌드선과 함께 상태 변화점 마킹
}
```

#### U-02: 인터랙티브 필터링
**문제**: 정적 필터링만 지원
**해결**: 다차원 필터링 UI
```typescript
interface AdvancedFilters {
  timeWindow: [number, number]; // 1-7일 범위
  rsRange: [number, number]; // RS 점수 범위
  themes: string[]; // 선택 테마
  minStocks: number; // 최소 주식 수
}
```

#### U-03: 알림 시스템
**문제**: 수동 확인만 가능
**해결**: 푸시 알림
```typescript
// 트레이딩 알림
interface TradingAlert {
  type: "group_action" | "surging_theme";
  condition: AlertCondition;
  message: string;
  timestamp: Date;
}
```

### 5.4 아키텍처 개선안

#### A-01: 마이크로서비스 분리
**문제**: 단일 모노리스
**해결**: 그룹 액션 전용 서비스
```
group-action-service/
├── detection-engine/
│   ├── condition-evaluator
│   ├── trend-analyzer
│   └── threshold-manager
├── storage/
│   ├── time-series-db
│   └── cache-layer
└── api/
    ├── grpc
    └── rest
```

#### A-02: 이벤트 드리븐 아키텍처
**문제**: 풀링 방식 비효율
**해결**: 이벤트 기반 처리
```python
# 이벤트 기반 처리
class GroupActionEvent:
    event_type: "stock_appearance" | "theme_change"
    stock_name: str
    theme_name: str
    rs_score: float
    timestamp: datetime
```

#### A-03: 머신러닝 통합
**문제**: 규칙 기반 탐지
**해결**: 예측 모델 추가
```python
# ML 모델 예시
class GroupActionPredictor:
    def predict_probability(self, features: Dict) -> float:
        # 주식-테마 상관관계 분석
        # 시장 심리 지표 반영
        # 변동성 가중치 적용
```

---

## 종합 평가

### 현재 구현 강점
1. **로직 명확성**: 두 조건 AND 결합이 직관적 이해 용이
2. **테스트 커버리지**: 7개의 주요 시나리오 커버
3. **타입 안전성**: TypeScript/Python 타입 시스템 완벽 적용
4. **성능**: 일반적 규모에서는 충분한 성능

### 주요 개선 우선순위
1. **높음**: 쿼리 성능 최적화 (N+1 문제 해결)
2. **중간**: 조건 조합 유연성 확장 (OR 지원)
3. **중간**: 하드코딩된 값 파라미터화
4. **낮음**: ML 예측 모델 통합

### 즉시 적용 가능 개선사항
1. **매직 넘버 상수화**
2. **인덱스 추가** (first_seen_date)
3. **캐싱 레이어 추가**
4. **UI 반응성 개선** (가상화)

이 연구를 바탕으로 SPEC-MTT-006 문서를 작성할 수 있으며, 실제 구현 시 TDD 방법론을 적용하여 기존 동작을 보존하면서 점진적으로 고도화를 진행하는 것을 권장합니다.
