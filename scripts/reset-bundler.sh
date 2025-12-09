#!/bin/bash

echo "🔄 Resetting Metro bundler and watchman..."

watchman watch-del-all 2>/dev/null || echo "⚠️  Watchman not installed (optional)"

rm -rf node_modules/.cache
rm -rf .cache
rm -rf .expo
rm -rf .metro-health-check*

echo "✅ Reset complete!"
echo ""
echo "🚀 Starting with clear cache..."
bun expo start --clear
