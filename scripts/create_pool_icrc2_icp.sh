#!/usr/bin/env bash

NETWORK="--network ic"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# Add TOKEN/ICP pool
# only need to change the section below to create a new pool
TOKEN_SYMBOL="TOKEN"
TOKEN_ICP_PRICE=
TOKEN_ICP_PRICE=${TOKEN_ICP_PRICE//_/}        # remove underscore
TOKEN_AMOUNT=500_000_000_000            # 5,000 ICP
TOKEN_AMOUNT=${TOKEN_AMOUNT//_/}        # remove underscore
TOKEN_CHAIN="IC"
TOKEN_LEDGER="CANISTER"

# shouldn't need to change anything below
ICP_SYMBOL="ICP"
ICP_CHAIN="IC"
ICP_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"
ICP_DECIMALS=$(dfx canister call ${NETWORK} ${ICP_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
ICP_DECIMALS=$(echo "10^${ICP_DECIMALS}" | bc)
ICP_FEE=$(dfx canister call ${NETWORK} ${ICP_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
ICP_FEE=${ICP_FEE//_/}

TOKEN_DECIMALS=$(dfx canister call ${NETWORK} ${TOKEN_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
TOKEN_DECIMALS=$(echo "10^${TOKEN_DECIMALS}" | bc)
TOKEN_ICP_DECIMALS=$(echo "${TOKEN_DECIMALS} / ${ICP_DECIMALS}" | bc -l) # convert to ICP precision
if [ "${TOKEN_SYMBOL}" = "ICP" ]; then
  TOKEN_FEE=$(dfx canister call ${NETWORK} ${TOKEN_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
else
  TOKEN_FEE=$(dfx canister call ${NETWORK} ${TOKEN_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
fi
TOKEN_FEE=${TOKEN_FEE//_/}
ICP_AMOUNT=$(echo "scale=0; ${TOKEN_AMOUNT} * ${TOKEN_ICP_PRICE} / ${TOKEN_ICP_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc2_approve "(record {
    amount = $(echo "${TOKEN_AMOUNT} + ${TOKEN_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc2_approve "(record {
    amount = $(echo "${ICP_AMOUNT} + ${ICP_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${TOKEN_CHAIN}.${TOKEN_LEDGER}\";
    amount_0 = ${TOKEN_AMOUNT};
    token_1 = \"${ICP_CHAIN}.${ICP_LEDGER}\";
    amount_1 = ${ICP_AMOUNT};
})" | jq

# Add new pool to Kong
# user must be controller
# dfx identity use kong
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool_on_kong --output json '("'${TOKEN_SYMBOL}_${ICP_SYMBOL}'", true)' | jq