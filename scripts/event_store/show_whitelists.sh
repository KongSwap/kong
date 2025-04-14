#!/bin/bash
# Usage: ./show_whitelists.sh [network]

NETWORK=""

if [ -n "$1" ]; then
    NETWORK="--network $1"
fi

IDENTITY="--identity kong"

echo "========== PUSH & READ WHITELISTS =========="
dfx canister $NETWORK $IDENTITY call event_store whitelisted_principals "()"