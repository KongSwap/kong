#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${CANISTER_IDS_ROOT:-${original_dir}/..}"
canister_ids_file="${root_dir}/canister_ids.all.json"

TOKEN_SYMBOL="ksKONG"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
TOKEN_NAME="KongSwap (KongSwap Test Token)"
TOKEN_DECIMALS=8
TRANSFER_FEE=10_000
TOKEN_LOGO="data:image/png;base64,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"

if [ "$1" == "staging" ]; then
	bash create_canister_id.sh staging
	SPECIFIED_ID=""
elif [ "$1" == "local" ]; then
	SPECIFIED_ID=""
	if CANISTER_ID=$(jq -r ".[\"${TOKEN_LEDGER}\"][\"local\"]" "${canister_ids_file}" 2>/dev/null); then
		if [ "${CANISTER_ID}" != "null" ] && [ "${CANISTER_ID}" != "" ]; then
			# Test if canister with this ID can be created
			if ! dfx canister create ${TOKEN_LEDGER} --specified-id ${CANISTER_ID} --network $1 2>/dev/null; then
				echo "Warning: Cannot use specified ID ${CANISTER_ID}, letting dfx assign new ID"
				SPECIFIED_ID=""
			else
				SPECIFIED_ID="--specified-id ${CANISTER_ID}"
			fi
		fi
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
