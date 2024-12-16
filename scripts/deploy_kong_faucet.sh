#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..

if [ "$1" == "staging" ]; then
    bash create_canister_id.sh staging
    dfx deploy kong_faucet --network staging
elif [ "$1" == "local" ]; then
    if CANISTER_ID=$(jq -r ".[\"kong_faucet\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            echo "Deploying kong_faucet with ID: ${CANISTER_ID}"
            dfx deploy kong_faucet --network local --specified-id "${CANISTER_ID}" || true
        }
    fi
else
    exit 1
fi
