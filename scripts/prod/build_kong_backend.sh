#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend

cd ../../target/wasm32-unknown-unknown/release
gzip kong_backend_opt.wasm
cd ../../../scripts/prod
