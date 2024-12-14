#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_token_minter"

TO_PRINCIPAL_ID=$(dfx canister id ${NETWORK} kong_faucet)

# 10,000,000 ksICP
AMOUNT=1_000_000_000_000_000
TOKEN="ksicp"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 100,000,000 ksUSDC
AMOUNT=100_000_000_000_000
TOKEN="ksusdc"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 100,000,000 ksUSDT
AMOUNT=100_000_000_000_000
TOKEN="ksusdt"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 1,500 ksBTC
AMOUNT=150_000_000_000
TOKEN="ksbtc"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 30,000 ksETH
AMOUNT=30_000_000_000_000_000_000_000
TOKEN="kseth"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 2,000,000 ksKONG
AMOUNT=200_000_000_000_000
TOKEN="kskong"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"
