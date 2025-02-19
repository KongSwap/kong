#!/usr/bin/env bash

IDENTITY="--identity minter"

set -e

original_dir=$(pwd)
root_dir="${original_dir}"/..

# Create canister_ids.all.json if it doesn't exist
mkdir -p "${root_dir}"
touch "${root_dir}/canister_ids.all.json"
# Ensure the file has valid JSON if empty
[ ! -s "${root_dir}/canister_ids.all.json" ] && echo '{}' > "${root_dir}/canister_ids.all.json"

TOKEN_SYMBOL="ICP"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
TOKEN_NAME="Internet Computer Protocol"
TOKEN_DECIMALS=8
TRANSFER_FEE=10_000
TOKEN_LOGO="data:image/png;base64,..."  # Your existing logo data here

# Get the principal of sns_proposal for minting initial tokens
PRINCIPAL=$(dfx identity ${IDENTITY} get-principal)

# Set network and canister ID based on environment
if [ "$1" == "staging" ]; then
    bash create_canister_id.sh staging
    SPECIFIED_ID=""
    NETWORK="--network staging"
elif [ "$1" == "local" ]; then
    if CANISTER_ID=$(jq -r ".[\"${TOKEN_LEDGER}\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            SPECIFIED_ID="--specified-id ${CANISTER_ID}"
        }
    fi
    NETWORK="--network local"
else
    echo "Please specify either 'local' or 'staging' as an argument"
    exit 1
fi

# Deploy the ICRC2 token ledger
echo "Deploying ${TOKEN_NAME} (${TOKEN_SYMBOL}) with initial supply to ${PRINCIPAL}..."

DEPLOY_ARGS="(variant {Init = 
    record {
        token_symbol = \"${TOKEN_SYMBOL}\";
        token_name = \"${TOKEN_NAME}\";
        minting_account = record { owner = principal \"${PRINCIPAL}\" };
        transfer_fee = ${TRANSFER_FEE};
        metadata = vec {
            record { \"icrc1:symbol\"; variant { Text=\"${TOKEN_SYMBOL}\" } };
            record { \"icrc1:name\"; variant { Text=\"${TOKEN_NAME}\" } };
            record { \"icrc1:decimals\"; variant { Nat=${TOKEN_DECIMALS} } };
            record { \"icrc1:fee\"; variant { Nat=${TRANSFER_FEE} } };
            record { \"icrc1:logo\"; variant { Text=\"${TOKEN_LOGO}\" } };
        };
        initial_balances = vec { record { record { owner = principal \"${PRINCIPAL}\" }; 1000000000000 } };
        archive_options = record {
            num_blocks_to_archive = 1000000;
            trigger_threshold = 1000000;
            controller_id = principal \"${PRINCIPAL}\";
        };
    }
})"

dfx deploy ${IDENTITY} ${TOKEN_LEDGER} ${SPECIFIED_ID} --argument "${DEPLOY_ARGS}" ${NETWORK}