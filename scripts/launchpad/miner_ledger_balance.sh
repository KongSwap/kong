#!/bin/bash

# Check if ledger canister ID and miner name are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <ledger_canister_id> <miner_name>"
    echo "Example: $0 be2us-64aaa-aaaaa-qaabq-cai miner1"
    exit 1
fi

LEDGER_ID=$1
MINER_NAME=$2

# Get the principal ID for the miner canister
MINER_PRINCIPAL=$(dfx canister id "$MINER_NAME")

if [ -z "$MINER_PRINCIPAL" ]; then
    echo "Error: Could not get principal ID for miner $MINER_NAME"
    exit 1
fi

# Query the ICRC balance for the miner
echo "Querying balance for $MINER_NAME (Principal: $MINER_PRINCIPAL)..."
dfx canister call "$LEDGER_ID" icrc1_balance_of "(record { owner = principal \"$MINER_PRINCIPAL\"; subaccount = null })"
