#!/bin/bash
# 프론트엔드 테스트 실행 스크립트
# Node.js 환경 설정 및 테스트 실행
# 사용법: ./test-run.sh [옵션] [테스트 파일 패턴]
#
# 예시:
#   ./test-run.sh                    # 모든 테스트 (watch 모드)
#   ./test-run.sh --run              # 모든 테스트 (한 번만 실행)
#   ./test-run.sh api.test           # api.test.tsx만 테스트
#   ./test-run.sh GroupAction       # GroupAction가 포함된 테스트만
#   ./test-run.sh --run api.test     # api.test.tsx만 한 번 실행

# nvm 로드
source ~/.nvm/nvm.sh

# corepack 활성화 (pnpm 사용을 위해)
corepack enable

# 프로젝트 루트 이동
cd "$(dirname "$0")"

# 인자가 없거나 --로 시작하는 옵션인 경우: 전체 테스트
if [ $# -eq 0 ] || [[ "$1" == -* ]]; then
    pnpm test "$@"
else
    # 인자가 파일 패턴인 경우: 해당 패턴과 일치하는 테스트만 실행
    pnpm test "$@"
fi
