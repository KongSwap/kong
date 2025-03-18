#!/usr/bin/env bash
set -euo pipefail

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
WASM_BASE_DIR="$PROJECT_ROOT/src/kong_svelte/static/wasms"
TOKEN_BACKEND_DIR="$PROJECT_ROOT/src/token_backend"

# Source candid files (the source of truth with ALL types)
TOKEN_BACKEND_SRC_CANDID="$PROJECT_ROOT/src/token_backend/src/token_backend.did"
MINER_SRC_CANDID="$PROJECT_ROOT/src/miner/src/miner.did"

# Verify source candid files exist
if [ ! -f "$TOKEN_BACKEND_SRC_CANDID" ]; then
    echo "ERROR: Token backend source candid file not found at $TOKEN_BACKEND_SRC_CANDID"
    exit 1
fi

if [ ! -f "$MINER_SRC_CANDID" ]; then
    echo "ERROR: Miner source candid file not found at $MINER_SRC_CANDID"
    exit 1
fi

# Clean up any existing declarations to force regeneration
echo "Cleaning up existing declarations..."
rm -rf "$PROJECT_ROOT/src/declarations/token_backend"
rm -rf "$PROJECT_ROOT/src/declarations/miner"

# Check if ic-wasm is installed
if ! command -v ic-wasm &>/dev/null; then
    echo "ic-wasm is not installed. Installing..." # Checking and installing ic-wasm if not present
    cargo install ic-wasm
fi

# DFINITY IC commit hash and URLs for ICRC
IC_COMMIT="c87abf70cf6f0f81f7f16d9f517c3ff0db1fab1e"
ICRC_WASM_URL="https://download.dfinity.systems/ic/${IC_COMMIT}/canisters/ic-icrc1-ledger-u256.wasm.gz"
ICRC_DID_URL="https://raw.githubusercontent.com/dfinity/ic/${IC_COMMIT}/rs/rosetta-api/icrc1/ledger/ledger.did"

# Create WASM directories
mkdir -p "$WASM_BASE_DIR/miner"
mkdir -p "$WASM_BASE_DIR/token_backend"
mkdir -p "$WASM_BASE_DIR/ledger"
mkdir -p "$TOKEN_BACKEND_DIR"

# 1. Download ICRC ledger WASM and candid
echo "Fetching ICRC ledger..." # Step 1: Initiating download of ICRC ledger WASM and candid files

curl -L "$ICRC_WASM_URL" | gunzip >"$WASM_BASE_DIR/ledger/ledger.wasm" # Downloading and extracting ICRC ledger WASM
curl -L "$ICRC_DID_URL" >"$WASM_BASE_DIR/ledger/ledger.did" # Downloading ICRC ledger candid file

# Clear dfx cache
echo "Clearing dfx cache..."
dfx cache delete

# Copy source candid files to their dfx locations first
echo "Copying source candid files to dfx locations..."
mkdir -p "$PROJECT_ROOT/src/token_backend"

# Only copy if the files are different
echo "Copying token_backend.did to dfx location..."
if ! cmp -s "$TOKEN_BACKEND_SRC_CANDID" "$PROJECT_ROOT/src/token_backend/token_backend.did"; then
    cp "$TOKEN_BACKEND_SRC_CANDID" "$PROJECT_ROOT/src/token_backend/token_backend.did"
fi

# Generate declarations BEFORE building frontend
echo "Generating declarations from source candid files..."
if ! dfx generate token_backend; then
    echo "ERROR: Failed to generate declarations for token_backend!"
    exit 1
fi

if ! dfx generate miner; then
    echo "ERROR: Failed to generate declarations for miner!"
    exit 1
fi

# Verify that declarations were generated with the correct types
if ! grep -q "TokenAllInfo" "$PROJECT_ROOT/src/declarations/token_backend/token_backend.did"; then
    echo "ERROR: TokenAllInfo type not found in generated declarations!"
    echo "Checking if TokenAllInfo exists in the source file:"
    grep -A 5 "TokenAllInfo" "$TOKEN_BACKEND_SRC_CANDID" || echo "Not found in source file either!"
    exit 1
fi

# Verify miner declarations as well
if ! grep -q "start_mining" "$PROJECT_ROOT/src/declarations/miner/miner.did"; then
    echo "ERROR: start_mining function not found in miner declarations!"
    echo "Checking if start_mining exists in the source file:"
    grep -A 5 "start_mining" "$MINER_SRC_CANDID" || echo "Not found in source file either!"
    exit 1
fi

# Switch to project root
cd "$PROJECT_ROOT"

# 2. Build token_backend and miner WASMs
echo "Building local canisters..." # Step 2: Starting build process for local canisters

# First build the token_backend frontend
echo "Building token_backend frontend..." # Step 2.1: Building token_backend frontend
sh scripts/launchpad/upgrade_token_backend_fe.sh

# Build token_backend using the custom script
echo "Building token_backend canister..." # Step 2.2: Building token_backend canister
sh scripts/build_rust_canister.sh token_backend

# Build miner using the custom script
echo "Building miner canister..." # Step 2.3: Building miner canister
sh scripts/build_rust_canister.sh miner

# Copy optimized WASM files to their final destinations
cp "target/wasm32-unknown-unknown/release/token_backend.wasm" "$WASM_BASE_DIR/token_backend/token_backend.wasm" # Copying optimized token_backend WASM
cp "target/wasm32-unknown-unknown/release/miner.wasm" "$WASM_BASE_DIR/miner/miner.wasm" # Copying optimized miner WASM

# Copy Candid files to static assets for frontend access (from SOURCE candid files)
echo "Copying SOURCE candid files to static assets..."
cp "$TOKEN_BACKEND_SRC_CANDID" "$WASM_BASE_DIR/token_backend/token_backend.did"
cp "$MINER_SRC_CANDID" "$WASM_BASE_DIR/miner/miner.did"
cp "$MINER_SRC_CANDID" "$PROJECT_ROOT/src/kong_svelte/src/miner.did"

# Compress and hash
echo "Compressing and hashing..." # Step 4: Compressing WASM files and generating hashes
gzip -9 -kf "$WASM_BASE_DIR/ledger/ledger.wasm" # Compressing ledger WASM in static folder
gzip -9 -kf "$WASM_BASE_DIR/token_backend/token_backend.wasm" # Compressing token_backend WASM in static folder 
gzip -9 -kf "$WASM_BASE_DIR/miner/miner.wasm" # Compressing miner WASM in static folder

find "$WASM_BASE_DIR" -name "*.wasm" | while read -r wasm; do
    sha256sum "$wasm" >"${wasm}.sha256" # Generating SHA-256 hash for each WASM file
done

# Final check to ensure declarations still have ALL types
echo "Final verification of declarations..."
if grep -q "TokenAllInfo" "$PROJECT_ROOT/src/declarations/token_backend/token_backend.did"; then
    echo "SUCCESS: TokenAllInfo type found in token_backend declarations!"
else
    echo "ERROR: TokenAllInfo type NOT found in token_backend declarations. Something went wrong."
    exit 1
fi

if grep -q "start_mining" "$PROJECT_ROOT/src/declarations/miner/miner.did"; then
    echo "SUCCESS: start_mining function found in miner declarations!"
else
    echo "ERROR: start_mining function NOT found in miner declarations. Something went wrong."
    exit 1
fi

echo "All required WASMs/DIDs/hashes available in: $PROJECT_ROOT/src/kong_svelte/static/wasms"
echo "Process complete. Declarations are up to date with ALL types from source candid files."