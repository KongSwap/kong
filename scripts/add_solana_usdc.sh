#!/usr/bin/env bash

# Script to add USDC token on Solana to Kong backend

NETWORK="${1:-local}"
NETWORK_FLAG=""
if [ "${NETWORK}" != "local" ]; then
    NETWORK_FLAG="--network ${NETWORK}"
fi
IDENTITY="--identity kong"
KONG_CANISTER=$(dfx canister id ${NETWORK_FLAG} kong_backend)

# Add USDC token
echo "Adding USDC (Solana) token to Kong backend..."

dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_CANISTER} add_token --output json "(record {
    token = \"SOL.EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\";
    on_kong = opt true;
})" | jq

echo "USDC token added successfully!"