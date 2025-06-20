#!/usr/bin/env bash

set -e

IDENTITY="--identity kong_token_minter"
NETWORK="--network local"
TOKEN_LEDGER="icp_ledger"
TRANSFER_FEE=10_000

# Get the principal for minting initial tokens
PRINCIPAL=$(dfx identity ${IDENTITY} get-principal)
echo "Using principal: ${PRINCIPAL}"

# First, try to delete the existing canister if it exists
echo "Attempting to delete existing canister..."
dfx canister ${NETWORK} delete ${TOKEN_LEDGER} || true

# Create a new canister with a specific ID
echo "Creating new canister..."
CANISTER_ID=$(dfx canister ${NETWORK} create ${TOKEN_LEDGER} ${IDENTITY} --no-wallet | grep -o "[a-z0-9-]*-cai")
echo "Created canister with ID: ${CANISTER_ID}"

# Deploy the ICP ledger with minimal arguments
echo "Deploying ICP ledger canister..."
dfx canister ${NETWORK} ${IDENTITY} install ${TOKEN_LEDGER} --wasm-module="https://download.dfinity.systems/ic/c87abf70cf6f0f81f7f16d9f517c3ff0db1fab1e/canisters/ledger-canister.wasm.gz" --mode=reinstall --argument="(variant {Init = record {minting_account = \"${PRINCIPAL}\"; transfer_fee = opt record {e8s = ${TRANSFER_FEE} : nat64}; token_symbol = opt \"ICP\"; token_name = opt \"Internet Computer (KongSwap Test Token)\"}})"

echo "Deployment completed successfully!"