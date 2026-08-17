#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

export NVM_DIR="${HOME}/.nvm"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"
fi

cd "${ROOT}/frontend"

# Ensure standalone static assets exist
mkdir -p .next/standalone/.next/static
if [ -d ".next/static" ]; then
  cp -rf .next/static/* .next/standalone/.next/static/ 2>/dev/null || true
fi
if [ -d "public" ]; then
  cp -rf public .next/standalone/ 2>/dev/null || true
fi

exec node .next/standalone/server.js

