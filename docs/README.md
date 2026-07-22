# MTT Trend Documentation

이 디렉토리는 `mtt-trend` 프로젝트의 기획, 설계 및 기술 명세 문서를 관리합니다. 모든 신규 기능 개발은 **PDCA (Plan-Design-Do-Check-Act)** 사이클을 준수하며 문서화됩니다.

## 📂 디렉토리 구조

| 폴더 | 설명 |
|------|------|
| [01-plan](./01-plan) | 기능별 기획서 및 성공 지표 정의 |
| [02-design](./02-design) | 아키텍처 결정 및 상세 설계 문서 |
| [03-report](./03-report) | 기능 구현 완료 보고서 및 성공 검증 |
| [specs](./specs) | 시스템 전반의 기술 표준 및 명세 |

---

## 🚀 현재 진행 중인 기능 (PDCA)

### 1. 인터랙티브 차트 시스템 (Interactive Charting)
고성능 `lightweight-charts`를 활용한 다중 지표 동기화 차트 시스템입니다.
- **기획서**: [Interactive Charting Plan](./01-plan/features/interactive-charting.plan.md)
- **설계서**: [Interactive Charting Design](./02-design/features/interactive-charting.design.md)
- **보고서**: [Interactive Charting Report](./03-report/features/interactive-charting.report.md)
- **상태**: ✅ **완료 (Reported)**

### 2. KODEX 레버리지 실제 데이터 연동 (KODEX Leverage Chart)
로컬 CSV 데이터를 파싱하여 실제 시장 지표를 차트에 렌더링하는 기능입니다.
- **기획서**: [KODEX Leverage Integration Plan](./01-plan/features/kodex-leverage-chart.plan.md)
- **설계서**: [KODEX Leverage Integration Design](./02-design/features/kodex-leverage-chart.design.md)
- **상태**: 🚧 **구현 단계 (Do Phase)** 진입

### 3. Above MA 실시간 지표 인터랙티브 차트 연동 (Above MA Chart)
실시간 이동평균선 상회 종목 비율 SQLite DB를 파싱하고 정전 시 데이터를 선형 보간하여 이중 동기화 차트로 시각화하는 기능입니다.
- **기획서**: [Above MA Integration Plan](./01-plan/features/above-ma.plan.md)
- **설계서**: [Above MA Integration Design](./02-design/features/above-ma.design.md)
- **보고서**: [Above MA Integration Report](./03-report/features/above-ma.report.md)
- **상태**: ✅ **완료 (Reported)**

### 4. WICS Index Explorer (주도섹터 탐색 탭)
전 WICS 지수 오버레이 + visible-range 좌단=100 rebase로 구간 주도섹터를 탐색하는 전용 탭입니다. 기존 WICS 랭킹 탭 단건 차트는 유지합니다.
- **기획서**: [WICS Index Explorer Plan](./01-plan/features/wics-index-explorer.plan.md)
- **설계서**: [WICS Index Explorer Design](./02-design/features/wics-index-explorer.design.md)
- **상태**: 📋 **Plan/Design (스펙 확정)** — 구현 대기
- **이슈**: [#9](https://github.com/hermian/mtt-trend/issues/9)


---

## 🛠 문서 작성 원칙
- **Context Anchor**: 모든 기획/설계 문서 상단에는 WHY, WHO, RISK, SUCCESS, SCOPE를 명시하여 프로젝트의 목적을 잃지 않도록 합니다.
- **Decision Records**: 아키텍처 결정 시 선택된 이유와 트레이드오프를 기록합니다.
- **Continuous Update**: 코드 변경 사항이 발생할 때마다 관련 설계 문서를 최신 상태로 유지합니다.
