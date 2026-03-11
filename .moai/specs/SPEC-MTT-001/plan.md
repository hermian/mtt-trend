# SPEC-MTT-001 구현 계획

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-001 |
| 상태 | IMPLEMENTED (소급 문서화) |
| 작성일 | 2026-03-11 |

> 이 문서는 이미 구현된 기능을 소급하여 문서화한 것입니다. 마일스톤은 구현이 진행된 실제 순서를 반영합니다.

---

## 구현 전략

### 접근 방식

기존 단일 소스 아키텍처를 **최소 침습적으로** 확장하는 전략을 선택했다.

핵심 원칙:
- **하위 호환성 우선**: 기존 52w_high 데이터와 API 동작을 변경하지 않음
- **점진적 확장**: DB 스키마 → 파서 → API → 프론트엔드 순서로 레이어별 적용
- **소스 격리**: 소스 구분자(`data_source`)를 모든 쿼리에 일관되게 적용

### 기술 선택 근거

| 결정 | 선택 | 이유 |
|------|------|------|
| 마이그레이션 방식 | 인라인 ALTER TABLE | Alembic 미도입 소규모 프로젝트, 멱등성 충족 |
| 소스 기본값 | `52w_high` | 기존 API 호출자 동작 유지 |
| 파서 우선순위 | MTT 소스 시 전용 파서 우선 | 정확도 우선, 폴백으로 범용 파서 유지 |
| UI 컴포넌트 | 세그먼트 토글 버튼 | 두 가지 선택지에 최적화된 UX |

---

## 구현 마일스톤 (완료 순서)

### 1단계: DB 스키마 확장 (우선순위 높음)

목표: `data_source` 컬럼을 두 테이블에 추가하여 소스 구분 기반 마련

작업 목록:
- [x] `models.py`에 `SOURCE_52W = "52w_high"`, `SOURCE_MTT = "mtt"` 상수 정의
- [x] `ThemeDaily.data_source` 컬럼 추가 (`NOT NULL DEFAULT '52w_high'`)
- [x] `ThemeStockDaily.data_source` 컬럼 추가 (`NOT NULL DEFAULT '52w_high'`)
- [x] `uq_theme_daily_date_name_src` 유니크 제약 조건 설정
- [x] `idx_td_source`, `idx_tsd_source` 인덱스 추가

### 2단계: 자동 마이그레이션 (우선순위 높음)

목표: 기존 DB를 손상 없이 신규 스키마로 업그레이드

작업 목록:
- [x] `database.py`의 `create_tables()`에 ALTER TABLE 마이그레이션 로직 추가
- [x] 예외 처리로 멱등성 보장 (이미 컬럼이 있으면 무시)
- [x] 기존 레코드에 `52w_high` 기본값 자동 적용 확인

### 3단계: MTT 파서 구현 (우선순위 높음)

목표: MTT HTML 형식을 정확하게 파싱하는 전용 파서 구현

작업 목록:
- [x] `_MTT_FILENAME_RE` 정규식으로 파일명 감지 패턴 정의
- [x] `detect_source_from_filename()` 함수 구현
- [x] `_MTT_STOCK_RE` 정규식으로 `종목명(RS/등락률%)` 파싱
- [x] `_parse_mtt_stock_tag()` 함수 구현
- [x] `_try_mtt_layout()` 함수 구현 (헤더 감지 + 컬럼 매핑 + 종목 파싱)
- [x] `parse_html()`에 소스별 파서 전략 분기 추가

### 4단계: API 소스 파라미터 추가 (우선순위 중간)

목표: 모든 API 엔드포인트에서 소스별 데이터 조회 가능

작업 목록:
- [x] `themes.py` - `/daily`, `/surging`, `/{name}/history` 엔드포인트에 `source` 파라미터 추가
- [x] `stocks.py` - `/persistent`, `/group-action` 엔드포인트에 `source` 파라미터 추가
- [x] `main.py` - `/api/dates` 엔드포인트에 `source` 파라미터 추가
- [x] 모든 DB 쿼리에 `.filter(... .data_source == source)` 조건 추가

### 5단계: 프론트엔드 통합 (우선순위 중간)

목표: 사용자가 두 데이터 소스를 전환할 수 있는 UI 구현

작업 목록:
- [x] `api.ts`에 `DataSource` 타입 정의 (`"52w_high" | "mtt"`)
- [x] 모든 API 함수에 `source: DataSource = "52w_high"` 파라미터 추가
- [x] 훅(hooks)에 `source` 파라미터 전파
- [x] `trend/page.tsx`에 `source` 상태 추가
- [x] 소스 토글 버튼 UI 구현 (세그먼트 컨트롤)
- [x] 소스 변경 시 날짜 초기화 및 최신 날짜 자동 선택 로직
- [x] 모든 하위 컴포넌트에 `source` prop 전달

---

## 아키텍처 설계

### 데이터 흐름

```
HTML 파일
  → detect_source_from_filename()  # 소스 자동 감지
  → parse_html(source=...)          # 소스별 파서 선택
  → DB 저장 (data_source 컬럼 포함)
  ↓
GET /api/...?source=mtt
  → DB 쿼리 (WHERE data_source = 'mtt')
  → JSON 응답
  ↓
프론트엔드 source 상태
  → API 호출 (source 파라미터 포함)
  → 차트/테이블 렌더링
```

### 소스 상수 관리

백엔드에서 소스 값을 상수로 관리하여 오타 방지:

```python
# backend/app/models.py
SOURCE_52W = "52w_high"
SOURCE_MTT = "mtt"
```

프론트엔드에서 타입으로 관리:

```typescript
// frontend/src/lib/api.ts
export type DataSource = "52w_high" | "mtt";
```

---

## 위험 및 대응

| 위험 | 영향도 | 대응 방안 | 상태 |
|------|--------|-----------|------|
| 기존 DB 마이그레이션 실패 | 높음 | try/except로 멱등성 보장 | 해결됨 |
| MTT HTML 구조 변경 | 중간 | 폴백 파서(flat_table 등) 유지 | 모니터링 필요 |
| API 기본값 변경으로 인한 기존 클라이언트 영향 | 높음 | 기본값 `52w_high` 유지 | 해결됨 |
| source 파라미터 유효성 미검증 | 낮음 | DB 쿼리 시 빈 결과 반환 | 허용 (Out of Scope) |

---

## 다음 단계 (향후 개선 과제)

- [ ] `source` 파라미터 유효성 검증 추가 (허용값 이외 입력 시 422 에러)
- [ ] Alembic 마이그레이션 도구 도입 검토
- [ ] 소스 목록 API(`/api/sources`) 추가 고려
- [ ] 두 소스 데이터 비교 뷰 기능 검토
