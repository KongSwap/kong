#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

MESSAGE_ID='(1:nat64)'

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} messages --output json "(null)" | jq
#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} messages --output json '(opt '${MESSAGE_ID}')' | jq
