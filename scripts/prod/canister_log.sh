#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

dfx canister logs ${NETWORK} ${IDENTITY} kong_backend