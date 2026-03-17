---
id: SPEC-MTT-018
type: plan
version: "1.0"
created: "2026-03-17"
updated: "2026-03-17"
author: Hosung Kim
---

# SPEC-MTT-018 구현 계획: 사용자 가이드 문서 생성 및 HTML 웹 서비스

## 1. 구현 접근 방식

### 1.1 전체 전략

UserGuide.md를 프로젝트 루트에 생성하고, Next.js App Router를 활용하여 `/guide` 경로에서 Markdown을 HTML로 렌더링하는 페이지를 구현한다. 기존 레이아웃(사이드바, 모바일 헤더)을 그대로 상속하여 일관된 UX를 제공한다.

### 1.2 기술 결정 요약

| 결정 항목 | 선택 | 근거 |
|----------|------|------|
| HTML 서빙 방식 | Next.js 페이지 (`/guide`) | 레이아웃 상속, 일관된 UX |
| Markdown 렌더링 | `react-markdown` + `remark-gfm` | React 생태계 표준 |
| 스타일링 | `@tailwindcss/typography` | 기존 Tailwind 스택 활용 |
| 목차 생성 | 헤딩 파싱 기반 자동 생성 | 긴 문서 탐색 지원 |

## 2. 마일스톤

### Primary Goal: UserGuide.md 문서 작성

**작업 내용:**
- 프로젝트 루트에 `UserGuide.md` 파일 생성
- `README.md`, `product.md`, SPEC 문서들을 참고하여 종합적인 사용자 가이드 작성
- 섹션: 소개, 시작하기, 주요 기능 사용법 (7개 기능), FAQ, 문제 해결

**관련 요구사항:** REQ-MTT-018-01, REQ-MTT-018-02, REQ-MTT-018-03, REQ-MTT-018-04

### Secondary Goal: Next.js 가이드 페이지 구현

**작업 내용:**
1. 프론트엔드 의존성 추가
   - `react-markdown`: Markdown to React 컴포넌트 변환
   - `remark-gfm`: GFM (테이블, 체크리스트) 지원
   - `@tailwindcss/typography`: prose 클래스 타이포그래피

2. 가이드 페이지 생성
   - `frontend/src/app/guide/page.tsx` 생성
   - Server Component로 `UserGuide.md` 파일 읽기 (빌드 시점)
   - `react-markdown`으로 HTML 변환 및 렌더링
   - `prose` 클래스로 타이포그래피 스타일 적용

3. 목차(TOC) 컴포넌트 구현
   - Markdown 헤딩을 파싱하여 자동 목차 생성
   - 클릭 시 해당 섹션으로 스무스 스크롤
   - 모바일에서는 접이식(collapsible) 목차

**관련 요구사항:** REQ-MTT-018-05, REQ-MTT-018-06, REQ-MTT-018-07, REQ-MTT-018-08, REQ-MTT-018-12, REQ-MTT-018-13

### Final Goal: 네비게이션 통합 및 README 업데이트

**작업 내용:**
1. 사이드바 메뉴 추가
   - `Sidebar.tsx`에 "사용자 가이드" 메뉴 항목 추가
   - `/guide` 라우트 링크 연결
   - 아이콘: BookOpen (Heroicons) 또는 적절한 아이콘

2. 모바일 사이드바 반영
   - `MobileSidebar.tsx`에도 동일 메뉴 항목 반영

3. README.md 업데이트
   - "사용자 가이드" 섹션 추가
   - `/guide` 접근 방법 안내

**관련 요구사항:** REQ-MTT-018-09, REQ-MTT-018-10, REQ-MTT-018-11

## 3. 파일 변경 목록

### 새로 생성하는 파일

| 파일 경로 | 설명 |
|----------|------|
| `/UserGuide.md` | 사용자 가이드 문서 (한국어) |
| `frontend/src/app/guide/page.tsx` | 가이드 웹 페이지 컴포넌트 |

### 수정하는 파일

| 파일 경로 | 변경 내용 |
|----------|----------|
| `frontend/src/app/_components/Sidebar.tsx` | "사용자 가이드" 메뉴 항목 추가 |
| `frontend/src/app/_components/MobileSidebar.tsx` | "사용자 가이드" 메뉴 항목 추가 (동기화) |
| `frontend/package.json` | `react-markdown`, `remark-gfm`, `@tailwindcss/typography` 추가 |
| `frontend/tailwind.config.ts` | typography 플러그인 설정 추가 |
| `/README.md` | 사용자 가이드 섹션 추가 |

## 4. 아키텍처 설계 방향

### 4.1 페이지 구조

```
frontend/src/app/guide/
  page.tsx          # Server Component: UserGuide.md 읽기 + 렌더링
```

### 4.2 데이터 흐름

```
/UserGuide.md (프로젝트 루트)
    |
    v
page.tsx (Server Component, fs.readFile)
    |
    v
react-markdown (Markdown -> React Elements)
    |
    v
@tailwindcss/typography (prose 클래스 스타일)
    |
    v
HTML 렌더링 (사용자 브라우저)
```

### 4.3 UserGuide.md 파일 접근 방식

Next.js Server Component에서 `fs.readFileSync` 또는 `fs.readFile`을 사용하여 프로젝트 루트의 `UserGuide.md`를 빌드 시점에 읽는다. `process.cwd()`가 `frontend/` 디렉토리를 가리키므로, `path.resolve(process.cwd(), '..', 'UserGuide.md')`로 경로를 구성한다.

또는 Next.js의 `next.config.ts`에서 webpack 설정으로 raw 파일 로딩을 구성할 수 있다.

## 5. 리스크 및 대응

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|--------|--------|--------|----------|
| UserGuide.md 경로 접근 실패 (배포 환경) | 중간 | 높음 | 빌드 시점에 파일을 `public/` 또는 `src/` 내부로 복사하는 빌드 스크립트 추가 |
| react-markdown 번들 크기 증가 | 낮음 | 낮음 | Dynamic import로 코드 스플릿 적용 |
| Markdown 스타일이 기존 Tailwind와 충돌 | 낮음 | 중간 | prose 클래스 스코핑으로 격리 |
| 모바일에서 긴 문서 스크롤 UX | 중간 | 중간 | 접이식 목차 + "맨 위로" 버튼 제공 |

## 6. 전문가 상담 권고

### Frontend Expert 상담 권고

이 SPEC은 Next.js 페이지 구현, Markdown 렌더링, Tailwind Typography 설정 등 프론트엔드 구현을 포함한다. `expert-frontend` 에이전트와의 상담을 통해 다음을 확인하는 것을 권고한다:

- `react-markdown` + Server Component 조합의 최적 패턴
- `@tailwindcss/typography` 설정 및 커스터마이징
- 목차 컴포넌트의 접근성(a11y) 고려사항
- 모바일 반응형 목차 UX 패턴
