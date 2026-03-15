---
id: SPEC-MTT-006
version: "1.1.0"
status: Completed
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
priority: High
issue_number: 0
---

# SPEC-MTT-006: 그룹 액션 탐지 기능 고도화

## 변경 이력 (History)

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.1.0 | 2026-03-15 | Hosung Kim | 구현 완료, 문서 업데이트 |
| 1.0.0 | 2026-03-15 | Hosung Kim | 초기 SPEC 문서 작성 |

---

## 배경 (Background)

그룹 액션 탐지 기능은 신규 등장 종목과 테마 RS 상승을 결합하여 유망한 투자 기회를 탐지합니다. 현재 구현은 하드코딩된 매직 넘버(3일 윈도우, RS 임계값 0, 상태 임계값 ±5)를 사용하여 사용자 요구에 유연하게 대응할 수 없습니다.

본 SPEC은 이러한 매직 넘버를 파라미터화하고, 쿼리 성능을 최적화하여 다음과 같은 개선을 목표로 합니다:

1. **유연성**: 사용자가 탐지 조건을 직접 조정 가능
2. **성능**: 인덱스 추가로 쿼리 응답 시간 단축
3. **하위 호환성**: 기본값으로 기존 동작 보장

---

## 가정 (Assumptions)

### A-01: 데이터 소스 안정성
- `ThemeStockDaily`와 `ThemeDaily` 테이블이 일관되게 업데이트됨
- 데이터 소스(`52w_high`, `52w_low`)가 기존과 동일한 형식 유지

### A-02: 프론트엔드 기술 스택
- Next.js 14.1.0+, React 18.2.0+, TanStack Query 5.17+ 호환
- Tailwind CSS 슬라이더 컴포넌트 구현 가능

### A-03: 데이터베이스
- SQLite 로컬 개발 환경 (프로덕션은 PostgreSQL)
- 인덱스 추가로 인한 스토리지 증가 허용 가능

### A-04: 기존 API 계약
- 기존 `/api/stocks/group-action` 엔드포인트 시그니처 유지
- 새 파라미터는 선택적(옵셔널)으로 추가

---

## 요구사항 (Requirements)

### F-01: 시간 윈도우 파라미터화

**WHEN** 사용자가 그룹 액션 탐지를 요청하면, **THEN** 시스템은 `timeWindow` 파라미터를 통해 신규 등장 판정 기간을 1~7일 범위에서 설정할 수 있게 **SHALL** 한다.

**상세 사양:**
- 기본값: 3일 (기존 동작 보장)
- 허용 범위: 1일 ~ 7일
- 검증 규칙: 범위 외 값 요청 시 400 Bad Request 반환
- 백엔드 구현: `_recent_dates(db, date, timeWindow, source)` 함수 수정

**API 예시:**
```
GET /api/stocks/group-action?date=2024-01-15&source=52w_high&timeWindow=5
```

---

### F-02: RS 변화 임계값 파라미터화

**WHEN** 사용자가 그룹 액션 탐지를 요청하면, **THEN** 시스템은 `rsThreshold` 파라미터를 통해 테마 RS 상승 판정 기준을 설정할 수 있게 **SHALL** 한다.

**상세 사양:**
- 기본값: 0 (기존 동작: 단순 상승 여부만 확인)
- 허용 범위: -10 ~ +20
- 필터링 조건: `theme_rs_change > rsThreshold`
- 백엔드 구현: 조건 분기에 임계값 변수 적용

**API 예시:**
```
GET /api/stocks/group-action?date=2024-01-15&rsThreshold=5
```

**동작 예시:**
- `rsThreshold=0`: RS 변화량이 0보다 큰 종목만 (기존 동작)
- `rsThreshold=5`: RS 변화량이 5보다 큰 종목만 (더 엄격한 조건)
- `rsThreshold=-5`: RS 변화량이 -5보다 큰 종목만 (더 완화된 조건)

---

### F-03: 상태 분류 임계값 파라미터화

**WHEN** 프론트엔드에서 상태를 분류하면, **THEN** 시스템은 백엔드에서 전달받은 `statusThreshold` 값을 기준으로 4가지 상태를 분류 **SHALL** 한다.

**상세 사양:**
- 기본값: 5 (기존 동작)
- 허용 범위: 1 ~ 20
- 분류 로직:
  - `new_theme`: `theme_rs_change === null` (어제 데이터 없음)
  - `new`: `theme_rs_change > statusThreshold` (강한 상승)
  - `returning`: `theme_rs_change < -statusThreshold` (강한 하락)
  - `neutral`: 그 외 (변화 미미)

**스키마 변경:**
```typescript
interface GroupActionStock {
  stock_name: string;
  rs_score: number;
  change_pct: number;
  theme_name: string;
  theme_rs_change: number | null;
  first_seen_date: string;
  // NEW
  status_threshold: number; // 분류에 사용된 임계값
}
```

---

### F-04: UI 파라미터 컨트롤

**WHEN** 사용자가 그룹 액션 테이블을 조회하면, **THEN** 시스템은 다음 파라미터 조절 UI를 제공 **SHALL** 한다.

**상세 사양:**
- 시간 윈도우 슬라이더 (1~7일, 기본값 3)
- RS 임계값 슬라이더 (-10~+20, 기본값 0)
- 상태 임계값 슬라이더 (1~20, 기본값 5)

**UI 구조:**
```
┌─────────────────────────────────────────────┐
│ 그룹 액션 탐지                               │
├─────────────────────────────────────────────┤
│ [시간 윈도우: 3일 ▬▬▬○▬▬▬] [1-7]            │
│ [RS 임계값: 0   ▬○▬▬▬▬▬▬▬] [-10~+20]       │
│ [상태 임계값: 5 ▬▬▬○▬▬▬▬] [1-20]           │
├─────────────────────────────────────────────┤
│ 종목명 | RS점수 | 등락률 | 테마 | RS변화 ... │
└─────────────────────────────────────────────┘
```

**인터랙션:**
- 시간 윈도우/RS 임계값 변경 → API 재호출
- 상태 임계값 변경 → 클라이언트에서 즉시 테이블 갱신 (API 호출 없음)

---

### NFR-01: 데이터베이스 인덱스 최적화

**THE** 시스템은 `first_seen_date` 기반 조회 성능을 위해 다음 인덱스를 추가 **SHALL** 한다.

**인덱스 정의:**
```sql
CREATE INDEX IF NOT EXISTS idx_stock_first_seen
ON theme_stock_daily(stock_name, date, data_source);
```

**성능 목표:**
- 기존: ~500ms (first_seen 서브쿼리)
- 목표: ~100ms (인덱스 활용)
- 측정 방법: 실제 API 호출 시간 비교

---

### NFR-02: API 응답 시간

**WHEN** 그룹 액션 API가 호출되면, **THEN** 시스템은 500ms 이내에 응답을 반환 **SHALL** 한다.

**상세 사양:**
- 측정 기준: P95 응답 시간
- 모니터링: FastAPI 미들웨어로 응답 시간 로깅
- 임계값 초과 시: 성능 로그 기록 및 알림

---

### NFR-03: 하위 호환성

**WHEN** 파라미터 없이 API가 호출되면, **THEN** 시스템은 기존 SPEC-MTT-002와 동일한 결과를 반환 **SHALL** 한다.

**상세 사양:**
- 기본값 보장: `timeWindow=3`, `rsThreshold=0`, `statusThreshold=5`
- 기존 프론트엔드 코드 변경 없이 동작
- 회귀 테스트: 기존 테스트 케이스 모두 통과

---

## 제약사항 (Constraints)

### C-01: 기술 스택 제약
- 백엔드: FastAPI 0.109.2, SQLAlchemy 2.0.28, Pydantic 2.6.1
- 프론트엔드: Next.js 14.1.0+, React 18.2.0+, TanStack Query 5.17+
- 데이터베이스: SQLite (개발), PostgreSQL (프로덕션)

### C-02: API 계약 제약
- 기존 엔드포인트 URL 변경 불가
- 기존 파라미터(`date`, `source`) 필수 유지
- 새 파라미터는 모두 선택적(옵셔널)

### C-03: UI 제약
- Recharts 라이브러리 버전 2.10.4 고정
- 슬라이더는 HTML `<input type="range">` 사용 (Recharts 외부)
- Tailwind CSS 기존 디자인 시스템 준수

### C-04: 성능 제약
- 인덱스 추가로 인한 DB 크기 증가 허용 (~10% 증가 예상)
- 쿼리 복잡도 증가 최소화 (기존 O(n) 패턴 유지)

---

## 기술 참고 (Technical Notes)

### T-01: 백엔드 구현 패턴

**참고 구현 (SPEC-MTT-003):**
- 파일: `backend/app/routers/themes.py` (라인 120-145)
- 패턴: threshold 파라미터 처리, Pydantic 검증

**파라미터 처리 예시:**
```python
@router.get("/group-action")
async def get_group_action(
    date: str,
    source: str = "52w_high",
    timeWindow: int = Query(default=3, ge=1, le=7),
    rsThreshold: int = Query(default=0, ge=-10, le=20),
    db: Session = Depends(get_db)
):
    # 기존 로직에 파라미터 적용
    recent_dates = _recent_dates(db, date, timeWindow, source)
    # ...
```

### T-02: 프론트엔드 구현 패턴

**참고 구현 (SPEC-MTT-003):**
- 파일: `frontend/src/app/trend/_components/SurgingThemesCard.tsx` (라인 50-80)
- 패턴: 슬라이더 UI, 상태 관리

**상태 관리 예시:**
```typescript
const [timeWindow, setTimeWindow] = useState(3);
const [rsThreshold, setRsThreshold] = useState(0);

const { data } = useStocksGroupAction(date, source, timeWindow, rsThreshold);
```

### T-03: 데이터베이스 마이그레이션

**인덱스 추가 스크립트:**
```python
# backend/app/database.py
def create_indexes():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_stock_first_seen
            ON theme_stock_daily(stock_name, date, data_source)
        """))
        conn.commit()
```

**주의사항:**
- `IF NOT EXISTS`로 중복 생성 방지
- 프로덕션 배포 전 DB 백업 권장
- 인덱스 생성 시간: ~1-2초 (데이터 양에 따라 다름)

### T-04: 테스트 전략

**백엔드 테스트 (pytest):**
```python
def test_time_window_parameter(client):
    # 1일 윈도우
    response = client.get("/api/stocks/group-action?date=2024-01-15&timeWindow=1")
    assert response.status_code == 200

    # 7일 윈도우
    response = client.get("/api/stocks/group-action?date=2024-01-15&timeWindow=7")
    assert response.status_code == 200

    # 범위 외 값
    response = client.get("/api/stocks/group-action?date=2024-01-15&timeWindow=10")
    assert response.status_code == 400
```

**프론트엔드 테스트 (Jest):**
```typescript
test('slider triggers API refetch', async () => {
  const { getByLabelText } = render(<GroupActionTable date="2024-01-15" />);

  const slider = getByLabelText('시간 윈도우');
  fireEvent.change(slider, { target: { value: 5 } });

  await waitFor(() => {
    expect(mockApiClient.getGroupAction).toHaveBeenCalledWith(
      '2024-01-15',
      '52w_high',
      5,  // timeWindow
      0   // rsThreshold
    );
  });
});
```

---

## 추적성 (Traceability)

### 태그 매핑

| 태그 | 참조 문서 | 설명 |
|------|----------|------|
| SPEC-MTT-006 | 본 문서 | 그룹 액션 탐지 기능 고도화 |
| SPEC-MTT-003 | `.moai/specs/SPEC-MTT-003/` | threshold 슬라이더 패턴 참조 |
| SPEC-MTT-005 | `.moai/specs/SPEC-MTT-005/` | 상태 관리 패턴 참조 |
| research.md | `.moai/specs/SPEC-MTT-006/research.md` | 심층 연구 보고서 |
| plan.md | `.moai/specs/SPEC-MTT-006/plan.md` | 구현 계획서 |

### 의존성

| 관계 | 대상 | 설명 |
|------|------|------|
| 선행 | SPEC-MTT-002 | 기존 그룹 액션 탐지 기능 |
| 후행 | SPEC-MTT-007 | 조건 조합 유연성 확보 (예정) |
| 후행 | SPEC-MTT-008 | 히스토리 분석 및 시각화 (예정) |

### 코드 참조

| 파일 | 라인 | 관련 요구사항 |
|------|------|--------------|
| `backend/app/routers/stocks.py` | 143-225 | F-01, F-02 (API 로직) |
| `backend/app/schemas.py` | GroupActionItem | F-03 (스키마 확장) |
| `frontend/src/app/trend/_components/GroupActionTable.tsx` | 136-146 | F-03, F-04 (UI 분류 로직) |
| `frontend/src/lib/api.ts` | useStocksGroupAction | F-04 (API 호출) |
