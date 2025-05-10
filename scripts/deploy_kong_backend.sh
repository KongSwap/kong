#!/usr/bin/env bash

SUB_SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

NETWORK="--network $1"
IDENTITY="--identity kong"
KONG_BACKEND=kong_backend

if [ "$1" == "ic" ]; then
    bash "${SUB_SCRIPT_DIR}/create_canister_id.sh" ic
    KONG_BUILDENV="ic" dfx build ${KONG_BACKEND} ${NETWORK}
    bash "${SUB_SCRIPT_DIR}/gzip_kong_backend.sh" ic
elif [ "$1" == "staging" ]; then
    bash "${SUB_SCRIPT_DIR}/create_canister_id.sh" staging
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
