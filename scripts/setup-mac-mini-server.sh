#!/usr/bin/env bash
# Mac mini 헤드리스 운영 서버 최초 1회 설정
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

export NVM_DIR="${HOME}/.nvm"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2가 없습니다. 먼저 설치하세요: npm install -g pm2"
  exit 1
fi

chmod +x scripts/pm2-mtt-backend.sh scripts/pm2-mtt-frontend.sh

echo "[1/3] pm2 앱 등록..."
if pm2 describe mtt-backend >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

echo "[2/3] 부팅 시 자동 시작 등록 (pm2 startup)..."
echo "아래 sudo 명령이 출력되면 복사해서 실행하세요."
pm2 startup launchd -u "${USER}" --hp "${HOME}" || true

echo "[3/3] 현재 프로세스 목록 저장 (pm2 save)..."
pm2 save

echo ""
echo "완료. 상태 확인:"
pm2 status

echo ""
echo "맥미니 절전 방지(권장):"
echo "  sudo pmset -a sleep 0 disksleep 0 displaysleep 10"
