#!/bin/bash

# Check if all required arguments are provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <amount>"
    echo "Example: $0 100"
    echo "  amount: Amount of tokens to approve"
    exit 1
fi

AMOUNT=$1

dfx canister call prediction_markets_backend approve_bet "(
    $AMOUNT : nat
)"
