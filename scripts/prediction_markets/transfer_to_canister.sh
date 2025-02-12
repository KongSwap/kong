#!/bin/bash

# Check if all arguments are provided
if [ $# -ne 3 ]; then
    echo "Usage: $0 <market_id> <outcome_index> <amount>"
    exit 1
fi

MARKET_ID=$1
OUTCOME_INDEX=$2
AMOUNT=$3
CANISTER_ID=$(dfx canister id prediction_markets_backend)

# Convert market ID and outcome to bytes for memo
MEMO="$MARKET_ID:$OUTCOME_INDEX"
MEMO_BYTES="vec {"
for (( i=0; i<${#MEMO}; i++ )); do
    if [ $i -gt 0 ]; then
        MEMO_BYTES+="; "
    fi
    MEMO_BYTES+="${MEMO:$i:1}"
done
MEMO_BYTES+="}"

# Transfer tokens to the canister
dfx canister call kong_ledger icrc1_transfer "(record { 
    to = record { owner = principal \"$CANISTER_ID\"; subaccount = null };
    amount = $AMOUNT;
    fee = opt 10_000;
    memo = opt $MEMO_BYTES;
    from_subaccount = null;
    created_at_time = null;
})"
