#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"

KONG_DATA=$(dfx canister id ${NETWORK} kong_data)

MY_TXS='opt false'
TX_ID='null'
TOKEN_ID='null'
NUM_TXS='opt 10'

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} txs --output json "(null, null, null, null)" | jq
#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} txs --output json "($MY_TXS, $TX_ID, $TOKEN_ID, $NUM_TXS)" | jq
