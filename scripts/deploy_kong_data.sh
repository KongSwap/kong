#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..

if [ "$1" == "ic" ]; then
    bash create_canister_id.sh ic
    KONG_BUILDENV="ic" dfx build kong_data --network ic
    bash gzip_kong_data.sh ic
elif [ "$1" == "staging" ]; then
    bash create_canister_id.sh staging
    dfx deploy kong_data --network staging
elif [ "$1" == "local" ]; then
    if CANISTER_ID=$(jq -r ".[\"kong_data\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            echo "Deploying kong_data with ID: ${CANISTER_ID}"
            dfx deploy kong_data --network local --specified-id "${CANISTER_ID}" || true
        }
    fi
fi
