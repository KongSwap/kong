#!/usr/bin/env bash

if [ "$1" == "staging" ]; then
	network="--network ic"
	kong_backend="kong_backend_staging"
elif [ "$1" == "prod" ]; then
	network="--network ic"
	kong_backend="kong_backend_prod"
else
	network="--network local"
	kong_backend="kong_backend_local"
fi
identity="--identity kong"

dfx deploy $network $identity $kong_backend