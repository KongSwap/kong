#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity konguser1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity_amounts '("ICP", 100_000_000, "ckUSDT")'
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity_amounts '("ckUSDT", 9_462_170, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity_amounts '("ckUSDT", 5_000_000_000_000, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity_amounts '("ckBTC", 2_500_000_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity_amounts '("ckUSDT", 2_000_000_000_000, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity_amounts '("ckETH", 50_000_000_000_000_000_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity_amounts '("ckUSDT", 100_000_000_000, "ckETH")'
