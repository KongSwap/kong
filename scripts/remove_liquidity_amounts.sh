#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity konguser1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} remove_liquidity_amounts '("ICP", "ckUSDT", 420_000_000)'
#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} remove_liquidity_amounts '("ckBTC", "ckUSDT", 250_000_000)'
#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} remove_liquidity_amounts '("ckETH", "ckUSDT", 600_000_000_000_000)'