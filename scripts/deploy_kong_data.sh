#!/usr/bin/env bash

NETWORK="--network $1"
IDENTITY="--identity kong"
KONG_DATA=kong_data

if [ "$1" == "ic" ]; then
    bash create_canister_id.sh ic
    KONG_BUILDENV="ic" dfx build ${KONG_DATA} ${NETWORK}
    bash gzip_kong_data.sh ic
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

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"
PRINCIPAL_ID=$(dfx identity ${IDENTITY} get-principal)
KONG_DATA_CANISTER_ID=$(dfx canister id ${NETWORK} kong_data)

# Deploy event_store only for non-local networks
if [ "$1" != "local" ]; then
    dfx deploy ${NETWORK} ${IDENTITY} event_store --subnet-type fiduciary --argument "(
        record {
            push_events_whitelist = vec { principal \"${KONG_DATA_CANISTER_ID}\" };
            read_events_whitelist = vec { principal \"${PRINCIPAL_ID}\"};
        }
    )"
else
    # For local network, deploy without subnet-type
    dfx deploy ${NETWORK} ${IDENTITY} event_store --argument "(
        record {
            push_events_whitelist = vec { principal \"${KONG_DATA_CANISTER_ID}\" };
            read_events_whitelist = vec { principal \"${PRINCIPAL_ID}\"};
        }
    )"
fi
