#!/usr/bin/env bash

dfx identity use default

echo "Setting up environment..."
dfx deploy prediction_markets_backend

echo "Done."

dfx identity use minter

echo "Deploying kskong_ledger..."
./deploy_kong_ledger.sh local

dfx identity use default