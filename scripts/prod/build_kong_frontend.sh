#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

pnpm i kong_frontend

dfx build ${NETWORK} ${IDENTITY} kong_frontend