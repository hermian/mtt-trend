# SPEC-MTT-002: 구현 계획 (Implementation Plan)

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-002 |
| 제목 | 데이터 파이프라인 완성 및 트렌드 대시보드 MVP |
| 상태 | Completed |
| 완료일 | 2026-03-14 |

---

## 구현 전략 (Implementation Strategy)

### 핵심 원칙

1. **데이터 우선**: 프론트엔드 수정 전 DB에 실제 데이터가 수집된 상태를 만든다.
2. **End-to-End 검증**: 각 마일스톤은 사용자가 화면에서 실제로 데이터를 볼 수 있는 상태로 끝난다.
3. **최소 변경**: 이미 구현된 SPEC-MTT-001 코드를 최대한 활용하고 꼭 필요한 부분만 수정한다.

### 변경 범위 분석

| 파일 | 변경 유형 | 우선순위 |
|------|-----------|---------|
| `backend/scripts/ingest.py` | 수정 (배치 처리 + 에러 복구) | Priority High |
| `backend/app/routers/themes.py` | 검증 및 소규모 수정 | Priority High |
| `backend/app/routers/stocks.py` | 검증 및 소규모 수정 | Priority High |
| `backend/app/main.py` | source 파라미터 검증 강화 | Priority High |
| `frontend/src/lib/api.ts` | 누락 API 함수 완성 | Priority High |
| `frontend/src/hooks/useThemes.ts` | API 연동 완성 | Priority High |
| `frontend/src/hooks/useStocks.ts` | API 연동 완성 | Priority High |
| `frontend/src/app/trend/page.tsx` | 날짜 초기화 로직 완성 | Priority High |
| `frontend/src/components/*` | 에러/로딩 상태 UI 보완 | Priority Medium |

---

## 마일스톤 (Milestones)

### 주요 목표 (Primary Goal): 데이터 수집 완료

**목적**: DB에 실제 데이터를 수집하여 백엔드 API가 정상 응답하도록 한다.

**작업 목록**:

1. **ingest.py 배치 처리 검증**
   - `--dir` 플래그로 디렉토리 전체 처리 지원 여부 확인
   - 없다면 디렉토리 순회 기능 추가
   - 파일 처리 순서: 날짜 오름차순 정렬

2. **에러 복구 로직 추가**
   - 개별 파일 파싱 실패 시 try/except로 건너뛰기
   - 실패 파일 목록 수집 후 최종 요약 출력

3. **77개 HTML 파일 일괄 수집 실행**
   - 실행: `python backend/scripts/ingest.py --dir backend/data/`
   - 성공/실패 카운트 확인

4. **수집 결과 검증**
   - SQLite에 테마 데이터 존재 확인
   - `SELECT COUNT(*) FROM theme_daily` 실행
   - 두 소스(`52w_high`, `mtt`) 데이터 존재 확인

**완료 기준**: `theme_daily` 테이블에 양 소스의 데이터가 각각 1건 이상 존재

---

### 이차 목표 (Secondary Goal): 백엔드 API 검증

**목적**: 모든 API 엔드포인트가 수집된 데이터를 올바르게 반환하는지 확인한다.

**작업 목록**:

1. **FastAPI 서버 기동 확인**
   - `uvicorn app.main:app --reload` 실행
   - `/docs` Swagger UI 접근 확인

2. **날짜 목록 API 검증**
   - `GET /api/dates?source=52w_high` 응답 확인
   - `GET /api/dates?source=mtt` 응답 확인
   - 응답 형식: `{ "dates": [...] }`

3. **테마 일별 API 검증**
   - `GET /api/themes/daily?date=2026-03-13&source=52w_high` 응답 확인
   - 빈 응답이면 해당 날짜 데이터 존재 여부 DB 직접 확인

4. **급등 테마 API 검증**
   - `GET /api/themes/surging?source=52w_high&threshold=10` 응답 확인
   - threshold 파라미터 타입 검증 (문자열 → 정수 변환)

5. **종목 API 검증**
   - `GET /api/stocks/persistent?source=52w_high` 응답 확인
   - `GET /api/stocks/group-action?source=52w_high` 응답 확인

6. **응답 스키마 일치 확인**
   - Pydantic 스키마(`schemas.py`)와 실제 응답 구조 일치 여부 검증
   - 불일치 시 스키마 또는 쿼리 수정

**완료 기준**: 모든 6개 엔드포인트가 200 OK와 올바른 JSON 구조 반환

---

### 최종 목표 (Final Goal): 프론트엔드 API 연동 완성

**목적**: 프론트엔드 컴포넌트가 실제 API 데이터를 화면에 표시한다.

**작업 목록**:

1. **api.ts 완성도 확인**
   - 모든 엔드포인트에 대한 함수 존재 여부 확인
   - `DataSource` 타입 사용 여부 확인
   - 누락된 함수가 있으면 추가

2. **useThemes.ts 완성**
   - `useThemes(date, source)` 훅이 `GET /api/themes/daily` 호출하는지 확인
   - `useSurgingThemes(threshold, source)` 훅 확인
   - `useThemeHistory(themeName, source)` 훅 확인

3. **useStocks.ts 완성**
   - `usePersistentStocks(source)` 훅 확인
   - `useGroupAction(source)` 훅 확인

4. **page.tsx 날짜 초기화 로직 완성**
   - 페이지 마운트 시 `GET /api/dates` 호출
   - 첫 번째 날짜 자동 선택
   - 소스 전환 시 날짜 초기화 및 재선택

5. **컴포넌트 에러/로딩 상태 UI**
   - 로딩 중: 스피너 또는 스켈레톤
   - 에러 발생: 에러 메시지 + 재시도 버튼
   - 데이터 없음: "데이터가 없습니다" 메시지

6. **End-to-End 동작 확인**
   - 브라우저에서 `http://localhost:3000/trend` 접속
   - 날짜 선택 → TopThemesBar 렌더링 확인
   - 소스 전환 → 데이터 갱신 확인

**완료 기준**: 브라우저에서 날짜를 선택하면 테마 바차트가 실제 데이터로 렌더링됨

---

### 선택 목표 (Optional Goal): UX 품질 개선

**목적**: MVP 완성 후 사용성을 향상시킨다.

**작업 목록**:

1. **Threshold UI 개선** (F-04 R-04-2)
   - 슬라이더 컴포넌트로 threshold 실시간 조절

2. **차트 인터랙션 개선**
   - TopThemesBar 클릭 시 ThemeTrendChart 업데이트 연동 확인

3. **날짜 선택 UI 개선**
   - 수집된 날짜만 선택 가능하도록 날짜 픽커 제한

---

## 기술적 접근 (Technical Approach)

### 백엔드 수정 최소화 전략

SPEC-MTT-001에서 이미 구현된 내용:
- `data_source` 컬럼 및 소스 감지 로직
- 모든 API에 `source` 파라미터 추가
- MTT 파서 (`_try_mtt_layout`)

이번 SPEC에서 새로 필요한 것:
- ingest.py의 `--dir` 배치 처리 기능 (없다면 추가)
- API 응답이 실제로 올바른지 검증 후 필요 시 수정

### 프론트엔드 수정 전략

TanStack Query v5 패턴 준수:
```typescript
// useThemes.ts 패턴
export function useThemes(date: string | null, source: DataSource) {
  return useQuery({
    queryKey: ['themes', 'daily', date, source],
    queryFn: () => api.getThemesDaily(date!, source),
    enabled: !!date,
  });
}
```

에러 바운더리 전략:
- TanStack Query의 `isError`, `error` 상태 활용
- 컴포넌트 레벨 에러 UI (전역 바운더리 불필요)

### 리스크 및 대응 방안

| 리스크 | 가능성 | 대응 방안 |
|--------|--------|-----------|
| ingest.py 파싱 실패율 높음 | Medium | 파싱 실패 로그 분석 후 파서 디버깅 |
| API 응답 스키마 불일치 | Medium | Swagger UI로 실제 응답 확인 후 스키마 수정 |
| 프론트엔드 훅 타입 오류 | Low | TypeScript strict 모드 체크 후 수정 |
| 빈 DB로 인한 프론트 에러 | Low | 주요 목표 완료 후 프론트 진행 |

---

## 구현 순서 (Dependency Order)

```
[주요 목표] ingest.py 검증 및 실행
        │
        ▼
[이차 목표] FastAPI 서버 기동 및 API 검증
        │
        ▼
[최종 목표] 프론트엔드 훅 완성 및 컴포넌트 연동
        │
        ▼
[선택 목표] UX 개선 (독립적으로 진행 가능)
```

---

## 관련 파일 목록

### 백엔드

- `backend/scripts/ingest.py` - HTML 파싱 및 DB 수집 CLI
- `backend/app/main.py` - FastAPI 앱 진입점, `/api/dates` 엔드포인트
- `backend/app/models.py` - SQLAlchemy ORM 모델 (SPEC-MTT-001 완성)
- `backend/app/schemas.py` - Pydantic 응답 스키마
- `backend/app/routers/themes.py` - 테마 관련 API 라우터
- `backend/app/routers/stocks.py` - 종목 관련 API 라우터
- `backend/app/database.py` - DB 세션 및 마이그레이션 (SPEC-MTT-001 완성)

### 프론트엔드

- `frontend/src/lib/api.ts` - Axios API 클라이언트
- `frontend/src/hooks/useThemes.ts` - 테마 데이터 훅
- `frontend/src/hooks/useStocks.ts` - 종목 데이터 훅
- `frontend/src/app/trend/page.tsx` - 트렌드 대시보드 페이지
- `frontend/src/components/TopThemesBar.tsx` - 상위 테마 바차트
- `frontend/src/components/ThemeTrendChart.tsx` - 테마 히스토리 차트
- `frontend/src/components/StrongStocksTable.tsx` - 지속 강세 종목 테이블
- `frontend/src/components/GroupActionTable.tsx` - 그룹 동시 행동 테이블
- `frontend/src/components/StockAnalysisTabs.tsx` - 탭 컨테이너

### 데이터

- `backend/data/*.html` - 수집 대상 원본 HTML 파일 (77개)
- `backend/db/trends.sqlite` - SQLite 데이터베이스
