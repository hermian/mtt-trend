---
id: SPEC-MTT-018
version: "1.0"
status: draft
created: "2026-03-17"
updated: "2026-03-17"
author: Hosung Kim
priority: medium
issue_number: 0
tags: [docs, frontend, userguide, html]
---

# SPEC-MTT-018: 사용자 가이드 문서 생성 및 HTML 웹 서비스

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-17 | Hosung Kim | 초기 작성 |

## 1. 환경 (Environment)

### 1.1 현재 상태

- **프로젝트**: 테마 트렌드 대시보드 (한국 주식 테마 분석)
- **백엔드**: Python FastAPI (포트 8000), 현재 정적 파일 서빙 없음
- **프론트엔드**: Next.js 14 App Router (포트 3000)
- **기존 문서**: `README.md` (프로젝트 개요 및 빠른 시작 가이드)
- **SPEC 문서**: SPEC-MTT-001 ~ SPEC-MTT-017 (기능별 명세)
- **프로덕트 정의**: `.moai/project/product.md` (핵심 기능, 타겟 사용자)
- **기술 스택**: `.moai/project/tech.md` (API 엔드포인트, 환경 변수 등)
- **프로젝트 구조**: `.moai/project/structure.md` (디렉토리/파일 역할)

### 1.2 현재 프론트엔드 라우트 구조

```
frontend/src/app/
  layout.tsx        # 루트 레이아웃 (Sidebar 포함)
  page.tsx          # 홈 페이지 (대시보드 개요)
  providers.tsx     # React Query Provider
  trend/
    page.tsx        # 테마 분석 메인 페이지
    _components/    # 테마 분석 서브 컴포넌트 (10개)
```

### 1.3 사용자 가이드 부재

- 최종 사용자(트레이더, 투자자)를 위한 기능별 사용법 문서가 없음
- `README.md`는 개발자 대상이며 설치/실행 위주
- 웹 브라우저에서 바로 접근 가능한 가이드 페이지가 없음

## 2. 가정 (Assumptions)

- A1: 사용자 가이드는 한국어로 작성하며, 한국 주식 투자자가 주요 독자이다
- A2: Next.js App Router의 페이지로 가이드를 제공하는 것이 기존 스택과 가장 일관성 있다
- A3: Markdown 콘텐츠를 Next.js 페이지에서 렌더링하여 스타일 일관성을 유지할 수 있다
- A4: `README.md`, `product.md`, 기존 SPEC 문서들에서 기능 정보를 추출할 수 있다
- A5: 사이드바 네비게이션에 가이드 링크를 추가하여 접근성을 높일 수 있다

## 3. 요구사항 (Requirements)

### 모듈 1: UserGuide.md 문서 생성

**REQ-MTT-018-01** (Ubiquitous):
UserGuide.md 파일은 프로젝트 루트(`/UserGuide.md`)에 위치해야 한다.

**REQ-MTT-018-02** (Ubiquitous):
UserGuide.md는 다음 섹션을 포함해야 한다:
- 소개: 대시보드 개요 및 목적
- 시작하기: 접속 방법 및 화면 구성 설명
- 주요 기능 사용법: 기능별 상세 가이드
- FAQ: 자주 묻는 질문과 답변
- 문제 해결: 일반적인 문제와 해결 방법

**REQ-MTT-018-03** (Ubiquitous):
주요 기능 사용법 섹션은 다음 기능을 각각 설명해야 한다:
1. 데이터 소스 전환 (52주 신고가 / MTT 종목)
2. 테마별 일일 RS 집계 조회
3. 급등 테마 탐지 및 확인
4. 테마 RS 시계열 추이 분석 (차트)
5. 지속 강세 종목 탐지
6. 그룹 액션 탐지
7. 교집합 추천 (SPEC-MTT-012)

**REQ-MTT-018-04** (Ubiquitous):
UserGuide.md는 한국어로 작성되어야 한다. 기술 용어(RS, MTT 등)는 원어를 병기한다.

### 모듈 2: HTML 변환 및 웹 서비스

**REQ-MTT-018-05** (Event-Driven):
WHEN 사용자가 `/guide` URL에 접근하면 THEN 시스템은 사용자 가이드를 HTML 형식으로 표시해야 한다.

**REQ-MTT-018-06** (Ubiquitous):
가이드 페이지는 기존 대시보드와 동일한 레이아웃(사이드바, 헤더)을 사용해야 한다.

**REQ-MTT-018-07** (Ubiquitous):
가이드 페이지는 Markdown 콘텐츠를 HTML로 변환하여 렌더링해야 한다. Tailwind CSS 기반의 타이포그래피 스타일을 적용한다.

**REQ-MTT-018-08** (State-Driven):
IF 가이드 콘텐츠가 길어질 경우 THEN 시스템은 목차(Table of Contents)를 제공하여 빠른 탐색을 지원해야 한다.

### 모듈 3: 네비게이션 통합

**REQ-MTT-018-09** (Event-Driven):
WHEN 사이드바가 렌더링되면 THEN "사용자 가이드" 메뉴 항목이 표시되어야 한다.

**REQ-MTT-018-10** (Ubiquitous):
사이드바의 "사용자 가이드" 메뉴 항목은 `/guide` 라우트로 이동해야 한다.

### 모듈 4: README.md 업데이트

**REQ-MTT-018-11** (Ubiquitous):
README.md에 사용자 가이드 링크 및 설명 섹션을 추가해야 한다.

### 모듈 5: 모바일 반응형 지원

**REQ-MTT-018-12** (Ubiquitous):
가이드 페이지는 모바일 환경에서도 읽기 편한 반응형 레이아웃을 제공해야 한다.

**REQ-MTT-018-13** (Unwanted):
가이드 페이지는 외부 CDN이나 추가 서버 의존성을 도입하지 않아야 한다.

## 4. 기술 결정 (Specifications)

### 4.1 HTML 서빙 방식: Next.js 페이지 (Option A 선택)

**선택 근거:**
- 기존 레이아웃(사이드바, 헤더, 모바일 반응형)을 자동으로 상속
- Tailwind Typography 플러그인(`@tailwindcss/typography`)으로 Markdown 스타일링
- 별도의 정적 HTML 생성 파이프라인 불필요
- FastAPI에 StaticFiles 마운트 추가 불필요 (백엔드 변경 최소화)

**구현 방식:**
- `frontend/src/app/guide/page.tsx` 생성 (Next.js App Router 페이지)
- 프로젝트 루트의 `UserGuide.md` 파일을 빌드 시점 또는 런타임에 읽어 Markdown을 HTML로 변환
- `react-markdown` + `remark-gfm` 라이브러리 사용
- `@tailwindcss/typography`의 `prose` 클래스로 타이포그래피 적용

**비교 대안:**
| 방식 | 장점 | 단점 |
|------|------|------|
| **A: Next.js 페이지 (선택)** | 레이아웃 상속, 일관된 UX | 프론트엔드 의존성 추가 |
| B: FastAPI StaticFiles | 백엔드에서 독립 서빙 | 레이아웃 불일치, 별도 HTML 빌드 필요 |
| C: Next.js HTML import | 정적 HTML 직접 로드 | 스타일 관리 어려움, 레이아웃 불일치 |

### 4.2 Markdown 파싱 라이브러리

- `react-markdown`: React 컴포넌트로 Markdown 렌더링
- `remark-gfm`: GitHub Flavored Markdown 지원 (테이블, 체크리스트 등)
- `@tailwindcss/typography`: Tailwind 기반 타이포그래피 스타일

### 4.3 목차(TOC) 생성

- Markdown 헤딩(##, ###)을 파싱하여 자동 목차 생성
- 클릭 시 해당 섹션으로 스크롤 이동
- 사이드 패널 또는 페이지 상단에 목차 배치

## 5. 추적성 (Traceability)

| 요구사항 ID | 관련 파일 | 설명 |
|------------|----------|------|
| REQ-MTT-018-01 | `/UserGuide.md` | 사용자 가이드 문서 |
| REQ-MTT-018-05~08 | `frontend/src/app/guide/page.tsx` | 가이드 웹 페이지 |
| REQ-MTT-018-09~10 | `frontend/src/app/_components/Sidebar.tsx` | 사이드바 메뉴 추가 |
| REQ-MTT-018-11 | `/README.md` | README 업데이트 |
| REQ-MTT-018-12 | `frontend/src/app/guide/page.tsx` | 모바일 반응형 |
| REQ-MTT-018-13 | - | 외부 의존성 금지 제약 |
