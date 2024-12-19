#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..

npm -w kong_svelte i

if [ $1 == "ic" ]; then
    bash create_canister_id.sh ic
    dfx build kong_svelte --network ic
elif [ $1 == "staging" ]; then
    bash create_canister_id.sh staging
    dfx deploy kong_svelte --network staging
elif [ $1 == "local" ]; then
    if CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            dfx deploy kong_svelte --network local --specified-id "${CANISTER_ID}" || true
        }
    fi
fi