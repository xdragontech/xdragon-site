#!/usr/bin/env bash
set -e

echo "🔧 X Dragon – macOS setup"

if [ ! -f "package.json" ]; then
  echo "❌ Run this from the project root (where package.json is)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "🟢 Node.js not found. Install Node (recommended via Homebrew):"
  echo "   brew install node"
  exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting dev server at http://localhost:3000"
npm run dev
