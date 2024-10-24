#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

npm i kong_frontend

dfx build ${NETWORK} ${IDENTITY} kong_frontend
dfx canister install ${NETWORK} ${IDENTITY} kong_frontend --mode upgrade