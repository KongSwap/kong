#!/usr/bin/env bash

NETWORK=""
#NETWORK="--network ic"
IDENTITY="--identity konguser1"

# 1. Add TOKEN/ckUSDT pool
TOKEN_CHAIN="IC"
TOKEN_SYMBOL="TOKEN"            # symbol of TOKEN
TOKEN_CKUSDT_PRICE=7.50         # price of TOKEN against 1 ckUSDT
TOKEN_AMOUNT=500_000_000_000    # amount of TOKEN to add to pool

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)
TOKEN_CKUSDT_PRICE=${TOKEN_CKUSDT_PRICE//_/}    # remove underscore
TOKEN_AMOUNT=${TOKEN_AMOUNT//_/}                # remove underscore
TOKEN_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${TOKEN_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
TOKEN_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
TOKEN_DECIMALS=$(echo "10^${TOKEN_DECIMALS}" | bc)
TOKEN_CKUSDT_DECIMALS=$(echo "${TOKEN_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert TOKEN to CKUSDT precision
TOKEN_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
TOKEN_FEE=${TOKEN_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${TOKEN_AMOUNT} * ${TOKEN_CKUSDT_PRICE} / ${TOKEN_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

APPROVE_TOKEN0_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc2_approve "(record {
    amount = $(echo "${TOKEN_AMOUNT} + ${TOKEN_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

APPROVE_TOKEN1_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool "(record {
    token0 = \"${TOKEN_CHAIN}.${TOKEN_LEDGER}\";
    amount0 = ${TOKEN_AMOUNT};
    token1 = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    amount1 = ${CKUSDT_AMOUNT};
})"
