#!/bin/bash

echo "🔧 Deep clean and reinstall..."

rm -rf node_modules/.cache
rm -rf .cache
rm -rf .expo
rm -rf coverage
rm -rf node_modules
rm -rf bun.lock

echo "📦 Reinstalling dependencies..."
bun install

echo "✅ Deep clean complete!"
echo ""
echo "🚀 To start the app, run:"
echo "   bun expo start --clear"
