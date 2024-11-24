#!/usr/bin/env bash

NETWORK=""
IDENTITY="--identity kong"

./switch_local.sh

pnpm i kong_frontend

dfx build ${NETWORK} ${IDENTITY} kong_frontend
dfx canister install ${NETWORK} ${IDENTITY} kong_frontend --mode upgrade