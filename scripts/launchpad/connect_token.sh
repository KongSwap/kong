#!/bin/bash

# This script connects a token canister to the miner by its canister name
# Usage: ./connect_token.sh <miner_name> <token_canister_name>

if [ $# -ne 2 ]; then
    echo "Usage: $0 <miner_name> <token_canister_name>"
    echo "Example: $0 miner1 token_backend"
    exit 1
fi

MINER_NAME=$1
TOKEN_NAME=$2

# Get the principal ID from the canister name
TOKEN_BACKEND=$(dfx canister id "$TOKEN_NAME")

dfx canister call "$MINER_NAME" connect_token "(principal \"$TOKEN_BACKEND\")"
