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
    original_dir=$(pwd)
    root_dir="${original_dir}"/..
    if CANISTER_ID=$(jq -r ".[\"kong_backend\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            SPECIFIED_ID="--specified-id ${CANISTER_ID}"
            KONG_BUILDENV="local" dfx deploy ${KONG_BACKEND} ${NETWORK} ${IDENTITY} ${SPECIFIED_ID} || true
        }
    fi
fi

dfx canister call kong_backend cache_solana_address