#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

TOKEN_SYMBOL='IC.mxzaz-hqaaa-aaaar-qaada-cai'

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} update_token "(record {
    token = \"${TOKEN_SYMBOL}\";
})"
