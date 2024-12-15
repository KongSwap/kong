#!/usr/bin/env bash

if [ "$1" == "staging" ]; then
	network="--network ic"
else
	network="--network local"
fi
identity="--identity kong"
kong_faucet="kong_faucet"

dfx deploy $network $identity $kong_faucet

./faucet_mint.sh $1