#!/usr/bin/env bash

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TOKEN_SYMBOL="ckUSDT"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
TOKEN_NAME="USD Tether (KongSwap Test Token)"
TOKEN_DECIMALS=6
TRANSFER_FEE=10_000
TOKEN_LOGO="data:image/png;base64,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"

if [ "$1" == "staging" ]; then
	bash create_canister_id.sh staging
	SPECIFIED_ID=""
elif [ "$1" == "local" ]; then
	# Source .env file to get canister IDs
	if [ -f "${PROJECT_ROOT}/.env" ]; then
		. "${PROJECT_ROOT}/.env"
		if [ ! -z "${CANISTER_ID_CKUSDT_LEDGER}" ]; then
			SPECIFIED_ID="--specified-id ${CANISTER_ID_CKUSDT_LEDGER}"
		else
			echo "Warning: CANISTER_ID_CKUSDT_LEDGER not found in .env"
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
