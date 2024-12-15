#!/usr/bin/env bash

if [ "$1" == "staging" ]; then
	network="--network ic"
else
	network="--network local"
fi
identity="--identity kong_token_minter"

TO_PRINCIPAL_ID=$(dfx identity $network --identity kong_user1 get-principal)
#TO_PRINCIPAL_ID=lxm55-254xc-c6obr-ygh6x-dd4n6-vmqfc-jsbwo-gbi5n-lrpol-haxdl-zae

# 100,000 ksICP
AMOUNT=10_000_000_000_000
TOKEN="ksicp"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call $network $identity ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 1,000,000 ksUSDT
AMOUNT=1_000_000_000_000
TOKEN="ksusdt"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call $network $identity ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 200,000 ksUSDC
AMOUNT=200_000_000_000
TOKEN="ksusdc"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call $network $identity ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 5 ksBTC
AMOUNT=500_000_000
TOKEN="ksbtc"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call $network $identity ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 60 ksETH
AMOUNT=60_000_000_000_000_000_000
TOKEN="kseth"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call $network $identity ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"

# 5,000,000 ksKONG
AMOUNT=500_000_000_000_000
TOKEN="kskong"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call $network $identity ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"
