#!/usr/bin/env bash
set -euo pipefail

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
WASM_BASE_DIR="$PROJECT_ROOT/src/kong_svelte/static/wasms"
TOKEN_BACKEND_DIR="$PROJECT_ROOT/src/token_backend"

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

# 2. Build token_backend and miner WASMs
echo "Building local canisters..." # Step 2: Starting build process for local canisters
cd "$PROJECT_ROOT"

# Build token_backend
echo "Building token_backend..." # Step 2.1: Building token_backend canister
sh scripts/launchpad/upgrade_token_backend_fe.sh
cargo clean -p token_backend # Clean token_backend to ensure fresh build
cargo build --target wasm32-unknown-unknown --release -p token_backend # Compiling token_backend to WASM
candid-extractor target/wasm32-unknown-unknown/release/token_backend.wasm > "$WASM_BASE_DIR/token_backend/token_backend.did" # Extracting candid interface for token_backend
ic-wasm "target/wasm32-unknown-unknown/release/token_backend.wasm" -o "target/wasm32-unknown-unknown/release/token_backend.wasm" metadata candid:service -f "$WASM_BASE_DIR/token_backend/token_backend.did" -v public # Adding metadata to token_backend WASM

# Build miner
echo "Building miner..." # Step 2.2: Building miner canister
cargo clean -p miner # Clean miner to ensure fresh build
cargo build --target wasm32-unknown-unknown --release -p miner # Compiling miner to WASM
candid-extractor target/wasm32-unknown-unknown/release/miner.wasm >"$WASM_BASE_DIR/miner/miner.did" # Extracting candid interface for miner
ic-wasm "target/wasm32-unknown-unknown/release/miner.wasm" -o "target/wasm32-unknown-unknown/release/miner.wasm" metadata candid:service -f "$WASM_BASE_DIR/miner/miner.did" -v public # Adding metadata to miner WASM

# Copy optimized WASM files to their final destinations
cp "target/wasm32-unknown-unknown/release/token_backend.wasm" "$WASM_BASE_DIR/token_backend/token_backend.wasm" # Copying optimized token_backend WASM
cp "target/wasm32-unknown-unknown/release/miner.wasm" "$WASM_BASE_DIR/miner/miner.wasm" # Copying optimized miner WASM

# Copy Candid files to where dfx expects them
cp "$WASM_BASE_DIR/miner/miner.did" "$PROJECT_ROOT/src/kong_svelte/src/miner.did"
# IMPORTANT: Copy to the location specified in dfx.json
cp "$WASM_BASE_DIR/miner/miner.did" "$PROJECT_ROOT/src/miner/src/miner.did"
mkdir -p "$PROJECT_ROOT/src/token_backend"
cp "$WASM_BASE_DIR/token_backend/token_backend.did" "$PROJECT_ROOT/src/token_backend/token_backend.did"

# Compress and hash
echo "Compressing and hashing..." # Step 4: Compressing WASM files and generating hashes
gzip -9 -kf "$WASM_BASE_DIR/ledger/ledger.wasm" # Compressing ledger WASM in static folder
gzip -9 -kf "$WASM_BASE_DIR/token_backend/token_backend.wasm" # Compressing token_backend WASM in static folder 
gzip -9 -kf "$WASM_BASE_DIR/miner/miner.wasm" # Compressing miner WASM in static folder

find "$WASM_BASE_DIR" -name "*.wasm" | while read -r wasm; do
    sha256sum "$wasm" >"${wasm}.sha256" # Generating SHA-256 hash for each WASM file
done

# Clean dfx cache to ensure fresh generation
dfx cache delete

# Generate declarations with the updated Candid files
dfx generate token_backend
dfx generate miner

echo "All required WASMs/DIDs/hashes available in:\n$PROJECT_ROOT/src/kong_svelte/static/wasms"