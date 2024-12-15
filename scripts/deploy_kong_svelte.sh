#!/usr/bin/env bash

if [ "$1" == "staging" ]; then
	network="--network ic"
	kong_svelte="kong_svelte_staging"
elif [ "$1" == "prod" ]; then
	network="--network ic"
	kong_svelte="kong_svelte_prod"
else
	network="--network local"
	kong_svelte="kong_svelte_local"
fi
IDENTITY="--identity kong"

npm i --filter=kong_svelte 

dfx deploy $network $identity $kong_svelte