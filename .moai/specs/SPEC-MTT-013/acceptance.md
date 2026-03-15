# SPEC-MTT-013 인수 기준

## 메타데이터

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-MTT-013 |
| 제목 | TopThemesBar 클릭 시 테마별 종목 목록 슬라이드 다운 패널 |
| 관련 태그 | SPEC-MTT-013-F01, F02, F03, F04 |
| 상태 | Completed |

---

## 1. F-01: 백엔드 API - 테마별 종목 조회

### TC-01-01: 정상 조회 - 특정 날짜, 특정 소스

```gherkin
Given 데이터베이스에 2024-01-15 날짜의 "AI" 테마에 대한 52w_high 소스 종목 데이터가 존재할 때
When GET /api/themes/AI/stocks?date=2024-01-15&source=52w_high 요청을 보내면
Then 응답 상태 코드는 200이어야 한다
And 응답 body의 theme_name은 "AI"이어야 한다
And 응답 body의 date는 "2024-01-15"이어야 한다
And 응답 body의 stocks 배열은 비어있지 않아야 한다
And stocks 배열의 각 항목에는 stock_name, rs_score, change_pct 필드가 있어야 한다
```

### TC-01-02: RS 점수 내림차순 정렬

```gherkin
Given "AI" 테마에 rs_score가 [85, 45, 78, 92]인 종목 4개가 있을 때
When GET /api/themes/AI/stocks?date=2024-01-15 요청을 보내면
Then stocks 배열은 rs_score 내림차순으로 정렬되어야 한다
And 첫 번째 종목의 rs_score는 92이어야 한다
And 마지막 종목의 rs_score는 45이어야 한다
```

### TC-01-03: date 미지정 시 최신 날짜 조회

```gherkin
Given 데이터베이스에 2024-01-14, 2024-01-15 날짜의 "AI" 테마 종목 데이터가 있을 때
When GET /api/themes/AI/stocks 요청을 보내면 (date 파라미터 없이)
Then 응답 body의 date는 "2024-01-15"이어야 한다
And 2024-01-15의 종목 데이터가 반환되어야 한다
```

### TC-01-04: 존재하지 않는 테마 조회

```gherkin
Given 데이터베이스에 "없는테마" 테마의 종목 데이터가 존재하지 않을 때
When GET /api/themes/없는테마/stocks?date=2024-01-15 요청을 보내면
Then 응답 상태 코드는 404이어야 한다
```

### TC-01-05: MTT 데이터 소스 조회

```gherkin
Given 데이터베이스에 "배터리" 테마의 mtt 소스 종목 데이터가 존재할 때
When GET /api/themes/배터리/stocks?date=2024-01-15&source=mtt 요청을 보내면
Then 응답 상태 코드는 200이어야 한다
And 반환된 종목은 mtt 소스의 데이터이어야 한다
```

---

## 2. F-02: TopThemesBar 클릭 이벤트

### TC-02-01: 바 클릭 시 테마명 전달

```gherkin
Given TopThemesBar에 onThemeClick 콜백이 전달되어 있을 때
When 사용자가 "AI" 테마의 가로 막대를 클릭하면
Then onThemeClick 콜백이 "AI" 인자로 호출되어야 한다
```

### TC-02-02: 선택된 바 시각적 강조

```gherkin
Given TopThemesBar에 selectedTheme="AI"가 전달되어 있을 때
When 컴포넌트가 렌더링되면
Then "AI" 테마의 바는 강조 표시(테두리 또는 전체 불투명도)가 적용되어야 한다
And 다른 테마의 바는 불투명도가 낮게(0.6) 표시되어야 한다
```

### TC-02-03: 선택 해제 시 원래 상태 복원

```gherkin
Given TopThemesBar에 selectedTheme=null이 전달되어 있을 때
When 컴포넌트가 렌더링되면
Then 모든 바가 동일한 불투명도로 표시되어야 한다
```

---

## 3. F-03: ThemeStocksPanel 컴포넌트

### TC-03-01: 패널 표시 위치

```gherkin
Given selectedTheme이 "AI"로 설정되어 있을 때
When 트렌드 페이지가 렌더링되면
Then ThemeStocksPanel은 Section 1 (TopThemesBar + SurgingThemesCard) 아래에 표시되어야 한다
And ThemeStocksPanel은 Section 2 (ThemeTrendChart) 위에 표시되어야 한다
```

### TC-03-02: 패널 헤더 구성

```gherkin
Given "AI" 테마가 선택되고 해당 테마에 5개의 종목이 있을 때
When ThemeStocksPanel이 렌더링되면
Then 헤더에 테마명 "AI"가 표시되어야 한다
And 헤더에 종목 수 "5개 종목"이 표시되어야 한다
And 헤더에 닫기(X) 버튼이 표시되어야 한다
```

### TC-03-03: 종목 테이블 렌더링

```gherkin
Given "AI" 테마에 [삼성전자(RS:85, +3.21%), SK하이닉스(RS:78, -1.05%)] 종목이 있을 때
When ThemeStocksPanel이 렌더링되면
Then 테이블에 "삼성전자" 행이 표시되어야 한다
And "삼성전자"의 RS 점수 85는 빨강 색상으로 표시되어야 한다
And "삼성전자"의 등락률 +3.21%는 초록 색상으로 표시되어야 한다
And "SK하이닉스"의 등락률 -1.05%는 빨강 색상으로 표시되어야 한다
```

### TC-03-04: 슬라이드 다운 애니메이션

```gherkin
Given selectedTheme이 null인 상태에서
When 사용자가 "AI" 테마 바를 클릭하면
Then ThemeStocksPanel은 슬라이드 다운 애니메이션과 함께 나타나야 한다
And 애니메이션 지속 시간은 약 300ms이어야 한다
```

### TC-03-05: 토글 동작 - 같은 테마 재클릭

```gherkin
Given "AI" 테마가 선택되어 ThemeStocksPanel이 표시된 상태에서
When 사용자가 "AI" 테마 바를 다시 클릭하면
Then ThemeStocksPanel은 슬라이드 업 애니메이션과 함께 사라져야 한다
And selectedTheme은 null로 설정되어야 한다
```

### TC-03-06: 테마 전환 - 다른 테마 클릭

```gherkin
Given "AI" 테마가 선택되어 ThemeStocksPanel이 표시된 상태에서
When 사용자가 "배터리" 테마 바를 클릭하면
Then ThemeStocksPanel의 내용이 "배터리" 테마의 종목 목록으로 교체되어야 한다
And 헤더의 테마명이 "배터리"로 변경되어야 한다
```

### TC-03-07: 닫기 버튼 클릭

```gherkin
Given ThemeStocksPanel이 표시된 상태에서
When 사용자가 닫기(X) 버튼을 클릭하면
Then ThemeStocksPanel이 닫혀야 한다
And selectedTheme은 null로 설정되어야 한다
```

### TC-03-08: 로딩 상태

```gherkin
Given "AI" 테마가 선택되고 API 응답이 아직 도착하지 않았을 때
When ThemeStocksPanel이 렌더링되면
Then 로딩 스피너가 표시되어야 한다
```

### TC-03-09: 에러 상태

```gherkin
Given "AI" 테마가 선택되었으나 API 호출이 실패했을 때
When ThemeStocksPanel이 렌더링되면
Then 에러 메시지 "데이터를 불러오는데 실패했습니다"가 표시되어야 한다
```

### TC-03-10: 데이터 소스 변경 시 패널 닫힘

```gherkin
Given "AI" 테마가 선택되어 ThemeStocksPanel이 표시된 상태에서
When 사용자가 데이터 소스를 "52w_high"에서 "mtt"로 변경하면
Then ThemeStocksPanel이 닫혀야 한다
And selectedTheme은 null로 설정되어야 한다
```

---

## 4. F-04: API Hook

### TC-04-01: useThemeStocks hook 정상 동작

```gherkin
Given API 서버가 정상 작동 중일 때
When useThemeStocks("AI", "2024-01-15", "52w_high") hook이 호출되면
Then GET /api/themes/AI/stocks?date=2024-01-15&source=52w_high 요청이 전송되어야 한다
And 반환된 data는 ThemeStock[] 타입이어야 한다
```

### TC-04-02: themeName이 null일 때 비활성화

```gherkin
Given themeName이 null일 때
When useThemeStocks(null, "2024-01-15", "52w_high") hook이 호출되면
Then API 요청이 전송되지 않아야 한다
And enabled가 false로 설정되어야 한다
```

### TC-04-03: 캐싱 동작

```gherkin
Given useThemeStocks("AI", "2024-01-15", "52w_high")가 이미 호출되어 캐시에 데이터가 있을 때
When 동일한 파라미터로 다시 호출되면
Then 캐시된 데이터가 즉시 반환되어야 한다
And staleTime 내에서는 추가 API 요청이 발생하지 않아야 한다
```

---

## 5. 품질 게이트

### Definition of Done

- [ ] 백엔드 API 엔드포인트가 정상 동작하고 Swagger 문서에 표시됨
- [ ] 프론트엔드 종목 패널이 TopThemesBar 클릭 시 정상 표시됨
- [ ] 슬라이드 다운/업 애니메이션이 부드럽게 동작함
- [ ] 토글 동작 (같은 바 재클릭 시 닫힘)이 정상 작동함
- [ ] 로딩/에러 상태가 올바르게 표시됨
- [ ] 데이터 소스 변경 시 패널이 자동으로 닫힘
- [ ] RS 점수 색상 코딩이 TopThemesBar와 동일하게 적용됨
- [ ] 등락률 +/- 색상 구분이 적용됨
- [ ] TypeScript 타입 에러 없음
- [ ] 기존 기능에 대한 regression 없음

### 검증 방법

- 백엔드: pytest로 API 엔드포인트 테스트
- 프론트엔드: 브라우저에서 수동 테스트 (클릭, 토글, 애니메이션, 데이터 소스 전환)
- 통합: 백엔드-프론트엔드 연동 확인 (실제 데이터로 종목 목록 표시)

---

## 6. 추적성 태그

- SPEC-MTT-013-F01: TC-01-01 ~ TC-01-05
- SPEC-MTT-013-F02: TC-02-01 ~ TC-02-03
- SPEC-MTT-013-F03: TC-03-01 ~ TC-03-10
- SPEC-MTT-013-F04: TC-04-01 ~ TC-04-03
