#!/usr/bin/env bash

NETWORK="--network $1"
IDENTITY="--identity kong"
KONG_BACKEND=kong_backend

if [ "$1" == "ic" ]; then
    bash create_canister_id.sh ic
    KONG_BUILDENV="ic" dfx build ${KONG_BACKEND} ${NETWORK}
    bash gzip_kong_backend.sh ic
elif [ "$1" == "staging" ]; then
    bash create_canister_id.sh staging
    KONG_BUILDENV="staging" dfx deploy ${KONG_BACKEND} ${NETWORK} ${IDENTITY}
elif [ "$1" == "local" ]; then
    # Get the script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
    
    # Source .env file to get canister IDs
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        . "${PROJECT_ROOT}/.env"
        if [ ! -z "${CANISTER_ID_KONG_BACKEND}" ]; then
            SPECIFIED_ID="--specified-id ${CANISTER_ID_KONG_BACKEND}"
            KONG_BUILDENV="local" dfx deploy ${KONG_BACKEND} ${NETWORK} ${IDENTITY} ${SPECIFIED_ID} || true
        else
            echo "Warning: CANISTER_ID_KONG_BACKEND not found in .env"
            KONG_BUILDENV="local" dfx deploy ${KONG_BACKEND} ${NETWORK} ${IDENTITY} || true
        fi
    else
        echo "Error: .env file not found"
        exit 1
    fi
fi
