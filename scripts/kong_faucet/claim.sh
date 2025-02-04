#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

KONG_FAUCET_CANISTER=$(dfx canister id ${NETWORK} kong_faucet)

dfx canister call ${NETWORK} ${KONG_FAUCET_CANISTER} claim '()'
