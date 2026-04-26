#!/bin/bash

# MTT Trend 통합 배포 스크립트
# Usage: ./deploy.sh

set -e

echo "🚀 [1/4] 최신 코드 가져오기..."
git pull

# --- 백엔드 배포 ---
echo "📦 [2/4] 백엔드 업데이트 중..."
cd backend
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi
uv pip install -r requirements.txt
pm2 restart mtt-backend || pm2 start "uv run uvicorn app.main:app --host 0.0.0.0 --port 8000" --name mtt-backend
cd ..

# --- 프론트엔드 배포 ---
echo "🏗️ [3/4] 프론트엔드 빌드 중..."
cd frontend
# 환경 설정 (nvm 사용 시)
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

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
pm2 restart mtt-frontend || pm2 start "pnpm start" --name mtt-frontend

echo "✅ 배포가 완료되었습니다!"
pm2 status
