#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity konguser1"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# user needs to be logged in, does not allow for anonymous user to create an account
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} create_user '(null)'