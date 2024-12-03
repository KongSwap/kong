#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

ICP_TOKEN="ICP"
CKUSDT_TOKEN="ckUSDT"
CKUSDC_TOKEN="ckUSDC"
CKBTC_TOKEN="ckBTC"
CKETH_TOKEN="ckETH"

# ICP/ckUSDT pool
POOL_SYMBOL=${ICP_TOKEN}_${CKUSDT_TOKEN}
LP_TOKEN_REMOVE_AMOUNT=500_000_000_000
LP_TOKEN_REMOVE_AMOUNT=${LP_TOKEN_REMOVE_AMOUNT//_/}

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} remove_liquidity "(record {
	token_0 = \"${ICP_TOKEN}\";
	token_1 = \"${CKUSDT_TOKEN}\";
    remove_lp_token_amount = ${LP_TOKEN_REMOVE_AMOUNT};
})"

# ckUSDC/ckUSDT pool
POOL_SYMBOL=${CKUSDC_TOKEN}_${CKUSDT_TOKEN}
LP_TOKEN_REMOVE_AMOUNT=1_000_000_000_000
LP_TOKEN_REMOVE_AMOUNT=${LP_TOKEN_REMOVE_AMOUNT//_/}

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} remove_liquidity "(record {
	token_0 = \"${CKUSDC_TOKEN}\";
	token_1 = \"${CKUSDT_TOKEN}\";
    remove_lp_token_amount = ${LP_TOKEN_REMOVE_AMOUNT};
})"

# ckBTC/ckUSDT pool
POOL_SYMBOL=${CKBTC_TOKEN}_${CKUSDT_TOKEN}
LP_TOKEN_REMOVE_AMOUNT=15_000_000_000
LP_TOKEN_REMOVE_AMOUNT=${LP_TOKEN_REMOVE_AMOUNT//_/}

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} remove_liquidity "(record {
    token_0 = \"${CKBTC_TOKEN}\";
    token_1 = \"${CKUSDT_TOKEN}\";
    remove_lp_token_amount = ${LP_TOKEN_REMOVE_AMOUNT};
})"

# ckETH/ckUSDT pool
POOL_SYMBOL=${CKETH_TOKEN}_${CKUSDT_TOKEN}
LP_TOKEN_REMOVE_AMOUNT=100_000_000_000
LP_TOKEN_REMOVE_AMOUNT=${LP_TOKEN_REMOVE_AMOUNT//_/}

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} remove_liquidity "(record {
    token_0 = \"${CKETH_TOKEN}\";
    token_1 = \"${CKUSDT_TOKEN}\";
    remove_lp_token_amount = ${LP_TOKEN_REMOVE_AMOUNT};
})"
