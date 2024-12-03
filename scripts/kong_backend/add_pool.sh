#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"

# TOKEN
TOKEN_CHAIN="IC"
TOKEN_CANISTER_ID="zw6xu-taaaa-aaaar-qaicq-cai" # canister id of TOKEN
TOKEN_CKUSDT_PRICE=1.0          # price of TOKEN against 1 ckUSDT
TOKEN_AMOUNT=10_000_000_000     # amount of TOKEN to add to pool
LP_FEE_BPS=30                   # liquidity provider fee in basis points 30=0.3%
KONG_FEE_BPS=10                 # KONG fee in basis points 10=0.1%

# ckUSDT
CKUSDT_SYMBOL="ckUSDT"
CKUSDT_CHAIN="IC"
CKUSDT_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKUSDT_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
CKUSDT_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKUSDT_DECIMALS=$(echo "10^${CKUSDT_DECIMALS}" | bc)
CKUSDT_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKUSDT_FEE=${CKUSDT_FEE//_/}

# Kong Swap canister
KONG_CANISTER="l4lgk-raaaa-aaaar-qahpq-cai"     # canister id of Kong

TOKEN_CKUSDT_PRICE=${TOKEN_CKUSDT_PRICE//_/}    # remove underscore
TOKEN_AMOUNT=${TOKEN_AMOUNT//_/}                # remove underscore
TOKEN_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_CANISTER_ID} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
TOKEN_DECIMALS=$(echo "10^${TOKEN_DECIMALS}" | bc)
TOKEN_CKUSDT_DECIMALS=$(echo "${TOKEN_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert TOKEN to CKUSDT precision
TOKEN_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_CANISTER_ID} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
TOKEN_FEE=${TOKEN_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${TOKEN_AMOUNT} * ${TOKEN_CKUSDT_PRICE} / ${TOKEN_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

APPROVE_TOKEN_0_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_CANISTER_ID} icrc2_approve "(record {
    amount = $(echo "${TOKEN_AMOUNT} + ${TOKEN_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

APPROVE_TOKEN_1_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool "(record {
    token_0 = \"${TOKEN_CHAIN}.${TOKEN_CANISTER_ID}\";
    amount_0 = ${TOKEN_AMOUNT};
    token_1 = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    amount_1 = ${CKUSDT_AMOUNT};
    lp_fee_bps = opt ${LP_FEE_BPS};
    kong_fee_bps = opt ${KONG_FEE_BPS};
    on_kong = opt false;
})"
