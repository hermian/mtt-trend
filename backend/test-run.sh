#!/bin/bash
# 백엔드 테스트 실행 스크립트
# uv를 사용한 테스트 실행

# 프로젝트 루트에서 backend 디렉토리로 이동
cd "$(dirname "$0")"

# 테스트 실행 (uv 사용)
uv run pytest tests/ "$@"
