#!/usr/bin/env bash

IDENTITY="--identity minter"

set -e

# Array of principals to mint tokens to
principals=(
    "67hvh-lwbpq-7mvab-uvaqz-ilcvt-6fqn5-spiaa-dlq62-eukxk-e44cm-iae"
    "4jxje-hbmra-4otqc-6hor3-cpwlh-sqymk-6h4ef-42sqn-o3ip5-s3mxk-uae"
    "ryc6f-4jn4r-3tzot-zlpqv-nniay-bgccd-idle4-5llbq-ht3ij-hk3r7-2ae"
    "cfkk4-3cb27-jbkl4-oycde-2cy3s-6km4e-o4b5v-qz54y-iifed-xo4mr-eae"
    "vbaw5-dfbei-hzsix-zc6gn-3wnm7-v6p4x-hmmxl-cluhd-bjb24-af6pd-3ae"
)

# Amount to mint (50000 tokens with 8 decimals)
AMOUNT=5_000_000_000_000  # 50000 * 10^8

# Get canister ID
TOKEN_SYMBOL="KONG"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
CANISTER_ID=$(dfx canister id ${TOKEN_LEDGER})

echo "Minting ${AMOUNT} ${TOKEN_SYMBOL} tokens (1000.00000000 ${TOKEN_SYMBOL}) to each principal..."

# Mint tokens to each principal
for principal in "${principals[@]}"; do
    echo "Minting to ${principal}..."
    dfx canister call ${IDENTITY} ${TOKEN_LEDGER} icrc1_transfer "(record {
        to = record { owner = principal \"${principal}\" };
        amount = ${AMOUNT};
    })"
done

echo "Minting complete!"
