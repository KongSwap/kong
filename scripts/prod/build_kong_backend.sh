#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend

cd ../../target/wasm32-unknown-unknown/release
gzip -c kong_backend.wasm > kong_backend.wasm.gz
cd ../../../scripts/prod
