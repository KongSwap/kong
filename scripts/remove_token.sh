#!/usr/bin/env bash

# Script to remove a token from Kong backend (admin only)

NETWORK="${1:-local}"
TOKEN_ID="${2}"

if [ -z "$TOKEN_ID" ]; then
    echo "Usage: $0 [network] <token_id>"
    echo "Example: $0 local 4"
    exit 1
fi

NETWORK_FLAG=""
if [ "${NETWORK}" != "local" ]; then
    NETWORK_FLAG="--network ${NETWORK}"
fi
IDENTITY="--identity kong"
KONG_CANISTER=$(dfx canister id ${NETWORK_FLAG} kong_backend)

echo "Removing token with ID ${TOKEN_ID}..."

dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_CANISTER} remove_token "(${TOKEN_ID})"