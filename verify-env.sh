#!/bin/bash

# Environment Variables Verification Script
# This script helps verify that your .env file is set up correctly

echo "🔍 Checking Environment Variables Setup..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Create one by copying .env.example:"
    echo "   cp .env.example .env"
    echo ""
    exit 1
else
    echo "✅ .env file exists"
fi

# Check if .env has placeholder values
if grep -q "your-api-key-here" .env; then
    echo "⚠️  Warning: .env contains placeholder values"
    echo "   Replace them with your actual Firebase credentials"
    echo ""
fi

# Check required variables
required_vars=(
    "EXPO_PUBLIC_FIREBASE_API_KEY"
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID"
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    "EXPO_PUBLIC_FIREBASE_APP_ID"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if ! grep -q "$var=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing required variables in .env:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    exit 1
else
    echo "✅ All required variables present in .env"
fi

echo ""
echo "📋 Current Firebase Project (from .env):"
source .env
echo "   Project ID: $EXPO_PUBLIC_FIREBASE_PROJECT_ID"
echo "   Auth Domain: $EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"
echo ""

echo "✅ Environment setup looks good!"
echo ""
echo "Next steps:"
echo "1. Run: npm run start (or bun run start)"
echo "2. Check console logs for:"
echo "   [Firebase] Initializing Firebase immediately..."
echo "   [Firebase] App initialized"
echo "3. If you see those logs, Firebase is using your .env values! 🎉"
echo ""
