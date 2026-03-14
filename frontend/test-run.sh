#!/bin/bash
# 프론트엔드 테스트 실행 스크립트
# Node.js 환경 설정 및 테스트 실행

# nvm 로드
source ~/.nvm/nvm.sh

# corepack 활성화 (pnpm 사용을 위해)
corepack enable

# 테스트 실행
cd /Users/hosung/workspace/git/mtt-trend/frontend && pnpm test "$@"
