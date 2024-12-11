#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"

npm i kong_frontend

dfx build ${NETWORK} ${IDENTITY} kong_frontend
dfx canister install ${NETWORK} ${IDENTITY} kong_frontend --mode reinstall