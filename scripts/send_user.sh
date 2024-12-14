#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"
TO_PRINCIPAL_ID=tmp3d-jaaaa-aaaam-adcla-cai

# 1,000,000 ksUSDT
AMOUNT=1_000_000_000_000
TOKEN="ksusdt"
TOKEN_LEDGER="${TOKEN}_ledger"

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
	to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
	amount=${AMOUNT};
},)"
