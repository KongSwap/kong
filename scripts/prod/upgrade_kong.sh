#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend
dfx canister install ${NETWORK} ${IDENTITY} kong_backend --mode upgrade

npm i kong_frontend

dfx build ${NETWORK} ${IDENTITY} kong_frontend
dfx canister install ${NETWORK} ${IDENTITY} kong_frontend --mode upgrade