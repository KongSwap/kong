#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} backup_kong_settings --output json '()' | jq -r 'to_entries[0].value | fromjson'