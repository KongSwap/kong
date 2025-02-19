#!/bin/bash

# Check if amount argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <amount>"
    echo "Example: $0 1000"
    echo "  amount: Amount of test tokens to deposit"
    exit 1
fi

AMOUNT=$1

dfx canister call prediction_markets_backend deposit_tokens "($AMOUNT : nat64)"

# Show new balance
dfx canister call prediction_markets_backend get_balance "(principal \"$(dfx identity get-principal)\")"
