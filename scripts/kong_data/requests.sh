#!/usr/bin/env bash

NETWORK="--network ic"
IDENTITY="--identity kong_user1"
KONG_DATA=$(dfx canister id ${NETWORK} kong_data)

request_id="opt 8"
num_requests="opt 10"

#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} requests --output json "(null, null)" | jq
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} requests --output json "($request_id, $num_requests)" | jq
