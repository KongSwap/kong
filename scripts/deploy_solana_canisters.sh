#!/bin/bash

# Script to deploy Solana integration canisters for Kong DEX
# This script should be run from the project root directory

set -e

# Check if WASM files exist, if not, download them
if [ ! -f "wasm/ic-solana-rpc.wasm.gz" ] || [ ! -f "wasm/ic-solana-wallet.wasm.gz" ]; then
    echo "WASM files not found. Downloading..."
    ./wasm/solana/download_ic_solana.sh
else
    echo "WASM files found. Proceeding with deployment..."
fi

# Deploy the Solana RPC canister
echo "Deploying Solana RPC canister..."
dfx deploy solana_rpc --argument '(record {})'

# Get the Solana RPC canister ID
SOLANA_RPC_ID=$(dfx canister id solana_rpc)
echo "Solana RPC canister deployed with ID: $SOLANA_RPC_ID"

# Deploy the Solana wallet canister
echo "Deploying Solana wallet canister..."
dfx deploy solana_wallet --argument "(record { sol_canister = opt principal \"$SOLANA_RPC_ID\"; schnorr_key = null })"

# Get the Solana wallet canister ID
SOLANA_WALLET_ID=$(dfx canister id solana_wallet)
echo "Solana wallet canister deployed with ID: $SOLANA_WALLET_ID"

echo "Deployment completed successfully!"
echo "Solana RPC canister ID: $SOLANA_RPC_ID"
echo "Solana wallet canister ID: $SOLANA_WALLET_ID"

# Add these canister IDs to the Kong settings
echo ""
echo "Next steps:"
echo "1. Update Kong settings with the Solana canister IDs:"
echo "   - RPC canister ID: $SOLANA_RPC_ID"
echo "   - Wallet canister ID: $SOLANA_WALLET_ID"
echo "2. Configure RPC endpoints in the Solana RPC canister"
echo "   - For testnet: dfx canister call solana_rpc addProvider '(record { url = \"https://api.testnet.solana.com\"; weight = 1 })'"
echo "   - For mainnet: dfx canister call solana_rpc addProvider '(record { url = \"https://api.mainnet-beta.solana.com\"; weight = 1 })'"