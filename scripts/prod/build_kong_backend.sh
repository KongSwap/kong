#!/usr/bin/env bash

NETWORK="--network ic"

./switch_prod.sh

dfx build ${NETWORK} ${IDENTITY} kong_backend

cd ../../target/wasm32-unknown-unknown/release
ic-wasm kong_backend.wasm -o kong_backend_opt.wasm optimize O3
gzip -c kong_backend_opt.wasm > kong_backend.wasm.gz
cd ../../../scripts/prod
