#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_data)

#dfx canister call ${NETWORK} ${KONG_CANISTER} tokens --output json '(null)' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} tokens --output json '(opt "all")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} tokens --output json '(opt "ICP")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} tokens --output json '(opt "IC.ICP")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} tokens --output json '(opt "IC.zdzgz-siaaa-aaaar-qaiba-cai")' | jq
#dfx canister call ${NETWORK} ${KONG_CANISTER} tokens --output json '(opt "IC.zdzgz")' | jq
dfx canister call ${NETWORK} ${KONG_CANISTER} tokens --output json '(opt "DOLR")' | jq