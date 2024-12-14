#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"

dfx deploy ${NETWORK} ${IDENTITY} kong_backend