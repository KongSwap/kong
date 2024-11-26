#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"

KONG_DATA=$(dfx canister id ${NETWORK} kong_data)

REQUEST_ID='opt 8'
NUM_REQUESTS='opt 10'

#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} requests --output json "(null, null)" | jq
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} requests --output json "($REQUEST_ID, $NUM_REQUESTS)" | jq
