#!/usr/bin/env bash

NETWORK="--network ic"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# Add TOKEN/ckUSDT pool
# only need to change the section below to create a new pool
TOKEN_SYMBOL="ICP"
TOKEN_CKUSDT_PRICE=7.50
TOKEN_CKUSDT_PRICE=${TOKEN_CKUSDT_PRICE//_/}        # remove underscore
TOKEN_AMOUNT=500_000_000_000            # 5,000 ICP
TOKEN_AMOUNT=${TOKEN_AMOUNT//_/}        # remove underscore
TOKEN_CHAIN="IC"
TOKEN_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"

# shouldn't need to change anything below
CKUSDT_SYMBOL="ckUSDT"
CKUSDT_CHAIN="IC"
CKUSDT_LEDGER="cngnf-vqaaa-aaaar-qag4q-cai"
CKUSDT_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKUSDT_DECIMALS=$(echo "10^${CKUSDT_DECIMALS}" | bc)
CKUSDT_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKUSDT_FEE=${CKUSDT_FEE//_/}

TOKEN_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
TOKEN_DECIMALS=$(echo "10^${TOKEN_DECIMALS}" | bc)
TOKEN_CKUSDT_DECIMALS=$(echo "${TOKEN_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ICP to CKUSDT precision
if [ "${TOKEN_SYMBOL}" = "ICP" ]; then
  TOKEN_FEE=$(dfx canister call ${NETWORK} ${TOKEN_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
else
  TOKEN_FEE=$(dfx canister call ${NETWORK} ${TOKEN_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
fi
TOKEN_FEE=${TOKEN_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${TOKEN_AMOUNT} * ${TOKEN_CKUSDT_PRICE} / ${TOKEN_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

TRANSFER_TOKEN_0_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
    to = record {
        owner = principal \"${KONG_CANISTER}\";
        subaccount = null;
    };
    amount = $(echo "${TOKEN_AMOUNT}" | bc);
})" | awk -F'=' '{print $2}' | awk '{print $1}')

echo
echo "icrc1_transfer block id: ${TRANSFER_TOKEN_0_BLOCK_ID}"

APPROVE_TOKEN_1_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${TOKEN_CHAIN}.${TOKEN_LEDGER}\";
    amount_0 = ${TOKEN_AMOUNT};
    tx_id_0 = opt variant { BlockIndex = ${TRANSFER_TOKEN_0_BLOCK_ID} };
    token_1 = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    amount_1 = ${CKUSDT_AMOUNT};
})" | jq

# Add new pool to Kong
# user must be controller
# dfx identity use kong
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool_on_kong --output json '("'${TOKEN_SYMBOL}_${CKUSDT_SYMBOL}'", true)' | jq