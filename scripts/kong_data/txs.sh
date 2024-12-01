#!/usr/bin/env bash

NETWORK="--network ic"
IDENTITY="--identity kong_user1"
KONG_DATA=$(dfx canister id ${NETWORK} kong_data)

my_txs="opt false"
tx_id="null"
token_id="null"
num_txs="opt 10"

#dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} txs --output json "(null, null, null, null)" | jq
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_DATA} txs --output json "($my_txs, $tx_id, $token_id, $num_txs)" | jq
