#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"

dfx build ${NETWORK} ${IDENTITY} kong_data
dfx canister install ${NETWORK} ${IDENTITY} kong_data --mode reinstall