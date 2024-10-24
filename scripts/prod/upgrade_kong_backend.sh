#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend
dfx canister install ${NETWORK} ${IDENTITY} kong_backend --mode upgrade
