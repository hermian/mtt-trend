#!/bin/bash
# Ubuntu 서버 배포 스크립트 (standalone 모드)
# 사용법: ./deploy.sh

set -e

echo "Building Next.js..."
pnpm build

echo "Copying static files to standalone directory..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "Restarting pm2..."
pm2 restart mtt-frontend

echo "Deploy complete."
