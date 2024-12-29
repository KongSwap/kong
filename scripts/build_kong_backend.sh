#!/usr/bin/env bash

if [ -n "$1" ]; then
    KONG_BUILDENV=$1
fi

if [ "$KONG_BUILDENV" == "ic" ]; then
    cargo build --features "prod" --target wasm32-unknown-unknown --release -p kong_backend --locked
elif [ "$KONG_BUILDENV" == "staging" ]; then
    cargo build --features "staging" --target wasm32-unknown-unknown --release -p kong_backend --locked
elif [ "$KONG_BUILDENV" == "local" ]; then
    cargo build --features "local" --target wasm32-unknown-unknown --release -p kong_backend --locked
fi