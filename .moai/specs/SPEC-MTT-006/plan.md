# SPEC-MTT-006: 그룹 액션 탐지 기능 고도화

## SPEC 후보 분석

연구 문서(research.md)에서 식별된 개선 기회를 바탕으로 3개의 SPEC 후보를 도출했습니다.

### 후보 1: SPEC-MTT-006 - 성능 최적화 및 파라미터화

| 항목 | 값 |
|------|-----|
| 우선순위 | High |
| 복잡도 | Medium |
| 영향 범위 | 백엔드 + 프론트엔드 |
| 의존 SPEC | 없음 |
| 설명 | 하드코딩된 매직 넘버 파라미터화, 쿼리 성능 최적화 |

**포함 기능:**
- F-01: 시간 윈도우 파라미터화 (3일 → 1~7일 가변)
- F-02: RS 변화 임계값 파라미터화 (0 → 가변)
- F-03: 상태 분류 임계값 파라미터화 (5 → 가변)
- NFR-01: 데이터베이스 인덱스 추가

### 후보 2: SPEC-MTT-007 - 조건 조합 유연성 확보

| 항목 | 값 |
|------|-----|
| 우선순위 | Medium |
| 복잡도 | Medium |
| 영향 범위 | 백엔드 + 프론트엔드 |
| 의존 SPEC | SPEC-MTT-006 |
| 설명 | AND/OR 조건 선택, 고급 필터링 UI |

**포함 기능:**
- F-01: 조건 조합 유형 선택 (AND/OR/Custom)
- F-02: 다차원 필터링 UI
- F-03: RS 점수 범위 필터

### 후보 3: SPEC-MTT-008 - 히스토리 분석 및 상태 시각화

| 항목 | 값 |
|------|-----|
| 우선순위 | Low |
| 복잡도 | High |
| 영향 범위 | 백엔드 + 프론트엔드 |
| 의존 SPEC | SPEC-MTT-006, SPEC-MTT-007 |
| 설명 | N일간 추세 분석, 상태 변화 시각화 |

**포함 기능:**
- F-01: N일간 추세 분석 로직
- F-02: 상태 변화 히스토리 차트
- F-03: 종목 상세 정보 모달

---

## 선정된 SPEC: SPEC-MTT-006

**선정 근거:**

1. **즉시 적용 가능**: 연구 문서에서 "즉시 적용 가능 개선사항"으로 명시
2. **높은 ROI**: 적은 노력으로 큰 유연성 확보
3. **기반 작업**: 후속 SPEC(007, 008)의 전제 조건
4. **하위 호환성**: 기본값으로 기존 동작 보장

---

## EARS 요구사항

### F-01: 시간 윈도우 파라미터화

**WHEN** 사용자가 그룹 액션 탐지를 요청하면, **THEN** 시스템은 **SHALL** `timeWindow` 파라미터를 통해 신규 등장 판정 기간을 1~7일 범위에서 설정할 수 있게 한다.

- 기본값: 3일 (기존 동작 보장)
- 범위: 1일 ~ 7일
- 검증: 범위 외 값은 400 Bad Request

**API 변경:**
```
GET /api/stocks/group-action?date=YYYY-MM-DD&source=52w_high&timeWindow=3
```

### F-02: RS 변화 임계값 파라미터화

**WHEN** 사용자가 그룹 액션 탐지를 요청하면, **THEN** 시스템은 **SHALL** `rsThreshold` 파라미터를 통해 테마 RS 상승 판정 기준을 설정할 수 있게 한다.

- 기본값: 0 (기존 동작: 단순 상승 여부)
- 범위: -10 ~ +20
- 동작: `theme_rs_change > rsThreshold` 조건 적용

**API 변경:**
```
GET /api/stocks/group-action?date=YYYY-MM-DD&source=52w_high&rsThreshold=0
```

### F-03: 상태 분류 임계값 파라미터화

**WHEN** 프론트엔드에서 상태를 분류하면, **THEN** 시스템은 **SHALL** 백엔드에서 전달받은 `statusThreshold` 값을 기준으로 4가지 상태를 분류한다.

- 기본값: 5 (기존 동작)
- 분류 로직:
  - `new_theme`: `theme_rs_change === null`
  - `new`: `theme_rs_change > statusThreshold`
  - `returning`: `theme_rs_change < -statusThreshold`
  - `neutral`: 그 외

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

### F-04: UI 파라미터 컨트롤

**WHEN** 사용자가 그룹 액션 테이블을 조회하면, **THEN** 시스템은 **SHALL** 다음 파라미터 조절 UI를 제공한다.

- 시간 윈도우 슬라이더 (1~7일)
- RS 임계값 슬라이더 (-10~+20)
- 상태 임계값 슬라이더 (1~20)

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

---

### NFR-01: 데이터베이스 인덱스 최적화

**THE** 시스템은 **SHALL** `first_seen_date` 기반 조회 성능을 위해 다음 인덱스를 추가한다.

```sql
CREATE INDEX IF NOT EXISTS idx_stock_first_seen
ON theme_stock_daily(stock_name, date, data_source);
```

**성능 목표:**
- 기존: ~500ms (first_seen 서브쿼리)
- 목표: ~100ms (인덱스 활용)

### NFR-02: API 응답 시간

**WHEN** 그룹 액션 API가 호출되면, **THEN** 시스템은 **SHALL** 500ms 이내에 응답을 반환한다.

### NFR-03: 하위 호환성

**WHEN** 파라미터 없이 API가 호출되면, **THEN** 시스템은 **SHALL** 기존 SPEC-MTT-002와 동일한 결과를 반환한다.

---

## 구현 계획

### 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 백엔드 프레임워크 | FastAPI | 0.109.2 |
| ORM | SQLAlchemy | 2.0.28 |
| 데이터 검증 | Pydantic | 2.6.1 |
| 프론트엔드 프레임워크 | Next.js | 14.1.0+ |
| UI 라이브러리 | React | 18.2.0+ |
| 상태 관리 | TanStack Query | 5.17+ |
| 스타일링 | Tailwind CSS | 3.4.1 |
| 테스트 (백엔드) | pytest | 7.4+ |
| 테스트 (프론트엔드) | Jest | 29.0+ |

### 참고 구현

**SPEC-MTT-003 (신규 급등 테마 탐지):**

| 파일 | 라인 | 참고 포인트 |
|------|------|------------|
| `backend/app/routers/themes.py` | 120-145 | threshold 파라미터 처리 패턴 |
| `frontend/src/app/trend/_components/SurgingThemesCard.tsx` | 50-80 | 슬라이더 UI 구현 |
| `frontend/src/hooks/useThemes.ts` | 45-60 | 파라미터화된 훅 사용 |

**SPEC-MTT-005 (테마 RS 추이 차트):**

| 파일 | 라인 | 참고 포인트 |
|------|------|------------|
| `frontend/src/app/trend/_components/ThemeTrendChart.tsx` | 30-60 | 상태 관리 패턴 (Set 사용) |
| `frontend/src/app/trend/_components/ThemeTrendChart.tsx` | 80-110 | 파라미터 변경 시 재조회 패턴 |

### 작업 분해

#### Phase 1: 백엔드 API 확장 (우선순위 High)

| 작업 | 파일 | 설명 |
|------|------|------|
| B-1 | `backend/app/routers/stocks.py` | timeWindow, rsThreshold 파라미터 추가 |
| B-2 | `backend/app/routers/stocks.py` | _recent_dates 함수 파라미터화 |
| B-3 | `backend/app/schemas.py` | GroupActionResponse 스키마 확장 |
| B-4 | `backend/app/database.py` | 인덱스 생성 스크립트 추가 |
| B-5 | `backend/tests/test_api_group_action.py` | 파라미터화 테스트 작성 |

#### Phase 2: 프론트엔드 UI 확장 (우선순위 High)

| 작업 | 파일 | 설명 |
|------|------|------|
| F-1 | `frontend/src/lib/api.ts` | API 함수 파라미터 추가 |
| F-2 | `frontend/src/hooks/useStocks.ts` | useStocksGroupAction 훅 확장 |
| F-3 | `frontend/src/app/trend/_components/GroupActionTable.tsx` | 슬라이더 UI 추가 |
| F-4 | `frontend/src/app/trend/_components/GroupActionTable.tsx` | 상태 분류 로직 파라미터화 |
| F-5 | `frontend/src/app/trend/_components/__tests__/GroupActionTable.test.tsx` | 파라미터화 테스트 |

#### Phase 3: 통합 테스트 및 검증 (우선순위 Medium)

| 작업 | 설명 |
|------|------|
| T-1 | E2E 테스트: 파라미터 변경 시 API 재호출 검증 |
| T-2 | 성능 테스트: 인덱스 적용 전후 비교 |
| T-3 | 하위 호환성 테스트: 기본값 호출 시 기존 결과 일치 확인 |

### 작업 순서

```
Phase 1 (백엔드)
    B-1 → B-2 → B-3 → B-5 → B-4
           ↓
Phase 2 (프론트엔드)
    F-1 → F-2 → F-3 → F-4 → F-5
           ↓
Phase 3 (통합)
    T-1 → T-2 → T-3
```

---

## 리스크 및 완화 전략

### R-01: API 계약 변경으로 인한 프론트엔드 호환성

| 항목 | 내용 |
|------|------|
| 위험 | 새 파라미터가 기존 프론트엔드 호출에 영향 |
| 확률 | 낮음 (기본값으로 기존 동작 보장) |
| 영향 | 중간 |
| 완화 | 모든 파라미터에 기본값 설정, 하위 호환성 테스트 추가 |

### R-02: 인덱스 추가로 인한 DB 크기 증가

| 항목 | 내용 |
|------|------|
| 위험 | 새 인덱스로 인한 스토리지 사용량 증가 |
| 확률 | 높음 |
| 영향 | 낮음 (SQLite 로컬 개발 환경) |
| 완화 | 인덱스 크기 모니터링, 선택적 인덱스 적용 |

### R-03: 파라미터 조합에 따른 결과 변화

| 항목 | 내용 |
|------|------|
| 위험 | 사용자가 파라미터 조합을 변경 시 예상치 못한 결과 |
| 확률 | 중간 |
| 영향 | 중간 |
| 완화 | UI에 현재 설정값 표시, 기본값 복원 버튼 제공 |

### R-04: Recharts 성능 (대량 데이터)

| 항목 | 내용 |
|------|------|
| 위험 | 시간 윈도우 확대 시 데이터 증가로 렌더링 지연 |
| 확률 | 낮음 (현재 데이터 규모) |
| 영향 | 중간 |
| 완화 | 데이터 개수 제한, 가상화 검토 (후속 SPEC) |

---

## 기술적 제약사항

### Recharts 버전

- 현재: 2.10.4
- 제약: 슬라이더 컴포넌트는 Recharts 외부 (HTML range input) 사용
- 호환성: 문제 없음

### React/Next.js 버전 호환성

- Next.js: 14.1.0+
- React: 18.2.0+
- TanStack Query: 5.17+
- 제약: 없음 (모든 기능 호환)

### 백엔드 API 호환성

- FastAPI: 0.109.2
- Pydantic: 2.6.1
- 제약: Query 파라미터 기본값 설정으로 하위 호환 보장

### 데이터베이스 마이그레이션

- 필요 여부: 아니요 (CREATE INDEX IF NOT EXISTS 사용)
- 백업 권장: 인덱스 추가 전 DB 백업

---

## 수락 기준 (Acceptance Criteria)

### AC-01: 시간 윈도우 파라미터

- [ ] `timeWindow=1` 호출 시 1일 내 등장 종목만 반환
- [ ] `timeWindow=7` 호출 시 7일 내 등장 종목만 반환
- [ ] 기본값(`timeWindow` 생략) 시 기존 3일 동작과 동일

### AC-02: RS 임계값 파라미터

- [ ] `rsThreshold=5` 호출 시 RS 변화량 > 5인 종목만 반환
- [ ] `rsThreshold=-5` 호출 시 RS 변화량 > -5인 종목만 반환
- [ ] 기본값(`rsThreshold` 생략) 시 기존 0 임계값과 동일

### AC-03: UI 파라미터 컨트롤

- [ ] 시간 윈도우 슬라이더 조작 시 API 재호출
- [ ] RS 임계값 슬라이더 조작 시 API 재호출
- [ ] 상태 임계값 변경 시 테이블 즉시 갱신 (API 호출 없음)

### AC-04: 성능

- [ ] 그룹 액션 API 응답 시간 < 500ms
- [ ] 인덱스 적용 후 응답 시간 < 100ms (목표)

### AC-05: 하위 호환성

- [ ] 파라미터 없는 호출 결과 == 기존 결과
- [ ] 기존 프론트엔드 코드 변경 없이 동작

---

## 추적성 (Traceability)

| 태그 | 참조 |
|------|------|
| SPEC-MTT-006 | 본 문서 |
| SPEC-MTT-003 | SurgingThemesCard threshold 슬라이더 패턴 참조 |
| SPEC-MTT-005 | ThemeTrendChart 상태 관리 패턴 참조 |
| research.md | Section 4.2 (하드코딩된 값), Section 5.1 (F-01, F-02) |
