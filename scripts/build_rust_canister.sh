#!/bin/bash
set -ex

# Check if an argument was provided
if [ $# -eq 0 ]; then
        echo "Error: No argument provided to build_rust_canister.sh"
        echo "Usage: $0 <CANISTER_NAME>"
        exit 1
fi

CANISTER_NAME=$1

# Make sure the output directory exists
mkdir -p "target/wasm32-unknown-unknown/release"
touch "src/${CANISTER_NAME}/${CANISTER_NAME}.did"
# touch "target/wasm32-unknown-unknown/release/${CANISTER_NAME}-ic.wasm"
touch "target/wasm32-unknown-unknown/release/${CANISTER_NAME}.wasm"

# Build the Rust canister
cargo build -p "$CANISTER_NAME" --release --target wasm32-unknown-unknown

# Optimize the Wasm file
# INPUT_WASM="target/wasm32-unknown-unknown/release/${CANISTER_NAME}.wasm"
# OUTPUT_WASM="target/wasm32-unknown-unknown/release/${CANISTER_NAME}-ic.wasm"
# ic-wasm "$INPUT_WASM" -o "$OUTPUT_WASM" shrink

# Extract the Candid interface
CANDID_INPUT="target/wasm32-unknown-unknown/release/${CANISTER_NAME}.wasm"
CANDID_OUTPUT="src/${CANISTER_NAME}/${CANISTER_NAME}.did"
candid-extractor "$CANDID_INPUT" >"$CANDID_OUTPUT"

dfx generate ${CANISTER_NAME}