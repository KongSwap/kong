#!/usr/bin/env bash

dfx identity use jlee

CYCLES_LEDGER="um5iw-rqaaa-aaaaq-qaaba-cai"

# cycles wallet balance (source)
dfx wallet --ic balance

# cycles ledger balance (destination)
dfx cycles --ic balance

dfx canister call --ic ${CYCLES_LEDGER} deposit "(record { to = record { owner = principal \"$(dfx identity get-principal)\"} })" --with-cycles 400_000_000_000 --wallet $(dfx identity get-wallet --ic)

dfx cycles --ic balance