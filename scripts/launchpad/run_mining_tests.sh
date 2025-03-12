#!/bin/bash

echo "Running mining flow tests..."

# Set environment variables
export POCKET_IC_BIN="$(pwd)/pocket-ic"
export POCKET_IC_IGNORE_VERSION=1

# Make sure the binary is executable
chmod +x "$POCKET_IC_BIN"

# Check for WASM files in the correct location
if [ ! -f "src/kong_svelte/static/wasms/token_backend/token_backend.wasm" ] || [ ! -f "src/kong_svelte/static/wasms/miner/miner.wasm" ]; then
    echo "WASM files not found in src/kong_svelte/static/wasms/"
    echo "Please run ./scripts/launchpad/get_latest_wasms.sh first"
    exit 1
fi

# Verify PocketIC binary
echo "Using PocketIC binary: $POCKET_IC_BIN"
echo "PocketIC version: $($POCKET_IC_BIN --version)"
echo "POCKET_IC_IGNORE_VERSION=$POCKET_IC_IGNORE_VERSION"

# Run the tests
echo "Running mining flow test..."
cd src/miner && cargo test --test mining_flow_test -- --nocapture

echo "Tests completed." 