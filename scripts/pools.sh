#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(null)' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckETH_IC.ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckUSDT_IC.ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckBTC_IC.ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckETH_IC.ckUSDT")' | jq