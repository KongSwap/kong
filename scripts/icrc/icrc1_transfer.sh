#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

FROM_IDENTITY="--identity kong"

TO_PRINCIPAL_ID=$(dfx canister id kong_backend)
TO_PRINCIPAL_ID="snb3j-s62qn-qownd-imqtp-fmqwk-paao6-w67uo-zzhwr-ntrwu-2ngtu-xae"

AMOUNT=1_000_000_000
TOKEN_LEDGER="ksicp_ledger"

dfx canister call ${NETWORK} ${FROM_IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
  to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
  amount=${AMOUNT};
},)"
