#!/usr/bin/env bash

NETWORK="--network ic"
QUIET="-qq"

KONG_BACKEND_CYCLES=$(dfx canister status ${NETWORK} ${IDENTITY} ${QUIET} kong_backend | awk -F 'Balance: ' 'NF > 1 {print $2}')
echo "Kong Backend: ${KONG_BACKEND_CYCLES}"

KONG_SVELTE_CYCLES=$(dfx canister status ${NETWORK} ${IDENTITY} ${QUIET} kong_svelte | awk -F 'Balance: ' 'NF > 1 {print $2}')
echo "Kong Frontend: ${KONG_SVELTE_CYCLES}"
