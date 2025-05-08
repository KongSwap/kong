#!/bin/bash

dfx identity use kong_token_minter

echo "Uninstall code..."
dfx canister uninstall-code ksusdt_ledger 

echo "Deploying code..."
dfx deploy ksusdt_ledger

echo "Minting tokens..."
./mint_ksusdt.sh

dfx identity use default