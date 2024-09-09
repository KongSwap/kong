#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# if there is no current user, then it will return an anonymous user
# user_id=0, user_name=""
dfx canister call ${NETWORK} ${KONG_CANISTER} get_user '()'