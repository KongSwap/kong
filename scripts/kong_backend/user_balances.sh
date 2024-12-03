#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} user_balances --output json '(null)' | jq
#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} user_balances --output json '(opt "ICP")' | jq