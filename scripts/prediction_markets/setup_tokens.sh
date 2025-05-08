#!/bin/bash

# Make script exit on first error
set -e

# Switch to minter identity
dfx identity use minter

# Get canister IDs
KONG_LEDGER=$(dfx canister id kong_ledger)

# Amount to mint for each user (100,000 tokens = 10000000000000 e8s)
MINT_AMOUNT=10000000000000

# Function to mint tokens for a user
mint_tokens() {
    local identity=$1
    dfx identity use $identity
    local principal=$(dfx identity get-principal)
    echo "Minting $MINT_AMOUNT tokens for $identity ($principal)..."
    
    # Switch back to minter to mint tokens
    dfx identity use minter
    dfx canister call $KONG_LEDGER icrc1_transfer "(record {
        to = record { owner = principal \"$principal\" };
        amount = $MINT_AMOUNT : nat;
        fee = null;
        memo = null;
        from_subaccount = null;
        created_at_time = null;
    })"
}

# Mint tokens for each user
echo "Setting up initial token balances..."

mint_tokens "kong"
mint_tokens "default"
mint_tokens "kong_user1"
mint_tokens "kong_user2"

echo "Token setup complete!"
