#!/usr/bin/env bash

NETWORK=""
IDENTITY="--identity kong"

./switch_local.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend
dfx canister install ${NETWORK} ${IDENTITY} kong_backend --mode upgrade
