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
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DECLARATIONS_DIR="$PROJECT_ROOT/src/declarations/token_backend"
TOKEN_BACKEND_DIR="$PROJECT_ROOT/src/token_backend"
FRONTEND_DIR="$TOKEN_BACKEND_DIR/frontend-svelte"
FRONTEND_BUILD_DIR="$TOKEN_BACKEND_DIR/frontend"

# First build the Svelte frontend
echo "Building Svelte frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

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
candid-extractor "target/wasm32-unknown-unknown/release/token_backend.wasm" >"$DECLARATIONS_DIR/token_backend.did"

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
    total_supply = 1_000_000_000_000;
    logo = null;
    decimals = opt 8;
    transfer_fee = opt 10_000;
    archive_options = null;
    initial_block_reward = 1_000_000;
    initial_difficulty = 16;
    block_time_target_seconds = 20;
    difficulty_adjustment_blocks = 1;
})'

# Deploy with or without reinstall mode based on argument
if [ "$REINSTALL" = true ]; then
  echo "Deploying token_backend with reinstall mode..."
  dfx deploy token_backend --argument "$INIT_ARGS" --mode reinstall
else
  echo "Deploying token_backend..."
  dfx deploy token_backend --argument "$INIT_ARGS"
fi

# Get canister ID
# CANISTER_ID=$(dfx canister id token_backend --network=ic)
# echo "Canister ID: $CANISTER_ID"
echo "Deployment complete!"
