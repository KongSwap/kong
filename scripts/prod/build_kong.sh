#!/usr/bin/env bash

./build_kong_backend.sh
./build_kong_frontend.sh

# do check-sum
sha256sum ../../target/wasm32-unknown-unknown/release/kong_backend.wasm.gz
sha256sum ../../.dfx/ic/canisters/kong_frontend/assetstorage.wasm.gz