#!/usr/bin/env bash
set -euo pipefail

echo "[quality] Running TypeScript type-check via scripts/typecheck.js"
node scripts/typecheck.js

echo "[quality] Running ESLint"
npm run lint

echo "[quality] Running Jest test suite"
npm test -- --runInBand

echo "[quality] Running smoke script"
./scripts/run-smoke.sh
