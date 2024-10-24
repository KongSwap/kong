#!/usr/bin/env bash

NETWORK="--network ic"
QUIET="-qq"

KONG_BACKEND_CYCLES=$(dfx canister status ${NETWORK} ${IDENTITY} ${QUIET} kong_backend | awk -F 'Balance: ' 'NF > 1 {print $2}')
echo "Kong Backend: ${KONG_BACKEND_CYCLES}"

KONG_FRONTEND_CYCLES=$(dfx canister status ${NETWORK} ${IDENTITY} ${QUIET} kong_frontend | awk -F 'Balance: ' 'NF > 1 {print $2}')
echo "Kong Frontend: ${KONG_FRONTEND_CYCLES}"
