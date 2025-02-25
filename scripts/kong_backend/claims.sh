#!/usr/bin/env bash
if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)
USER_PRINCIPAL_ID=$(dfx identity ${NETWORK} ${IDENTITY} get-principal)

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} claims --output json "(
	\"${USER_PRINCIPAL_ID}\"
)" | jq