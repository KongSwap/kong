#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..
static_dir="${root_dir}/src/kong_svelte/static/.well-known"

# Add this at the very top of the script after initial_dir definitions
NETWORK=${1:-local}

# Deploy prediction markets backend canister
root_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/.. && pwd )"

npm i

if [ $1 == "ic" ]; then
    bash create_canister_id.sh ic
    CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"ic\"]" "${root_dir}"/canister_ids.all.json)
    dfx build kong_svelte --network ic
elif [ $1 == "staging" ]; then
    bash create_canister_id.sh staging
    CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"staging\"]" "${root_dir}"/canister_ids.all.json)
    dfx deploy kong_svelte --network staging
elif [ $1 == "local" ]; then
    CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"local\"]" "${root_dir}"/canister_ids.all.json)
    echo "CANISTER_ID: ${CANISTER_ID}"
    dfx deploy kong_svelte --specified-id "${CANISTER_ID}"
fi
