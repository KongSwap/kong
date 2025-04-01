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
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")" 
TOKEN_BACKEND_DIR="$PROJECT_ROOT/src/token_backend"

# Check if directories exist
if [ ! -d "$PROJECT_ROOT" ]; then
  echo "Error: Project root directory not found at $PROJECT_ROOT"
  exit 1
fi

if [ ! -d "$TOKEN_BACKEND_DIR" ]; then
  echo "Error: Token backend directory not found at $TOKEN_BACKEND_DIR"
  exit 1
fi

# Removed Frontend build steps

cd "$PROJECT_ROOT"

# Build the Rust backend from source
echo "Building token_backend..."
cargo build --target wasm32-unknown-unknown --release -p token_backend

# Default initialization arguments
INIT_ARGS='(record {
    name = "Floppa";
    ticker = "FLOPS";
    total_supply = 21_000_000_0000_0000;
    logo = null;
    decimals = opt 8;
    transfer_fee = opt 10_000;
    archive_options = null;
    initial_block_reward = 5000000000;
    block_time_target_seconds = 15;
    halving_interval = 1000;
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