#!/usr/bin/env bash

NETWORK="--network ic"
IDENTITY="--identity kong"

dfx canister logs ${NETWORK} ${IDENTITY} kong_backend