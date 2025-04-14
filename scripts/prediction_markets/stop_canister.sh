#!/usr/bin/env bash

IDENTITY="--identity default"

set -e

echo "Stopping and deleting prediction_markets_backend canister..."
dfx canister stop prediction_markets_backend

dfx canister delete prediction_markets_backend

IDENTITY="--identity default"

set -e

echo "Stopping and deleting kskong_ledger canister..."
dfx canister stop kskong_ledger

dfx canister delete kskong_ledger
