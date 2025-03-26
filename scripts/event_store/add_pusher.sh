#!/bin/bash
# Usage: ./add_pusher.sh <principal_id> [network]

if [ -z "$1" ]; then
    echo "Usage: $0 <principal_id> [network]"
    echo "Example: $0 abc-123 ic"
    exit 1
fi

PRINCIPAL_ID="$1"
NETWORK=""

if [ -n "$2" ]; then
    NETWORK="--network $2"
fi

IDENTITY="--identity kong"

echo "Adding principal to push whitelist: $PRINCIPAL_ID"
dfx canister $NETWORK $IDENTITY call event_store update_push_whitelist "(vec { principal \"$PRINCIPAL_ID\" }, variant { add })"
echo "Done!"