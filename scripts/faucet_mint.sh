#!/usr/bin/env bash

# Check if first argument is a principal ID (longer than 20 chars) or network name
if [ -z "$1" ]; then
    NETWORK=""
    TO_PRINCIPAL_ID=$(dfx canister id kong_faucet)
elif [ ${#1} -gt 20 ]; then
    # First arg is likely a principal ID
    NETWORK=""
    TO_PRINCIPAL_ID=$1
else
    # First arg is network name
    NETWORK="--network $1"
    if [ -z "$2" ]; then
        TO_PRINCIPAL_ID=$(dfx canister id ${NETWORK} kong_faucet)
    else
        TO_PRINCIPAL_ID=$2
    fi
fi

IDENTITY="--identity kong_token_minter"

# 10,000,000 ICP
AMOUNT=1_000_000_000_000_000
TOKEN="icp"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
})"

# 100,000,000 ckUSDC
AMOUNT=100_000_000_000_000
TOKEN="ckusdc"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
})"

# 100,000,000 ckUSDT
AMOUNT=100_000_000_000_000
TOKEN="ckusdt"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
})"

# 1,500 ckBTC
AMOUNT=150_000_000_000
TOKEN="ckbtc"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
})"

# 30,000 ckETH
AMOUNT=30_000_000_000_000_000_000_000
TOKEN="cketh"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
})"
