#!/usr/bin/env bash

NETWORK=""
IDENTITY="--identity kong"

./switch_staging.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend
dfx canister install ${NETWORK} ${IDENTITY} kong_backend --mode upgrade

npm i kong_frontend

dfx build ${NETWORK} ${IDENTITY} kong_frontend
dfx canister install ${NETWORK} ${IDENTITY} kong_frontend --mode upgrade