# 코드맵 인덱스

## 빠른 네비게이션

### 아키텍처 이해
- **처음 읽을 문서**: [overview.md](overview.md)
- **모듈별 설명**: [modules.md](modules.md)
- **의존성 분석**: [dependencies.md](dependencies.md)

### 개발/유지보수
- **API 문서**: [entry-points.md](entry-points.md)
- **데이터 흐름**: [data-flow.md](data-flow.md)
- **전체 가이드**: [README.md](README.md)

---

## 문서별 주요 내용

### overview.md
- 시스템 아키텍처 다이어그램
- 핵심 설계 패턴
- 아키텍처 결정사항

### modules.md
- 18개 모듈 상세 정의
- 각 모듈의 역할과 책임
- 공개 인터페이스 명시

### dependencies.md
- 모듈 간 의존성 그래프
- 순환 의존성 분석
- 안정성 평가

### entry-points.md
- 애플리케이션 진입점
- REST API 6개 엔드포인트
- CLI 명령어 및 사용 예시

### data-flow.md
- 종합 데이터 파이프라인
- 요청 생명주기
- 상태 관리 및 캐싱 전략

---

## 파일별 읽기 순서

### 신입 개발자
1. README.md → overview.md → modules.md → entry-points.md → data-flow.md

### 빠른 API 학습
1. entry-points.md (전체)
2. data-flow.md (캐싱 섹션)

### 성능 최적화
1. data-flow.md (캐싱 및 최적화)
2. dependencies.md (안정성 평가)

### 버그 수정
1. entry-points.md (관련 엔드포인트)
2. modules.md (영향받는 모듈)
3. data-flow.md (데이터 흐름 추적)

---

**총 3,081줄의 한국어 아키텍처 문서**
