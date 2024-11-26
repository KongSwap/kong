#!/usr/bin/env bash

#cargo install candid-extractor
cargo build --release --target wasm32-unknown-unknown --package kong_backend
candid-extractor ../target/wasm32-unknown-unknown/release/kong_backend.wasm > kong_backend.did