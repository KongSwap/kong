#!/usr/bin/env bash

# Script to add USDC token to Kong backend
# For production: Uses mainnet USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
# For local/staging: Uses devnet USDC (4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU)
# $: solana address
# SPL devnet usdc faucet: https://faucet.circle.com/

NETWORK="${1:-local}"
NETWORK_FLAG=""
if [ "${NETWORK}" != "local" ]; then
    NETWORK_FLAG="--network ${NETWORK}"
fi
IDENTITY="--identity kong"
KONG_CANISTER=$(dfx canister id ${NETWORK_FLAG} kong_backend)

# Add USDC token - will use appropriate address based on build features
echo "Adding USDC token to Kong backend..."

dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_CANISTER} add_token --output json "(record {
    token = \"SOL.4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU\";
    on_kong = opt true;
})" | jq

echo "USDC token added successfully!"