#!/bin/bash

# Script to download the latest ic-solana canister WASM and DID files
# This script should be run from the project root directory

set -e

SOLANA_DIR="wasm/solana"
TEMP_DIR="$SOLANA_DIR/temp"
REPO_URL="https://github.com/mfactory-lab/ic-solana"
BRANCH="main"

# Create temporary directory
mkdir -p "$TEMP_DIR"
echo "Created temporary directory: $TEMP_DIR"

# Download the RPC canister WASM and DID files
echo "Downloading ic-solana-rpc canister files..."
curl -L "$REPO_URL/raw/$BRANCH/ic-solana-rpc.wasm.gz" -o "$SOLANA_DIR/ic-solana-rpc.wasm.gz"
curl -L "$REPO_URL/raw/$BRANCH/src/ic-solana-rpc/ic-solana-rpc.did" -o "$SOLANA_DIR/ic-solana-rpc.did"

# Download the wallet canister WASM and DID files
echo "Downloading ic-solana-wallet canister files..."
curl -L "$REPO_URL/raw/$BRANCH/ic-solana-wallet.wasm.gz" -o "$SOLANA_DIR/ic-solana-wallet.wasm.gz"
curl -L "$REPO_URL/raw/$BRANCH/src/ic-solana-wallet/ic-solana-wallet.did" -o "$SOLANA_DIR/ic-solana-wallet.did"

# Copy the files to the wasm directory
echo "Copying files to the wasm directory..."
cp "$SOLANA_DIR/ic-solana-rpc.wasm.gz" "wasm/ic-solana-rpc.wasm.gz"
cp "$SOLANA_DIR/ic-solana-rpc.did" "wasm/ic-solana-rpc.did"
cp "$SOLANA_DIR/ic-solana-wallet.wasm.gz" "wasm/ic-solana-wallet.wasm.gz"
cp "$SOLANA_DIR/ic-solana-wallet.did" "wasm/ic-solana-wallet.did"

# Clean up
rm -rf "$TEMP_DIR"
echo "Temporary directory removed."

echo "Download completed successfully!"
echo "WASM and DID files are available in the wasm directory."