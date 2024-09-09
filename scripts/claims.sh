#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

CLAIM_ID='(5:nat64)'

dfx canister call ${NETWORK} ${KONG_CANISTER} claims --output json "(null)"
# dfx canister call ${NETWORK} ${KONG_CANISTER} claims --output json '(
#     opt ('${CLAIM_ID}'),
# )'
