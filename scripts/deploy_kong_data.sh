#!/usr/bin/env bash

if [ "$1" == "staging" ]; then
	network="--network ic"
	kong_data="kong_data_staging"
elif [ "$1" == "prod" ]; then
	network="--network ic"
	kong_data="kong_data_prod"
else
	network="--network local"
	kong_data="kong_data_local"
fi
identity="--identity kong"

dfx deploy $network $identity $kong_data