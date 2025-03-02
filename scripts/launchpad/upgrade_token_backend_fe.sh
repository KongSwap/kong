#!/bin/bash

# Exit on error
set -e

# Setup directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")" # Go up two levels to reach project root
TOKEN_BACKEND_DIR="$PROJECT_ROOT/src/token_backend"
FRONTEND_DIR="$TOKEN_BACKEND_DIR/frontend-svelte"
FRONTEND_BUILD_DIR="$TOKEN_BACKEND_DIR/frontend"

# Check if directories exist
if [ ! -d "$PROJECT_ROOT" ]; then
  echo "Error: Project root directory not found at $PROJECT_ROOT"
  exit 1
fi

if [ ! -d "$TOKEN_BACKEND_DIR" ]; then
  echo "Error: Token backend directory not found at $TOKEN_BACKEND_DIR"
  exit 1
fi

# First build the Svelte frontend
echo "Building Svelte frontend..."
if [ -d "$FRONTEND_DIR" ]; then
  cd "$FRONTEND_DIR"
  npm install
  npm run build
else
  echo "Error: Frontend directory not found at $FRONTEND_DIR"
  exit 1
fi

# Rename hashed CSS file to index.css
echo "Renaming CSS file..."
cd dist
CSS_FILE=$(find . -name "index.*.css" -type f)
if [ -n "$CSS_FILE" ]; then
  mv "$CSS_FILE" "index.css"
fi
cd ..

# Create necessary .well-known files if they don't exist
mkdir -p "$FRONTEND_BUILD_DIR/.well-known"
echo '[]' >"$FRONTEND_BUILD_DIR/.well-known/ic-domains"
echo '[]' >"$FRONTEND_BUILD_DIR/.well-known/ii-alternative-origins"
echo '{}' >"$FRONTEND_BUILD_DIR/.ic-assets.json5"

cd "$PROJECT_ROOT"

echo "Frontend upgrade complete!"
echo "Don't forget to recompile the wasm"
