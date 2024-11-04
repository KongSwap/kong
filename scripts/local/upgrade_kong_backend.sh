#!/usr/bin/env bash

NETWORK=""
IDENTITY="--identity kong"

./switch_local.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend
dfx canister install ${NETWORK} ${IDENTITY} kong_backend --mode upgrade

dfx build ${NETWORK} ${IDENTITY} kong_faucet
dfx canister install ${NETWORK} ${IDENTITY} kong_faucet --mode upgrade
