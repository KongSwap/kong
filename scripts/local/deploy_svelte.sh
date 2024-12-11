#!/bin/bash

# QoL

dfx start --clean --background
cd scripts/local || exit
./create_identity.sh

./deploy_kong.sh
./deploy_tokens_pools.sh

if [ -z "$1" ]
	then
		NETWORK=""
		SAME_SUBNET=""
	else
		NETWORK="--network $1"
		SAME_SUBNET="--next-to kong_backend"
fi
IDENTITY="--identity kong"

pnpm --filter kong_svelte i

dfx deploy ${NETWORK} ${IDENTITY} ${SAME_SUBNET} kong_svelte

cd ../..


