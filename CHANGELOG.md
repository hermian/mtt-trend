# 변경 로그

모든 중요한 변경 사항은 이 파일에 기록됩니다.

## [1.0.0] - 2026-03-14

### 추가된 기능

#### 데이터 파이프라인 완성 (F-01)
- `backend/scripts/ingest.py`에 `--dir` 플래그 구현
- 77개 HTML 파일 배치 처리 지원
  - 총 3,358 테마 데이터 수집
  - 총 34,830 종목 데이터 수집
- MTT 파서 개선으로 `52w_high` 파일도 처리 가능
- 테스트 커버리지: 12개 테스트 케이스

#### 백엔드 API 검증 (F-02)
- `/api/dates` 엔드포인트 테스트 완료
- 소스별 날짜 조회 기능 검증
- 테스트 커버리지: 5개 테스트 케이스

#### 모든 API 엔드포인트 구현 (F-03~F-05)
- **테마 관련 API**:
  - `GET /api/themes/daily` - 일별 상위 테마 데이터
  - `GET /api/themes/surging` - 급등 테마 목록 (5일 평균 대비 상승)
  - `GET /api/themes/{name}/history` - 테마 히스토리 시계열 데이터
- **종목 관련 API**:
  - `GET /api/stocks/persistent` - 지속 강세 종목 탐지 (N일 중 M회 이상 등장)
  - `GET /api/stocks/group-action` - 그룹 액션 종목 탐지 (신규 등장 + RS 상승)
- **공통 API**:
  - `GET /api/dates` - 처리된 날짜 목록 조회
  - `GET /health` - 서버 상태 확인
- **다중 데이터 소스 지원**:
  - `52w_high`: 52주 신고가 데이터
  - `mtt`: MTT 템플릿 데이터

#### 프론트엔드 연동 (F-03~F-05)
- `frontend/src/lib/api.ts` 완성 - 모든 API 엔드포인트 TypeScript 정의
- `frontend/src/hooks/useThemes.ts` 완성 - React Query 기반 테마 데이터 훅
- `frontend/src/hooks/useStocks.ts` 완성 - 종목 데이터 훅 구현
- `frontend/src/app/trend/page.tsx` 날짜 초기화 로직 완성

#### 데이터 모델 정의
- **Pydantic 스키마** (`backend/app/schemas.py`):
  - `ThemeDailyItem` - 일별 테마 데이터 모델
  - `ThemeSurgingItem` - 급등 테마 데이터 모델
  - `ThemeHistoryItem` - 테마 히스토리 데이터 모델
  - `PersistentStockItem` - 지속 강세 종목 모델
  - `GroupActionItem` - 그룹 액션 종목 모델
- **TypeScript 인터페이스** (`frontend/src/lib/api.ts`):
  - 프론트엔드와 백엔드 간 데이터 타입 일치 보장
  - API 응답 데이터 구조 명확화

#### API 문서화
- **OpenAPI/Swagger 자동 생성** - FastAPI 기반 자동 문서화
- **자세한 API 문서** (`API-DOCUMENTATION.md`):
  - 모든 엔드포인트 상세 설명
  - 요청/응답 예시
  - 데이터 모델 문서
  - 오류 처리 가이드
  - 프론트엔드 통합 예시

### 기술 개선

#### 성능 최적화
- 데이터베이스 인덱스 최적화 (`ThemeDaily`, `ThemeStockDaily`)
- 쿼리 튜닝을 통한 응답 속도 향상
- 중복 데이터 계산 제거

#### 에러 핸들링
- 체계적인 HTTP 상태 코드 반환
- 명확한 에러 메시지 제공
- 데이터 없음 시의 안전한 처리

#### 코드 품질
- **Python**: type hints 적용, docstring 추가
- **TypeScript**: strict mode 활성화, 명시적 타입 정의
- **테스트**: pytest 기반 통합 테스트 커버리지 확보

### 문서화

#### 프로젝트 문서
- `API-DOCUMENTATION.md` - 완전한 API 참조 문서
- `README.md` - 최신 설정 및 사용법 정보 업데이트
- 데이터 수집 가이드 추가

#### 개발자 가이드
- 로컬 개발 환경 설정 절차
- API 테스트 및 디버깅 방법
- Docker 배포 가이드
- 프론트엔드 통합 예시

---

## [0.1.0] - 2026-03-13

### 초기 개발

- 프로젝트 초기화
- 기술 스택 선택 (FastAPI + Next.js)
- 기본 프로젝트 구조 설정
- 개발 환경 구축

---

## [0.0.1] - 2026-03-12

- 프로젝트 계획 수립
- SPEC-MTT-001 작성
- 초기 아키텍처 설계