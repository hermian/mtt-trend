# mtt-trend 아키텍처 코드맵

52주 고점 테마 트렌드 분석 대시보드 프로젝트의 완전한 아키텍처 문서화입니다.

## 📚 문서 구성

### 1. **overview.md** (209줄)
**시스템 아키텍처 개요**

프로젝트의 전체적인 구조와 비전을 제시합니다.

- 시스템 개요 및 코어 목표
- 전체 아키텍처 다이어그램 (ASCII)
- 주요 데이터 흐름 (HTML → DB → API → UI)
- 주요 설계 패턴 (계층 분리, CORS, 캐싱)
- 시스템 경계 및 외부 인터페이스
- 핵심 설계 결정사항 (데이터베이스, 프레임워크 선택)
- 성능 최적화 및 확장성 고려사항

**사용 대상**: 신입 개발자, 프로젝트 리더, 아키텍처 이해 필요 시

---

### 2. **modules.md** (584줄)
**모듈 카탈로그**

모든 백엔드/프론트엔드 모듈의 역할과 책임을 명확히 정의합니다.

#### 백엔드 모듈 (7개)
1. **app/main.py** - FastAPI 애플리케이션 메인
   - FastAPI 인스턴스, CORS 설정, 라이프사이클 관리

2. **app/database.py** - SQLAlchemy 엔진 및 세션 관리
   - 데이터베이스 설정, Base 선언, create_tables()

3. **app/models.py** - ORM 데이터 모델
   - ThemeDaily, ThemeStockDaily 테이블 정의

4. **app/schemas.py** - Pydantic 응답 스키마
   - DatesResponse, Theme*, Stock* 검증 및 직렬화

5. **app/routers/themes.py** - 테마 엔드포인트
   - /daily, /surging, /{name}/history 구현

6. **app/routers/stocks.py** - 종목 엔드포인트
   - /persistent, /group-action 구현

7. **backend/scripts/ingest.py** - 데이터 수집 CLI
   - HTML 파싱, 데이터베이스 삽입

#### 프론트엔드 모듈 (11개)
1. **src/lib/api.ts** - API 클라이언트 및 타입
   - Axios 설정, TypeScript 인터페이스, API 함수

2. **src/hooks/useThemes.ts** - 테마 React Query 훅
   - useDates(), useThemes(), useThemeHistory()

3. **src/hooks/useStocks.ts** - 종목 React Query 훅
   - useStocksPersistent(), useStocksGroupAction()

4. **src/app/layout.tsx** - 루트 레이아웃
   - QueryClientProvider, Sidebar

5. **src/app/page.tsx** - 루트 페이지
   - /trend로 리다이렉트

6. **src/app/trend/page.tsx** - 메인 대시보드
   - 날짜 선택, 4가지 시각화 컴포넌트 조합

7-11. **차트 및 테이블 컴포넌트**
   - TopThemesBar, ThemeTrendChart, StockAnalysisTabs
   - StrongStocksTable, GroupActionTable

**사용 대상**: 기능 구현, 모듈 수정, 새로운 엔드포인트 추가 시

---

### 3. **dependencies.md** (450줄)
**의존성 그래프**

모든 모듈 간의 관계와 외부 패키지 의존성을 시각화합니다.

- 백엔드 모듈 간 관계도 (main.py → database.py → models.py)
- 프론트엔드 컴포넌트 트리 및 데이터 흐름
- 내부 모듈 관계 다이어그램 (강도, 순환 의존성)
- 크로스 계층 의존성 매트릭스
- 순환 의존성 분석 및 해결 방법
- 의존성 안정성 평가 (높음/중간/낮음)
- 외부 패키지 안정성 평가 (대체 가능성 포함)

| 백엔드 패키지 | 용도 |
|------------|------|
| fastapi | REST API 프레임워크 |
| sqlalchemy | ORM |
| pydantic | 데이터 검증 |
| uvicorn | ASGI 서버 |
| beautifulsoup4 | HTML 파싱 |

| 프론트엔드 패키지 | 용도 |
|-----------------|------|
| next | React 프레임워크 |
| @tanstack/react-query | 서버 상태 관리 |
| axios | HTTP 클라이언트 |
| recharts | 차트 라이브러리 |
| tailwindcss | 유틸리티 CSS |

**사용 대상**: 의존성 문제 해결, 리팩토링, 아키텍처 변경 시

---

### 4. **entry-points.md** (755줄)
**진입점 및 엔드포인트**

애플리케이션의 모든 시작점과 API 엔드포인트를 정의합니다.

#### 백엔드 진입점
1. **FastAPI 애플리케이션** (uvicorn)
   - 시작 순서: 서버 → 앱 → lifespan → CORS → 라우터

2. **데이터 수집 CLI** (ingest.py)
   - 명령어, 매개변수, 처리 단계

#### REST API 엔드포인트 (6개)

| 엔드포인트 | 메서드 | 설명 | 응답 |
|-----------|--------|------|------|
| /api/dates | GET | 수집된 모든 날짜 | DatesResponse |
| /api/themes/daily | GET | 일일 테마 데이터 | ThemeDailyResponse |
| /api/themes/surging | GET | 급등 테마 | ThemeSurgingResponse |
| /api/themes/{name}/history | GET | 테마 이력 | ThemeHistoryResponse |
| /api/stocks/persistent | GET | 지속 종목 | PersistentStocksResponse |
| /api/stocks/group-action | GET | 그룹액션 | GroupActionResponse |
| /health | GET | 상태 확인 | {"status": "ok"} |

#### 프론트엔드 진입점
1. **Next.js 애플리케이션**
   - pnpm dev (localhost:3000)
   - pnpm build / start

2. **라우트 진입점**
   - / (루트, /trend로 리다이렉트)
   - /trend (메인 대시보드)

#### 이벤트 핸들러
- 애플리케이션 라이프사이클 (lifespan)
- React useEffect 훅
- React Query 자동 페칭 이벤트

#### 사용자 상호작용 흐름
1. 날짜 선택 → selectedDate 변경 → 쿼리 재실행
2. 테마 멀티선택 → useThemeHistory 다중 호출
3. 탭 전환 → 다른 테이블 표시

**사용 대상**: API 테스트, 클라이언트 통합, 웹훅 추가 시

---

### 5. **data-flow.md** (794줄)
**데이터 흐름**

데이터가 시스템을 통과하는 경로와 변환 단계를 상세히 설명합니다.

#### 종합 데이터 파이프라인
HTML → BeautifulSoup → Python dict → Pydantic → SQLAlchemy → SQLite

#### 요청 생명주기
1. 사용자 액션 (날짜 선택)
2. React Query 훅 재실행
3. API HTTP 요청
4. 백엔드 SQLAlchemy 쿼리
5. JSON 응답 직렬화
6. 프론트엔드 JSON 파싱
7. 캐시 저장
8. 컴포넌트 리렌더
9. Recharts 차트 렌더링
10. UI 표시

#### 상태 관리 패턴
- React Query (서버 상태): 캐시 키, staleTime, gcTime
- React 로컬 상태: selectedDate, selectedThemes, activeTab

#### 데이터 변환 단계
| 단계 | 입력 | 변환 | 출력 |
|------|------|------|------|
| DB | Row 객체 | SQLAlchemy ORM | ThemeDaily |
| API | ThemeDaily | Pydantic 매핑 | ThemeDailyItem |
| 직렬화 | ThemeDailyItem | model_dump_json() | JSON |
| 파싱 | JSON 문자열 | JSON.parse() | JS 객체 |
| 검증 | JS 객체 | TypeScript 타입 | 타입 안전 |
| 캐시 | 타입 안전 | React Query | 캐시 엔트리 |
| 컴포넌트 | 캐시 | useState | React 상태 |
| 차트 | React 상태 | 포맷 변환 | 차트 데이터 |
| 렌더링 | 차트 데이터 | SVG 생성 | DOM |

#### 특수 데이터 변환
- 5일 이동평균 계산 (급등 테마)
- 지속 종목 필터링 (GROUP BY + HAVING)
- 그룹액션 데이터 구성

#### 캐싱 및 최적화 전략
- React Query 캐시 정책 (staleTime, gcTime)
- 배경 갱신 (Background Refetch)
- 데이터베이스 인덱스 활용

#### 데이터 일관성
- ACID 보장
- 유니크 제약조건 (date + theme_name)
- UPSERT 연산 (중복 처리)

**사용 대상**: 성능 최적화, 캐싱 전략 개선, 데이터 검증 로직 추가 시

---

## 🚀 빠른 시작

### 새 개발자 온보딩
1. **overview.md** 읽기 - 전체 그림 이해
2. **modules.md** 읽기 - 모듈별 역할 파악
3. **entry-points.md** 참고 - API 문서 확인

### 버그 수정
1. **entry-points.md** - 영향받는 엔드포인트 확인
2. **modules.md** - 관련 모듈 식별
3. **data-flow.md** - 데이터 흐름 추적

### 새 기능 추가
1. **overview.md** - 아키텍처 제약 확인
2. **modules.md** - 새 모듈 또는 확장 위치 결정
3. **dependencies.md** - 순환 의존성 검증
4. **entry-points.md** - 새 엔드포인트 설계
5. **data-flow.md** - 데이터 흐름 통합

### 성능 최적화
1. **data-flow.md** - 캐싱 전략 검토
2. **dependencies.md** - 의존성 효율성 평가
3. **entry-points.md** - 쿼리 파라미터 최적화

---

## 📊 통계

| 파일 | 줄 수 | 초점 |
|------|-------|------|
| overview.md | 209 | 전체 아키텍처 |
| modules.md | 584 | 18개 모듈 상세 설명 |
| dependencies.md | 450 | 모듈 간 관계 |
| entry-points.md | 755 | 진입점 & API |
| data-flow.md | 794 | 데이터 흐름 & 상태 관리 |
| **합계** | **2,792** | **완전한 시스템 문서** |

---

## 🎯 핵심 개념

### 아키텍처 패턴
- **계층 분리**: 프레젠테이션 → API → 비즈니스 로직 → 데이터 접근 → 영속성
- **의존성 주입**: FastAPI Depends, React Context
- **캐싱 전략**: React Query + 데이터베이스 인덱스

### 데이터 관리
- **ORM 사용**: SQLAlchemy로 SQL 추상화
- **타입 안정성**: Pydantic (백엔드), TypeScript (프론트엔드)
- **상태 관리**: React Query (서버), useState (UI)

### 성능 최적화
- **인덱스 활용**: date, stock_name, theme_name
- **캐싱 레이어**: staleTime 60초, gcTime 300초
- **배경 갱신**: 윈도우 포커스 시 자동 새로고침

---

## 📝 문서 업데이트 안내

코드 변경 시 해당 문서 업데이트:

- **새 모듈 추가** → modules.md, dependencies.md
- **새 엔드포인트** → entry-points.md, data-flow.md
- **아키텍처 변경** → overview.md, dependencies.md
- **데이터 흐름 변경** → data-flow.md, modules.md
- **의존성 추가** → dependencies.md

---

**마지막 업데이트**: 2026년 3월 11일
**버전**: 1.0.0
**언어**: 한국어 (ko)

이 문서는 mtt-trend 프로젝트의 완전한 아키텍처를 한국어로 설명합니다.
모든 개발 활동에서 참고하세요.
