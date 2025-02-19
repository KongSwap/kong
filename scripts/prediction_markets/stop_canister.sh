#!/usr/bin/env bash

IDENTITY="--identity default"

set -e

echo "Stopping and deleting prediction_markets_backend canister..."
dfx canister stop prediction_markets_backend

dfx canister delete prediction_markets_backend

IDENTITY="--identity default"

set -e

echo "Stopping and deleting kong_ledger canister..."
dfx canister stop kong_ledger

dfx canister delete kong_ledger
