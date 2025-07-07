#!/usr/bin/env bash

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TOKEN_SYMBOL="ckBTC"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
TOKEN_NAME="Bitcoin (KongSwap Test Token)"
TOKEN_DECIMALS=8
TRANSFER_FEE=10_000
TOKEN_LOGO="data:image/png;base64,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"

if [ "$1" == "staging" ]; then
	bash create_canister_id.sh staging
	SPECIFIED_ID=""
elif [ "$1" == "local" ]; then
	# Source .env file to get canister IDs
	if [ -f "${PROJECT_ROOT}/.env" ]; then
		. "${PROJECT_ROOT}/.env"
		if [ ! -z "${CANISTER_ID_CKBTC_LEDGER}" ]; then
			SPECIFIED_ID="--specified-id ${CANISTER_ID_CKBTC_LEDGER}"
		else
			echo "Warning: CANISTER_ID_CKBTC_LEDGER not found in .env"
		fi
	else
		echo "Error: .env file not found"
		exit 1
	fi
else
	exit 1
fi
NETWORK="--network $1"
IDENTITY="--identity kong_token_minter"
CONTROLLER_PRINCIPAL_ID=$(dfx identity ${NETWORK} ${IDENTITY} get-principal)

TRIGGER_THRESHOLD=10_000
NUM_OF_BLOCK_TO_ARCHIVE=5_000
CYCLE_FOR_ARCHIVE_CREATION=5_000_000_000_000
ICRC2_FEATURE_FLAG=true

dfx deploy ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} ${SPECIFIED_ID} --argument "(variant {Init =
	record {
		token_symbol = \"${TOKEN_SYMBOL}\";
		token_name = \"${TOKEN_NAME}\";
		decimals = opt ${TOKEN_DECIMALS};
		minting_account = record { owner = principal \"${CONTROLLER_PRINCIPAL_ID}\" };
		transfer_fee = ${TRANSFER_FEE};
		initial_balances = vec {};
		metadata = vec { record { \"icrc1:logo\"; variant { Text = \"${TOKEN_LOGO}\" }; }; };
		feature_flags = opt record { icrc2 = ${ICRC2_FEATURE_FLAG} };
		archive_options = record {
			num_blocks_to_archive = ${NUM_OF_BLOCK_TO_ARCHIVE};
			trigger_threshold = ${TRIGGER_THRESHOLD};
			controller_id = principal \"${CONTROLLER_PRINCIPAL_ID}\";
			cycles_for_archive_creation = opt ${CYCLE_FOR_ARCHIVE_CREATION};
		};
	}
})"
