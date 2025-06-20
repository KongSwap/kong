#!/bin/bash

dfx identity use kong_token_minter

echo "Uninstall code..."
dfx canister uninstall-code ckusdt_ledger 

echo "Deploying code..."
dfx deploy ckusdt_ledger

echo "Minting tokens..."
./mint_ckusdt.sh

dfx identity use default