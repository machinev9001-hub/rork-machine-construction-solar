#!/usr/bin/env bash
set -euo pipefail

echo "Running type check..."
node scripts/typecheck.js

echo "Running lint..."
node ./node_modules/eslint/bin/eslint.js . --ext .js,.ts,.tsx

echo "Running smoke tests..."
node ./node_modules/jest/bin/jest.js --runInBand --passWithNoTests
