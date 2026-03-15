# SPEC-MTT-013 프론트엔드 테스트 가이드

## 테스트 개요

백엔드 API 테스트는 자동화된 pytest로 수행되지만, 프론트엔드 컴포넌트는 브라우저에서 수동 테스트를 수행합니다.

---

## TC-02: TopThemesBar 클릭 이벤트

### TC-02-01: 바 클릭 시 테마명 전달

**Given:** TopThemesBar에 onThemeClick 콜백이 전달되어 있을 때
**When:** 사용자가 "AI" 테마의 가로 막대를 클릭하면
**Then:** onThemeClick 콜백이 "AI" 인자로 호출되어야 한다

**테스트 방법:**
1. 브라우저 개발자 도구 콘솔 열기
2. 다음 코드 실행하여 클릭 이벤트 리스너 추가:
   ```javascript
   // 페이지 로드 후 콘솔에서 실행
   document.addEventListener('themeClick', (e) => {
     console.log('테마 클릭됨:', e.detail.themeName);
   });
   ```
3. TopThemesBar의 막대 클릭
4. 콘솔에 클릭된 테마명이 출력되는지 확인

### TC-02-02: 선택된 바 시각적 강조

**Given:** TopThemesBar에 selectedTheme="AI"가 전달되어 있을 때
**When:** 컴포넌트가 렌더링되면
**Then:** "AI" 테마의 바는 강조 표시되어야 한다
**And:** 다른 테마의 바는 불투명도가 낮게(0.6) 표시되어야 한다

**테스트 방법:**
1. 테마 막대 클릭
2. 선택된 막대의 테두리 또는 불투명도 확인 (개발자 도구 Inspector)
3. 다른 막대들의 opacity가 0.6인지 확인

### TC-02-03: 선택 해제 시 원래 상태 복원

**Given:** TopThemesBar에 selectedTheme=null이 전달되어 있을 때
**When:** 컴포넌트가 렌더링되면
**Then:** 모든 바가 동일한 불투명도로 표시되어야 한다

**테스트 방법:**
1. 패널이 열린 상태에서 닫기 버튼 클릭
2. 모든 막대의 opacity가 1.0으로 복원되는지 확인

---

## TC-03: ThemeStocksPanel 컴포넌트

### TC-03-01: 패널 표시 위치

**Given:** selectedTheme이 "AI"로 설정되어 있을 때
**When:** 트렌드 페이지가 렌더링되면
**Then:** ThemeStocksPanel은 Section 1 아래에 표시되어야 한다
**And:** ThemeStocksPanel은 Section 2 위에 표시되어야 한다

**테스트 방법:**
1. TopThemesBar의 막대 클릭
2. DOM Inspector에서 패널의 위치 확인
3. Section 1 아래, Section 2 위에 있는지 확인

### TC-03-02: 패널 헤더 구성

**Given:** "AI" 테마가 선택되고 해당 테마에 5개의 종목이 있을 때
**When:** ThemeStocksPanel이 렌더링되면
**Then:** 헤더에 테마명 "AI"가 표시되어야 한다
**And:** 헤더에 종목 수 "5개 종목"이 표시되어야 한다
**And:** 헤더에 닫기(X) 버튼이 표시되어야 한다

**테스트 방법:**
1. 테마 막대 클릭
2. 패널 헤더의 텍스트 내용 확인
3. 닫기 버튼(X 아이콘)이 표시되는지 확인

### TC-03-03: 종목 테이블 렌더링

**Given:** "AI" 테마에 [삼성전자(RS:85, +3.21%), SK하이닉스(RS:78, -1.05%)] 종목이 있을 때
**When:** ThemeStocksPanel이 렌더링되면
**Then:** 테이블에 "삼성전자" 행이 표시되어야 한다
**And:** "삼성전자"의 RS 점수 85는 빨강 색상으로 표시되어야 한다
**And:** "삼성전자"의 등락률 +3.21%는 초록 색상으로 표시되어야 한다
**And:** "SK하이닉스"의 등락률 -1.05%는 빨강 색상으로 표시되어야 한다

**테스트 방법:**
1. 테마 막대 클릭하여 패널 표시
2. 테이블의 종목명, RS 점수, 등락률 확인
3. RS 점수 색상 확인:
   - 75-100: 빨강 (#EF4444)
   - 60-74: 주황 (#F97316)
   - 45-59: 노랑 (#EAB308)
   - 30-44: 보라 (#8B5CF6)
   - 0-29: 파랑 (#3B82F6)
4. 등락률 색상 확인:
   - 양수: 초록 (text-green-400)
   - 음수: 빨강 (text-red-400)
   - 0: 회색 (text-gray-400)

### TC-03-04: 슬라이드 다운 애니메이션

**Given:** selectedTheme이 null인 상태에서
**When:** 사용자가 "AI" 테마 바를 클릭하면
**Then:** ThemeStocksPanel은 슬라이드 다운 애니메이션과 함께 나타나야 한다
**And:** 애니메이션 지속 시간은 약 300ms이어야 한다

**테스트 방법:**
1. 패널이 닫힌 상태에서 테마 막대 클릭
2. 패널이 부드럽게 슬라이드 다운되는지 확인
3. 애니메이션이 자연스럽게 완료되는지 확인

### TC-03-05: 토글 동작 - 같은 테마 재클릭

**Given:** "AI" 테마가 선택되어 ThemeStocksPanel이 표시된 상태에서
**When:** 사용자가 "AI" 테마 바를 다시 클릭하면
**Then:** ThemeStocksPanel은 슬라이드 업 애니메이션과 함께 사라져야 한다
**And:** selectedTheme은 null로 설정되어야 한다

**테스트 방법:**
1. 패널이 열린 상태에서 같은 테마 막대 클릭
2. 패널이 닫히는지 확인
3. 다시 클릭하면 다시 열리는지 확인 (토글 동작)

### TC-03-06: 테마 전환 - 다른 테마 클릭

**Given:** "AI" 테마가 선택되어 ThemeStocksPanel이 표시된 상태에서
**When:** 사용자가 "배터리" 테마 바를 클릭하면
**Then:** ThemeStocksPanel의 내용이 "배터리" 테마의 종목 목록으로 교체되어야 한다
**And:** 헤더의 테마명이 "배터리"로 변경되어야 한다

**테스트 방법:**
1. "AI" 테마 패널이 열린 상태
2. "배터리" 테마 막대 클릭
3. 패널이 닫히지 않고 내용만 교체되는지 확인
4. 헤더의 테마명이 "배터리"로 변경되는지 확인

### TC-03-07: 닫기 버튼 클릭

**Given:** ThemeStocksPanel이 표시된 상태에서
**When:** 사용자가 닫기(X) 버튼을 클릭하면
**Then:** ThemeStocksPanel이 닫혀야 한다
**And:** selectedTheme은 null로 설정되어야 한다

**테스트 방법:**
1. 패널이 열린 상태
2. 헤더의 X 버튼 클릭
3. 패널이 닫히는지 확인
4. TopThemesBar의 선택 강조도 해제되는지 확인

### TC-03-08: 로딩 상태

**Given:** "AI" 테마가 선택되고 API 응답이 아직 도착하지 않았을 때
**When:** ThemeStocksPanel이 렌더링되면
**Then:** 로딩 스피너가 표시되어야 한다

**테스트 방법:**
1. 네트워크 속도 조절 (Chrome DevTools > Network > Throttling)
2. 테마 막대 클릭
3. 로딩 스피너가 표시되는지 확인

### TC-03-09: 에러 상태

**Given:** "AI" 테마가 선택되었으나 API 호출이 실패했을 때
**When:** ThemeStocksPanel이 렌더링되면
**Then:** 에러 메시지 "데이터를 불러오는데 실패했습니다"가 표시되어야 한다

**테스트 방법:**
1. 백엔드 서버 중지
2. 테마 막대 클릭
3. 에러 메시지가 표시되는지 확인

### TC-03-10: 데이터 소스 변경 시 패널 닫힘

**Given:** "AI" 테마가 선택되어 ThemeStocksPanel이 표시된 상태에서
**When:** 사용자가 데이터 소스를 "52w_high"에서 "mtt"로 변경하면
**Then:** ThemeStocksPanel이 닫혀야 한다
**And:** selectedTheme은 null로 설정되어야 한다

**테스트 방법:**
1. 패널이 열린 상태
2. 데이터 소스 선택자 변경 (52w_high -> mtt)
3. 패널이 자동으로 닫히는지 확인

---

## TC-04: API Hook

### TC-04-01: useThemeStocks hook 정상 동작

**Given:** API 서버가 정상 작동 중일 때
**When:** useThemeStocks("AI", "2024-01-15", "52w_high") hook이 호출되면
**Then:** GET /api/themes/AI/stocks?date=2024-01-15&source=52w_high 요청이 전송되어야 한다
**And:** 반환된 data는 ThemeStock[] 타입이어야 한다

**테스트 방법:**
1. Chrome DevTools > Network 탭 열기
2. 테마 막대 클릭
3. API 요청이 전송되는지 확인
4. 응답 데이터 구조 확인

### TC-04-02: themeName이 null일 때 비활성화

**Given:** themeName이 null일 때
**When:** useThemeStocks(null, "2024-01-15", "52w_high") hook이 호출되면
**Then:** API 요청이 전송되지 않아야 한다
**And:** enabled가 false로 설정되어야 한다

**테스트 방법:**
1. 패널이 닫힌 상태에서 Network 탭 확인
2. API 요청이 전송되지 않는지 확인

### TC-04-03: 캐싱 동작

**Given:** useThemeStocks("AI", "2024-01-15", "52w_high")가 이미 호출되어 캐시에 데이터가 있을 때
**When:** 동일한 파라미터로 다시 호출하면
**Then:** 캐시된 데이터가 즉시 반환되어야 한다
**And:** staleTime 내에서는 추가 API 요청이 발생하지 않아야 한다

**테스트 방법:**
1. 테마 막대 클릭 (첫 번째 요청)
2. Network 탭에서 API 요청 확인
3. 같은 테마를 다시 클릭
4. 두 번째 요청은 캐시에서 로드되어 API 요청이 없는지 확인

---

## 품질 게이트 확인

### 필수 항목

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

---

## 테스트 완료 보고서

테스트 완료 후 다음 내용을 포함한 보고서 작성:

1. 통과한 테스트 케이스 목록
2. 실패한 테스트 케이스 목록과 실패 원인
3. 발견한 버그 목록
4. 스크린샷 (버그가 있는 경우)
5. 커버리지 메트릭 (백엔드)
