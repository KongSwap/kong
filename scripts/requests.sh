#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity konguser1"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

REQUEST_ID='(1:nat64)'

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} requests --output json "(null)" | jq
#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} requests --output json '(opt '${REQUEST_ID}')' | jq
