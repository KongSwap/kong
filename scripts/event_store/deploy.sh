#!/bin/bash
# Usage: ./deploy.sh [network] [reinstall]

if [ -z "$1" ]; then
    NETWORK=""
else
    NETWORK="--network $1"
fi

REINSTALL=""
if [ "$2" = "reinstall" ]; then
    REINSTALL="--mode reinstall"
fi

IDENTITY="--identity kong"
if ! PRINCIPAL_ID=$(dfx identity get-principal --identity kong); then
    echo "Error: Failed to get principal for identity 'kong'"
    exit 1
fi

echo "Deploying: event_store"
dfx deploy ${NETWORK} ${IDENTITY} ${REINSTALL} event_store --subnet-type fiduciary --argument "(
    record {
        push_events_whitelist = vec { principal \"${PRINCIPAL_ID}\" };
        read_events_whitelist = vec { principal \"${PRINCIPAL_ID}\" };
        admin_whitelist = vec { principal \"${PRINCIPAL_ID}\" };
    }
)"
