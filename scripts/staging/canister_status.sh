#!/usr/bin/env bash

NETWORK="--network ic"
IDENTITY="--identity kong"

dfx canister status ${NETWORK} ${IDENTITY} kong_backend