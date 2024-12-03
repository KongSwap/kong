#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

CLAIM_ID='(1:nat64)'

dfx canister call ${NETWORK} ${KONG_CANISTER} claim --output json '('${CLAIM_ID}')'