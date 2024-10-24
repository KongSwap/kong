#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

KONG_SETTINGS='{\"maintenance_mode\":false}'

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} set_kong_settings --output json '("'${KONG_SETTINGS}'")' | jq -r 'to_entries[0].value | fromjson'