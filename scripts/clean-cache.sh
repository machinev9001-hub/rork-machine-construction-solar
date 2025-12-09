#!/bin/bash

echo "🧹 Cleaning cache directories..."

rm -rf node_modules/.cache
rm -rf .cache
rm -rf .expo
rm -rf .metro-health-check*
rm -rf coverage

echo "✅ Cache cleaned!"
echo ""
echo "💡 To start with cleared cache, run:"
echo "   bun expo start --clear"
