# SPEC-MTT-016 구현 계획

## TAG: SPEC-MTT-016

---

## 마일스톤

### Primary Goal: Viewport 메타데이터 수정 (R-001)

**대상 파일:** `frontend/src/app/layout.tsx`

**구현 내용:**

```typescript
// 변경 전
export const metadata: Metadata = {
  title: "52주 트렌드 대시보드",
  description: "52주 고점 기반 테마 트렌드 분석 대시보드",
  viewport: "width=device-width, initial-scale=1",
};

// 변경 후
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "52주 트렌드 대시보드",
  description: "52주 고점 기반 테마 트렌드 분석 대시보드",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

**검증:** `pnpm build` 성공 + viewport 관련 경고 없음

---

### Primary Goal: 모바일 사이드바 숨김 + 오버레이 (R-002, R-003, R-006)

**대상 파일:** `frontend/src/app/_components/Sidebar.tsx`, `frontend/src/app/layout.tsx`

**Sidebar.tsx 구현 방향:**

1. props에 `isOpen`, `onClose` 콜백 추가 (모바일 오버레이 제어용)
2. PC 사이드바: `hidden md:flex` -- 768px 미만에서 숨김
3. 모바일 오버레이 사이드바: `fixed inset-0 z-50` + 배경 클릭 닫힘
4. 네비게이션 항목 클릭 시 `onClose()` 호출

```
// Sidebar.tsx 구조 변경 개요
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  // PC: 기존 aside (hidden md:flex)
  // 모바일: isOpen일 때 fixed 오버레이
}
```

**layout.tsx 구현 방향:**

1. `"use client"` 추가 (사이드바 상태 관리 필요)
2. 또는 별도의 `LayoutClient.tsx` 클라이언트 컴포넌트 분리
3. `sidebarOpen` 상태 관리
4. 모바일 헤더 추가: `md:hidden` + 햄버거 버튼

```
// layout.tsx 또는 LayoutClient.tsx 구조
function LayoutClient({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 모바일 헤더 - PC에서 숨김 */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 ...">
        <button onClick={() => setSidebarOpen(true)}>햄버거</button>
        <span>MTT Trend</span>
      </div>

      {/* PC 사이드바 */}
      <Sidebar />

      {/* 모바일 오버레이 사이드바 */}
      {sidebarOpen && <MobileOverlay onClose={() => setSidebarOpen(false)} />}

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
```

**핵심 원칙:**
- 기존 `<aside>` 태그의 클래스 중 PC 관련 클래스는 절대 변경하지 않음
- `hidden md:flex`만 추가하여 모바일에서만 숨김
- 모바일 오버레이는 완전히 새로운 요소로 추가

---

### Secondary Goal: 모바일 패딩 최적화 (R-004)

**대상 파일:** `frontend/src/app/trend/page.tsx`

**구현 내용:**

```typescript
// 변경 전
<div className="p-6 space-y-6">

// 변경 후
<div className="p-3 md:p-6 space-y-4 md:space-y-6">
```

**추가 고려사항:**
- 모바일 헤더 높이만큼 상단 여백 추가 필요 없음 (layout 레벨에서 `pt-14 md:pt-0` 처리)
- 페이지 헤더의 `flex-wrap gap-4`는 이미 모바일 대응이므로 추가 수정 불필요

---

## 기술 접근법

### 접근 전략: "추가만, 변경 없음"

이전 수정이 실패한 근본 원인은 PC 스타일을 직접 수정했기 때문이다. 이번에는 다음 전략을 적용한다:

1. **기존 클래스 제거 금지**: 기존 Tailwind 클래스를 삭제하지 않음
2. **반응형 접두사로 추가만**: `md:flex`, `md:p-6` 등으로 PC 스타일 보존
3. **새 요소는 모바일 전용**: 모바일 헤더, 오버레이는 `md:hidden`으로 PC에서 숨김

### 아키텍처 설계

```
layout.tsx (Server Component)
  -> metadata, viewport export
  -> LayoutClient (Client Component)
       -> MobileHeader (md:hidden)
       -> Sidebar (hidden md:flex) -- PC용 사이드바
       -> MobileSidebar (md:hidden) -- 모바일 오버레이
       -> <main> (콘텐츠 영역)
```

**Server/Client 분리 이유:**
- `layout.tsx`의 `metadata`와 `viewport`는 Server Component에서만 export 가능
- 사이드바 open/close 상태 관리는 Client Component 필요
- `LayoutClient.tsx`로 분리하여 양쪽 요구사항 충족

### 리스크 및 대응

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| viewport 분리 시 PC 렌더링 영향 | 중 | 빌드 후 PC Chrome에서 레이아웃 동일 여부 검증 |
| 모바일 오버레이 z-index 충돌 | 하 | z-50 사용, 기존 z-index 확인 |
| Client Component 전환 시 SSR 영향 | 중 | LayoutClient 분리로 metadata SSR 보존 |
| 모바일 헤더로 인한 콘텐츠 밀림 | 하 | `pt-14 md:pt-0`으로 모바일만 패딩 추가 |

---

## Definition of Done

- [ ] `pnpm build` 성공 (에러, viewport 경고 없음)
- [ ] PC Chrome (1920x1080): 기존 레이아웃과 완전 동일
- [ ] PC Chrome (1024x768): 사이드바 정상 표시, 햄버거 메뉴 숨김
- [ ] 모바일 Chrome (360x640): 사이드바 숨김, 햄버거 메뉴 표시
- [ ] 모바일 Chrome (360x640): 햄버거 클릭 시 오버레이 사이드바 표시
- [ ] 모바일 Chrome (360x640): 콘텐츠 영역 가로 스크롤 없음
- [ ] 모바일 Chrome (360x640): 패딩 p-3 적용 확인
- [ ] `pnpm lint` 통과
- [ ] `pnpm test` 통과 (기존 테스트 깨짐 없음)
