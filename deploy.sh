#!/bin/bash

# MTT Trend 통합 배포 스크립트
# Usage: ./deploy.sh

set -e

# Node.js 환경 설정 (nvm 사용 시 — pm2, pnpm PATH)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
fi

echo "🚀 [1/4] 최신 코드 가져오기..."
git pull

# --- 백엔드 배포 ---
echo "📦 [2/4] 백엔드 업데이트 중..."
cd backend
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi
uv pip install -r requirements.txt
cd ..

# --- 프론트엔드 배포 ---
echo "🏗️ [3/4] 프론트엔드 빌드 중..."
cd frontend

# 빌드 잔재 및 캐시 삭제
rm -rf .next node_modules/.cache

pnpm install
pnpm build

echo "📂 [4/4] 프론트엔드 정적 자산 정리..."
# standalone 모드 자산 복사
mkdir -p .next/standalone/.next/static
cp -r .next/static/* .next/standalone/.next/static/
if [ -d "public" ]; then
    cp -r public .next/standalone/
else
    mkdir -p .next/standalone/public
fi

echo "🔄 PM2 프로세스 재시작..."
chmod +x ../scripts/pm2-mtt-backend.sh ../scripts/pm2-mtt-frontend.sh
if pm2 describe mtt-backend >/dev/null 2>&1; then
    pm2 reload ../ecosystem.config.cjs --update-env
else
    pm2 start ../ecosystem.config.cjs
fi
pm2 save
cd ..

echo "✅ 배포가 완료되었습니다!"
pm2 status
