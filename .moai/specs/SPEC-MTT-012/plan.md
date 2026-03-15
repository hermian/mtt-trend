# SPEC-MTT-012: Implementation Plan

**TAG**: SPEC-MTT-012
**Parent SPEC**: spec.md

---

## Milestones

### Primary Goal: 교집합 API 구현

- [x] `backend/app/schemas.py`에 응답 스키마 추가 (`IntersectionStockItem`, `IntersectionThemeItem`, `IntersectionResponse`)
- [x] 두 소스 모두 존재하는 최신 날짜 조회 헬퍼 함수 구현
- [x] 테마 교집합 쿼리 (Level 1) 구현
- [x] 종목 교집합 쿼리 (Level 2) 구현
- [x] 교집합 종목 수 기준 정렬 로직 구현
- [x] `backend/app/routers/stocks.py`에 `GET /api/intersection` 엔드포인트 등록

### Secondary Goal: 프론트엔드 통합

- [x] `frontend/src/lib/api.ts`에 TypeScript 인터페이스 및 `getIntersection()` 함수 추가
- [x] `frontend/src/hooks/useStocks.ts`에 `useIntersection()` React Query 훅 추가
- [x] `frontend/src/app/trend/_components/IntersectionTab.tsx` 컴포넌트 생성
- [x] `frontend/src/app/trend/_components/StockAnalysisTabs.tsx`에 "교집합 추천" 탭 추가

### Final Goal: 검증 및 테스트

- [x] Backend API 단위 테스트 작성 (교집합 쿼리 정확성)
- [x] Frontend 컴포넌트 테스트 작성
- [x] 빈 데이터 / 에러 케이스 처리 검증
- [x] 실 데이터로 교집합 결과 정확성 확인

---

## Technical Approach

### Step 1: Backend 스키마 추가

**File**: `backend/app/schemas.py`

기존 스키마 패턴을 따라 `IntersectionStockItem`, `IntersectionThemeItem`, `IntersectionResponse` 세 개의 Pydantic 모델 추가.

### Step 2: 교집합 엔드포인트 구현

**File**: `backend/app/routers/stocks.py`

```python
@router.get("/intersection", response_model=IntersectionResponse)
def get_intersection(date: str | None = None, db: Session = Depends(get_db)):
    # 1. date 미지정 시 양쪽 소스 모두 존재하는 최신 날짜 자동 탐색
    # 2. ThemeDaily self-JOIN으로 Level 1 테마 교집합 조회
    # 3. ThemeStockDaily self-JOIN으로 Level 2 종목 교집합 조회
    # 4. intersection_stock_count 기준 내림차순 정렬
```

**최신 날짜 탐색 로직**:
```python
# 두 소스 모두에 데이터가 있는 가장 최근 날짜 조회
subq_52w = db.query(ThemeDaily.date).filter(ThemeDaily.data_source == SOURCE_52W)
subq_mtt = db.query(ThemeDaily.date).filter(ThemeDaily.data_source == SOURCE_MTT)
latest_date = db.query(func.max(ThemeDaily.date)).filter(
    ThemeDaily.date.in_(subq_52w),
    ThemeDaily.date.in_(subq_mtt)
).scalar()
```

### Step 3: Frontend API 클라이언트

**File**: `frontend/src/lib/api.ts`

기존 `StrongStock`, `GroupAction` 인터페이스 패턴을 따라 TypeScript 인터페이스 추가:
```typescript
export interface IntersectionStock { ... }
export interface IntersectionTheme { ... }
export interface IntersectionResponse { ... }
```

### Step 4: React Query 훅

**File**: `frontend/src/hooks/useStocks.ts`

기존 `useStrongStocks`, `useGroupAction` 훅 패턴을 따라 `useIntersection` 훅 추가.

### Step 5: IntersectionTab 컴포넌트

**File**: `frontend/src/app/trend/_components/IntersectionTab.tsx`

기존 `StrongStocksTable.tsx` 구조를 참조하여 신규 컴포넌트 생성:
- 테마별 카드 또는 아코디언 형태로 교집합 테마/종목 표시
- 테마명, 교집합 종목 수, 52w RS 점수 표시
- 빈 결과 시 안내 메시지 표시
- 로딩/에러 상태 처리

### Step 6: StockAnalysisTabs 탭 추가

**File**: `frontend/src/app/trend/_components/StockAnalysisTabs.tsx`

`TabId` 타입에 `"intersection"` 추가, 탭 목록에 "교집합 추천" 항목 추가, 탭 렌더링 분기 추가.

---

## Implementation Order (Dependencies)

```
schemas.py
    ↓
stocks.py (router)
    ↓
api.ts (TypeScript interface)
    ↓
useStocks.ts (hook)
    ↓
IntersectionTab.tsx (component)
    ↓
StockAnalysisTabs.tsx (tab registration)
```

---

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 실 데이터에서 테마명/종목명 불일치 | Medium | High | 개발 완료 후 실 DB로 교집합 결과 수동 검증 |
| 기존 탭 UI 깨짐 | Low | Medium | StockAnalysisTabs 수정 시 기존 탭 렌더링 회귀 테스트 |
| JOIN 쿼리 성능 | Low | Low | 기존 인덱스 활용, 응답시간 측정 |

---

## Definition of Done

- [x] `GET /api/intersection` 엔드포인트 정상 동작
- [x] 날짜 미지정 시 자동 최신 날짜 선택
- [x] 교집합 종목 수 기준 내림차순 정렬
- [x] "교집합 추천" 탭이 대시보드에 표시됨
- [x] 빈 결과 시 안내 메시지 표시
- [x] 로딩/에러 상태 처리
- [x] 기존 탭 기능 회귀 없음
- [x] Backend 단위 테스트 통과 (11/11)
- [x] 테스트 커버리지 >= 85%
