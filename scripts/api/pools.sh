#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(null)' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "all")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "ICP_ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckETH_IC.ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckUSDT_IC.ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckBTC_IC.ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.ckETH_IC.ckUSDT")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "IC.zw6xu-taaaa-aaaar-qaicq-cai_IC.zdzgz-siaaa-aaaar-qaiba-cai")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "zw6xu-taaaa")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} pools --output json '(opt "ckBTC")' | jq