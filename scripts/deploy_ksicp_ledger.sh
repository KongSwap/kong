#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..

TOKEN_SYMBOL="ksICP"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
TOKEN_NAME="Internet Computer (KongSwap Test Token)"

if [ "$1" == "staging" ]; then
	bash create_canister_id.sh staging
	SPECIFIED_ID=""
elif [ "$1" == "local" ]; then
	if CANISTER_ID=$(jq -r ".[\"${TOKEN_LEDGER}\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
		[ "${CANISTER_ID}" != "null" ] && {
			SPECIFIED_ID="--specified-id ${CANISTER_ID}"
		}
	fi
else
	exit 1
fi
NETWORK="--network $1"
IDENTITY="--identity kong_token_minter"
MINTER_ACCOUNT_ID=$(dfx ledger $NETWORK $IDENTITY account-id)

dfx deploy ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} ${SPECIFIED_ID} --argument "(
	variant {
		Init = record {
			minting_account = \"$MINTER_ACCOUNT_ID\";
			initial_values = vec {};
			send_whitelist = vec {};
			transfer_fee = opt record {
				e8s = 10_000 : nat64;
			};
			token_symbol = opt \"$TOKEN_SYMBOL\";
			token_name = opt \"$TOKEN_NAME\";
		}
	}
)"
