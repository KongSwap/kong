#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

PRINCIPAL_ID=$(dfx canister id ksbtc_ledger)

dfx canister call ${NETWORK} ${PRINCIPAL_ID} icrc1_total_supply '()'