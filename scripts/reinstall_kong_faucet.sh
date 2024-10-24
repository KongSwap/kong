#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"

dfx build ${NETWORK} ${IDENTITY} kong_faucet
dfx canister install ${NETWORK} ${IDENTITY} kong_faucet --mode reinstall

./faucet_mint.sh $1