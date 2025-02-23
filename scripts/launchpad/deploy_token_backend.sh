#!/bin/bash

# Exit on error
set -e

# Parse arguments
REINSTALL=false
while [[ $# -gt 0 ]]; do
  case $1 in
  reinstall)
    REINSTALL=true
    shift
    ;;
  *)
    echo "Unknown argument: $1"
    exit 1
    ;;
  esac
done

# Setup directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")" # Go up two levels to reach project root
DECLARATIONS_DIR="$PROJECT_ROOT/src/declarations/token_backend"
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
  echo "Warning: Frontend directory not found at $FRONTEND_DIR - skipping frontend build"
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

# Then build from source
echo "Building token_backend..."
cargo build --target wasm32-unknown-unknown --release -p token_backend

# Extract Candid interface
echo "Extracting Candid interface..."
WASM_PATH="target/wasm32-unknown-unknown/release/token_backend.wasm"
candid-extractor "$WASM_PATH" >"$DECLARATIONS_DIR/token_backend.did"

# Add metadata to WASM using ic-wasm
echo "Adding metadata to WASM..."
ic-wasm "$WASM_PATH" -o "$WASM_PATH" metadata candid:service -f "$DECLARATIONS_DIR/token_backend.did" -v public

# Clear dfx cache to ensure fresh generation
echo "Clearing dfx cache..."
dfx cache delete

# Generate declarations
echo "Generating type declarations..."
dfx generate token_backend

# Copy generated files to token_backend directory
echo "Copying files to token_backend directory..."
cp "$DECLARATIONS_DIR/token_backend.did" "$TOKEN_BACKEND_DIR/"
cp "$DECLARATIONS_DIR/token_backend.did.js" "$TOKEN_BACKEND_DIR/"
cp "$DECLARATIONS_DIR/token_backend.did.d.ts" "$TOKEN_BACKEND_DIR/"
cp "$DECLARATIONS_DIR/index.js" "$TOKEN_BACKEND_DIR/"
cp "$DECLARATIONS_DIR/index.d.ts" "$TOKEN_BACKEND_DIR/"

# Copy the Candid interface to frontend build directory
echo "Copying Candid interface to frontend..."
cp "$TOKEN_BACKEND_DIR/token_backend.did.js" "$FRONTEND_BUILD_DIR/"
cp "$TOKEN_BACKEND_DIR/token_backend.did" "$FRONTEND_BUILD_DIR/"
cp "$TOKEN_BACKEND_DIR/token_backend.did.d.ts" "$FRONTEND_BUILD_DIR/"

# Default initialization arguments
INIT_ARGS='(record {
    name = "Floppa";
    ticker = "FLOPS";
    total_supply = 21_000_000_0000_0000;
    logo = null;
    decimals = opt 8;
    transfer_fee = opt 10_000;
    archive_options = null;
    initial_block_reward = 251881_0000_0000;
    block_time_target_seconds = 5;
    halving_interval = 10;
})'

# Deploy with or without reinstall mode based on argument
if [ "$REINSTALL" = true ]; then
  echo "Deploying token_backend with reinstall mode..."
  dfx deploy token_backend --argument "$INIT_ARGS" --mode reinstall
else
  echo "Deploying token_backend..."
  dfx deploy token_backend --argument "$INIT_ARGS"
fi

echo "Deployment complete!"
