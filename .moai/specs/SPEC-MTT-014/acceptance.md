# SPEC-MTT-014: 인수 기준

## 메타데이터

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-MTT-014 |
| 검증 방법 | 단위 테스트 (pytest) |
| 품질 기준 | 테스트 커버리지 85% 이상 |

---

## 테스트 시나리오

### ACC-01: sync_files가 마지막 날짜 파일을 재적재하는 경우

**시나리오 1-1: 마지막 날짜 파일 재적재 (REQ-014-01)**

```gherkin
Given DB에 "52w_high" 소스의 데이터가 2024-01-13, 2024-01-14, 2024-01-15 날짜로 존재하고
  And data 폴더에 2024-01-15 날짜의 HTML 파일이 새로운 내용으로 덮어쓰기되었을 때
When sync_files()가 실행되면
Then 2024-01-15 파일은 건너뛰지 않고 재적재(re-ingest)되어야 하고
  And DB의 2024-01-15 데이터가 새 파일 내용으로 업데이트되어야 하고
  And 로그에 "Re-ingesting last date file" 메시지가 기록되어야 한다
```

**시나리오 1-2: 소스별 독립적 마지막 날짜 처리**

```gherkin
Given DB에 "52w_high" 소스의 마지막 날짜가 2024-01-15이고
  And DB에 "mtt" 소스의 마지막 날짜가 2024-01-14일 때
When sync_files()가 실행되면
Then "52w_high" 소스의 2024-01-15 파일은 재적재되어야 하고
  And "mtt" 소스의 2024-01-14 파일은 재적재되어야 하고
  And "52w_high" 소스의 2024-01-14 파일은 건너뛰어야 한다
```

**시나리오 1-3: DB가 비어있는 경우**

```gherkin
Given DB에 어떤 소스의 데이터도 존재하지 않을 때
When sync_files()가 실행되면
Then 모든 HTML 파일이 정상 적재되어야 한다 (마지막 날짜 없음 = 모두 신규)
```

---

### ACC-02: sync_files가 이전 날짜 파일을 건너뛰는 경우

**시나리오 2-1: 과거 날짜 파일 건너뛰기 (REQ-014-02)**

```gherkin
Given DB에 "52w_high" 소스의 데이터가 2024-01-13, 2024-01-14, 2024-01-15 날짜로 존재하고
  And data 폴더에 2024-01-13, 2024-01-14 날짜의 HTML 파일이 있을 때
When sync_files()가 실행되면
Then 2024-01-13 파일은 건너뛰어야 하고
  And 2024-01-14 파일은 건너뛰어야 하고
  And 로그에 "Skipped already loaded file" 메시지가 기록되어야 한다
```

**시나리오 2-2: 신규 날짜 파일 적재 (REQ-014-03)**

```gherkin
Given DB에 "52w_high" 소스의 마지막 날짜가 2024-01-15이고
  And data 폴더에 2024-01-16 날짜의 새 HTML 파일이 있을 때
When sync_files()가 실행되면
Then 2024-01-16 파일은 정상 적재되어야 한다
```

---

### ACC-03: 파일 감시자가 수정된 파일을 감지하는 경우

**시나리오 3-1: on_modified 이벤트로 유효한 HTML 파일 재적재 (REQ-014-04)**

```gherkin
Given FileWatcherHandler가 data 폴더를 감시 중이고
  And 유효한 HTML 패턴의 파일이 존재할 때
When 해당 파일이 제자리 수정(overwrite)되면
Then on_modified 이벤트가 트리거되어야 하고
  And _process_file()이 호출되어 파일이 재적재되어야 한다
```

**시나리오 3-2: 비유효 파일 수정 무시 (REQ-014-05)**

```gherkin
Given FileWatcherHandler가 data 폴더를 감시 중이고
  And 유효하지 않은 패턴의 파일(예: readme.html)이 있을 때
When 해당 파일이 수정되면
Then on_modified 이벤트는 해당 파일을 무시해야 하고
  And _process_file()이 호출되지 않아야 한다
```

**시나리오 3-3: 디렉토리 수정 이벤트 무시**

```gherkin
Given FileWatcherHandler가 data 폴더를 감시 중일 때
When 디렉토리 수정 이벤트가 발생하면
Then 이벤트를 무시하고 아무 작업도 수행하지 않아야 한다
```

---

## 완료 정의 (Definition of Done)

- [ ] `sync_files()`에서 마지막 날짜 파일이 재적재됨을 확인하는 테스트 통과
- [ ] 과거 날짜 파일이 여전히 건너뛰어지는 기존 동작 테스트 통과
- [ ] 소스별 독립적 마지막 날짜 처리 테스트 통과
- [ ] `FileWatcherHandler.on_modified()` 핸들러 추가 및 테스트 통과
- [ ] 기존 `on_created`, `on_moved` 동작에 영향 없음 확인
- [ ] 테스트 커버리지 85% 이상

---

## 추적성

- spec.md: REQ-014-01 ~ REQ-014-05
- plan.md: 작업 1-1 ~ 2-1
