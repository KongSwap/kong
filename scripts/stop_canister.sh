#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_token_minter"
PRINCIPAL_ID=$(dfx canister id ckusdc_ledger)

dfx canister stop ${NETWORK} ${IDENTITY} ${PRINCIPAL_ID}