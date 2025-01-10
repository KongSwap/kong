#!/usr/bin/env bash

NETWORK="--network $1"
IDENTITY="--identity kong"
KONG_DATA=kong_data

if [ "$1" == "ic" ]; then
    bash create_canister_id.sh ic
    KONG_BUILDENV="ic" dfx build ${KONG_DATA} ${NETWORK}
    echo "Deploy kong_data: dfx deploy ${KONG_DATA} ${NETWORK}"
elif [ "$1" == "staging" ]; then
    bash create_canister_id.sh staging
    KONG_BUILDENV="staging" dfx deploy ${KONG_DATA} ${NETWORK} ${IDENTITY}
elif [ "$1" == "local" ]; then
    original_dir=$(pwd)
    root_dir="${original_dir}"/..
    if CANISTER_ID=$(jq -r ".[\"kong_data\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            SPECIFIED_ID="--specified-id ${CANISTER_ID}"
            KONG_BUILDENV="local" dfx deploy ${KONG_DATA} ${NETWORK} ${IDENTITY} ${SPECIFIED_ID} || true
        }
    fi
fi
