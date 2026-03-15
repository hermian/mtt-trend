# SPEC-MTT-013 구현 계획

## 메타데이터

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-MTT-013 |
| 제목 | TopThemesBar 클릭 시 테마별 종목 목록 슬라이드 다운 패널 |
| 관련 태그 | SPEC-MTT-013-F01, F02, F03, F04 |

---

## 1. 구현 전략

### 접근 방식

백엔드 API를 먼저 구현하여 데이터 파이프라인을 완성한 후, 프론트엔드 컴포넌트를 순차적으로 구현한다. 기존 코드 패턴(라우터 구조, React Query 훅, 컴포넌트 스타일)을 최대한 따라 일관성을 유지한다.

### 아키텍처 설계 방향

```
[TopThemesBar] --onClick--> [page.tsx: selectedTheme state]
                                    |
                                    v
                            [ThemeStocksPanel]
                                    |
                                    v
                            [useThemeStocks hook]
                                    |
                                    v
                            [api.getThemeStocks]
                                    |
                                    v
                            [GET /api/themes/{name}/stocks]
                                    |
                                    v
                            [ThemeStockDaily model]
```

---

## 2. 마일스톤

### Primary Goal: 백엔드 API 구현 (SPEC-MTT-013-F01)

**대상 파일:**
- `backend/app/schemas.py` - `ThemeStockItem`, `ThemeStocksResponse` 추가
- `backend/app/routers/themes.py` - `GET /api/themes/{name}/stocks` 엔드포인트 추가

**구현 내용:**

1. Pydantic 스키마 정의
   - `ThemeStockItem`: stock_name (str), rs_score (Optional[int]), change_pct (Optional[float])
   - `ThemeStocksResponse`: theme_name (str), date (str), stocks (List[ThemeStockItem])

2. 라우터 엔드포인트 구현
   - 기존 `get_theme_history` 패턴 참고 (path parameter + query parameter)
   - `ThemeStockDaily` 테이블에서 date, theme_name, data_source 필터링
   - rs_score 내림차순 정렬
   - date 미지정 시 `_latest_date()` 헬퍼 활용

**참고 패턴:** `backend/app/routers/themes.py`의 `get_theme_history` 함수

### Secondary Goal: 프론트엔드 API 연동 (SPEC-MTT-013-F04)

**대상 파일:**
- `frontend/src/lib/api.ts` - `ThemeStock` 인터페이스, `getThemeStocks` 함수 추가
- `frontend/src/hooks/useThemes.ts` - `useThemeStocks` hook 추가

**구현 내용:**

1. TypeScript 인터페이스 정의
   ```typescript
   export interface ThemeStock {
     stock_name: string;
     rs_score: number | null;
     change_pct: number | null;
   }
   ```

2. API 함수 추가
   - `getThemeStocks(name: string, date: string, source: DataSource)` 함수
   - 기존 `getThemeHistory` 패턴 참고

3. React Query Hook 추가
   - `useThemeStocks(themeName: string | null, date: string | null, source: DataSource)`
   - queryKey: `["themes", "stocks", themeName, date, source]`
   - enabled: `!!themeName && !!date`

### Tertiary Goal: TopThemesBar 클릭 이벤트 (SPEC-MTT-013-F02)

**대상 파일:**
- `frontend/src/app/trend/_components/TopThemesBar.tsx`

**구현 내용:**

1. Props 확장
   - `onThemeClick?: (themeName: string) => void` prop 추가
   - `selectedTheme?: string | null` prop 추가 (선택 강조용)

2. Recharts Bar onClick 이벤트 연결
   - `Bar` 컴포넌트에 `onClick` prop 추가
   - 클릭 시 `onThemeClick(entry.theme_name)` 호출

3. 선택된 바 시각적 강조
   - 선택된 바에 stroke (테두리) 추가
   - 미선택 바는 opacity 감소 (0.6)

### Final Goal: ThemeStocksPanel 컴포넌트 (SPEC-MTT-013-F03)

**대상 파일:**
- `frontend/src/app/trend/_components/ThemeStocksPanel.tsx` (신규)
- `frontend/src/app/trend/page.tsx` (수정)

**구현 내용:**

1. ThemeStocksPanel 컴포넌트 생성
   - Props: `themeName`, `date`, `source`, `onClose`
   - `useThemeStocks` hook으로 데이터 조회
   - 종목 테이블 렌더링 (종목명, RS 점수, 등락률)
   - RS 점수 색상 코딩 (TopThemesBar의 `getBarColor` 재사용)
   - 등락률 +/- 색상 구분

2. 슬라이드 다운 애니메이션
   - CSS transition (max-height, opacity)
   - duration: 300ms, ease-in-out

3. page.tsx 수정
   - `selectedTheme` 상태 추가
   - `handleThemeClick` 콜백 (토글 로직 포함)
   - Section 1과 Section 2 사이에 `ThemeStocksPanel` 조건부 렌더링
   - `TopThemesBar`에 `onThemeClick`, `selectedTheme` prop 전달

---

## 3. 기술적 고려사항

### 라우팅 충돌 방지

현재 `themes.py`에 `/{name:path}/history` 경로가 있으므로, `/{name}/stocks` 경로를 추가할 때 순서를 고려해야 한다. `{name:path}` 패턴보다 앞에 정의하거나, 동일한 `{name:path}` 패턴을 사용해야 한다.

### 애니메이션 구현 방식

`max-height`를 사용한 CSS transition은 `auto` 값과 호환되지 않으므로, 충분히 큰 고정값(예: 2000px)을 사용하거나 JavaScript로 실제 높이를 계산하는 방식을 선택한다. Tailwind CSS의 `overflow-hidden`과 `transition-all`을 활용한다.

### 데이터 소스 전환 시 처리

`source`가 변경되면 `selectedTheme`을 null로 초기화하여 패널을 자동으로 닫는다. 기존 `source` 변경 시 `selectedDate` 초기화 로직과 동일한 패턴을 적용한다.

---

## 4. 위험 요소 및 대응

| 위험 | 영향도 | 대응 방안 |
|------|--------|----------|
| `{name:path}` 라우팅 충돌 | Medium | 엔드포인트를 `/{name:path}/stocks`로 정의하여 기존 패턴과 일관성 유지 |
| max-height 애니메이션 깜빡임 | Low | 충분한 max-height 값 설정 + overflow-hidden |
| 종목이 0개인 테마 클릭 | Low | 404 에러 시 패널에 "종목 데이터 없음" 메시지 표시 |
| 빠른 연속 클릭 시 상태 꼬임 | Low | React Query 캐싱으로 자연스럽게 처리 |

---

## 5. 의존성

- SPEC-MTT-004: TopThemesBar 컴포넌트 (이미 구현 완료)
- `ThemeStockDaily` 테이블 데이터 적재 (이미 존재)
- TanStack Query (이미 설치됨)

---

## 6. 추적성 태그

- SPEC-MTT-013-F01: 백엔드 API 구현
- SPEC-MTT-013-F02: TopThemesBar 클릭 이벤트
- SPEC-MTT-013-F03: ThemeStocksPanel 컴포넌트
- SPEC-MTT-013-F04: API Hook
