#!/bin/bash

# Exit on error
set -e

# Check if miner name is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <miner_name>"
    echo "Example: $0 miner1"
    exit 1
fi

MINER_NAME=$1

echo "Building project..."
cargo build --target wasm32-unknown-unknown --release -p miner

# Get owner principal from current identity
echo "Current identity: $(dfx identity whoami)"
OWNER_PRINCIPAL=$(dfx identity get-principal)
echo "Owner principal: $OWNER_PRINCIPAL"

echo "Deploying $MINER_NAME with owner: $OWNER_PRINCIPAL"

# Create init args for miner
INIT_ARGS="(record { owner = principal \"$OWNER_PRINCIPAL\" })"

echo "Deploying $MINER_NAME with args: $INIT_ARGS"

dfx deploy "$MINER_NAME" --argument "$INIT_ARGS"

echo "Verifying $MINER_NAME info..."
dfx canister call "$MINER_NAME" get_info

echo "Deployment complete!"
