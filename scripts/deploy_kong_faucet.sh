#!/usr/bin/env bash

NETWORK="--network $1"
IDENTITY="--identity kong"
KONG_FAUCET=kong_faucet

if [ "$1" == "staging" ]; then
    bash create_canister_id.sh staging
    KONG_BUILDENV="staging" dfx deploy ${KONG_FAUCET} ${NETWORK}
elif [ "$1" == "local" ]; then
    original_dir=$(pwd)
    root_dir="${original_dir}"/..
    if CANISTER_ID=$(jq -r ".[\"kong_faucet\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            SPECIFIED_ID="--specified-id ${CANISTER_ID}"
            KONG_BUILDENV="local" dfx deploy ${KONG_FAUCET} ${NETWORK} ${SPECIFIED_ID} || true
        }
    fi
fi
