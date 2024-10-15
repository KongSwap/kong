#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
		SUBNET_TYPE=""
	else
		NETWORK="--network $1"
		SUBNET_TYPE="--subnet-type fiduciary"
fi
IDENTITY="--identity kong"

dfx deploy ${NETWORK} ${IDENTITY} ${SUBNET_TYTPE} kong_backend