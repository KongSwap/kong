#!/bin/bash
set -ex

# Check if an argument was provided
if [ $# -eq 0 ]; then
        echo "Error: No argument provided to build_rust_canister.sh"
        echo "Usage: $0 <CANISTER_NAME>"
        exit 1
fi

CANISTER_NAME=$1

# CRITICAL: Identify the SOURCE candid file (manually edited with all types)
if [ "$CANISTER_NAME" == "miner" ]; then
    SOURCE_CANDID_FILE="src/${CANISTER_NAME}/src/${CANISTER_NAME}.did"
else
    # For token_backend, we use the src/ directory version which has ALL types
    SOURCE_CANDID_FILE="src/${CANISTER_NAME}/src/${CANISTER_NAME}.did"
fi

# Ensure the source candid file exists
if [ ! -f "$SOURCE_CANDID_FILE" ]; then
    echo "ERROR: Source candid file not found at $SOURCE_CANDID_FILE"
    exit 1
fi

# Clean the specific package to ensure fresh build
echo "Cleaning $CANISTER_NAME package..."
cargo clean -p "$CANISTER_NAME"

# Build the Rust canister
echo "Building $CANISTER_NAME..."
cargo build -p "$CANISTER_NAME" --release --target wasm32-unknown-unknown

# Add the COMPLETE candid file as metadata to the WASM
echo "Adding COMPLETE candid metadata to WASM file..."
ic-wasm "target/wasm32-unknown-unknown/release/${CANISTER_NAME}.wasm" -o "target/wasm32-unknown-unknown/release/${CANISTER_NAME}.wasm" metadata candid:service -f "$SOURCE_CANDID_FILE" -v public

echo "Build complete for $CANISTER_NAME with COMPLETE types"