#!/usr/bin/env bash
set -euo pipefail

# Directory setup
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WASM_BASE_DIR="$PROJECT_ROOT/src/kong_svelte/static/wasm"

# Check if ic-wasm is installed
if ! command -v ic-wasm &> /dev/null; then
    echo "ic-wasm is not installed. Installing..."
    cargo install ic-wasm
fi

# DFINITY IC commit hash and URLs for ICRC
IC_COMMIT="c87abf70cf6f0f81f7f16d9f517c3ff0db1fab1e"
ICRC_WASM_URL="https://download.dfinity.systems/ic/${IC_COMMIT}/canisters/ic-icrc1-ledger-u256.wasm.gz"
ICRC_DID_URL="https://raw.githubusercontent.com/dfinity/ic/${IC_COMMIT}/rs/rosetta-api/icrc1/ledger/ledger.did"

# Create WASM directories
mkdir -p "$WASM_BASE_DIR/icrc_wasm"
mkdir -p "$WASM_BASE_DIR/miner_wasm"
mkdir -p "$WASM_BASE_DIR/token_backend_wasm"
mkdir -p "$PROJECT_ROOT/src/kong_svelte/static/wasms"

# 1. Download ICRC ledger WASM and candid
echo "Fetching ICRC ledger..."
curl -L "$ICRC_WASM_URL" | gunzip > "$WASM_BASE_DIR/icrc_wasm/ledger.wasm"
curl -L "$ICRC_DID_URL" > "$WASM_BASE_DIR/icrc_wasm/ledger.did"
cp "$WASM_BASE_DIR/icrc_wasm/ledger.did" "$PROJECT_ROOT/src/kong_svelte/src/icrc_ledger.did"

# 2. Build token_backend and miner WASMs
echo "Building local canisters..."
cd "$PROJECT_ROOT"

# Build token_backend
echo "Building token_backend..."
cargo build --target wasm32-unknown-unknown --release -p token_backend
cp "target/wasm32-unknown-unknown/release/token_backend.wasm" "$WASM_BASE_DIR/token_backend_wasm/token_backend.wasm"
candid-extractor target/wasm32-unknown-unknown/release/token_backend.wasm > "$WASM_BASE_DIR/token_backend_wasm/token_backend.did"
cp "$WASM_BASE_DIR/token_backend_wasm/token_backend.did" "$PROJECT_ROOT/src/kong_svelte/src/token_backend.did"
ic-wasm "$WASM_BASE_DIR/token_backend_wasm/token_backend.wasm" -o "$WASM_BASE_DIR/token_backend_wasm/token_backend.wasm" metadata candid:service -f "$WASM_BASE_DIR/token_backend_wasm/token_backend.did" -v public

# Build miner
echo "Building miner..."
cargo build --target wasm32-unknown-unknown --release -p miner
cp "target/wasm32-unknown-unknown/release/miner.wasm" "$WASM_BASE_DIR/miner_wasm/miner.wasm"
candid-extractor target/wasm32-unknown-unknown/release/miner.wasm > "$WASM_BASE_DIR/miner_wasm/miner.did"
cp "$WASM_BASE_DIR/miner_wasm/miner.did" "$PROJECT_ROOT/src/kong_svelte/src/miner.did"
ic-wasm "$WASM_BASE_DIR/miner_wasm/miner.wasm" -o "$WASM_BASE_DIR/miner_wasm/miner.wasm" metadata candid:service -f "$WASM_BASE_DIR/miner_wasm/miner.did" -v public

# Copy all required assets to frontend
echo "Copying frontend resources..."
cp "$WASM_BASE_DIR/icrc_wasm/ledger.wasm" "$PROJECT_ROOT/src/kong_svelte/static/wasms/"
cp "$WASM_BASE_DIR/icrc_wasm/ledger.did" "$PROJECT_ROOT/src/kong_svelte/static/wasms/"
cp "$WASM_BASE_DIR/token_backend_wasm/token_backend.wasm" "$PROJECT_ROOT/src/kong_svelte/static/wasms/"
cp "$WASM_BASE_DIR/token_backend_wasm/token_backend.did" "$PROJECT_ROOT/src/kong_svelte/static/wasms/"
cp "$WASM_BASE_DIR/miner_wasm/miner.wasm" "$PROJECT_ROOT/src/kong_svelte/static/wasms/"
cp "$WASM_BASE_DIR/miner_wasm/miner.did" "$PROJECT_ROOT/src/kong_svelte/static/wasms/"

# Compress and hash
echo "Compressing and hashing..."
gzip -9 -k "$PROJECT_ROOT/src/kong_svelte/static/wasms/ledger.wasm"
gzip -9 -k "$PROJECT_ROOT/src/kong_svelte/static/wasms/token_backend.wasm"
gzip -9 -k "$PROJECT_ROOT/src/kong_svelte/static/wasms/miner.wasm"

find "$PROJECT_ROOT/src/kong_svelte/static/wasms" -name "*.wasm" | while read -r wasm; do
    sha256sum "$wasm" > "${wasm}.sha256"
done

echo "All required WASMs/DIDs/hashes available in:\n$PROJECT_ROOT/src/kong_svelte/static/wasms"
