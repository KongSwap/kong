#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_token_minter"
MINTER_ACCOUNT_ID=$(dfx ledger $NETWORK $IDENTITY account-id)

TOKEN_SYMBOL="ksICP"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
TOKEN_NAME="KongSwap Internet Computer (Test Token)"

dfx deploy $NETWORK $IDENTITY $TOKEN_LEDGER --argument "(
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

dfx generate $TOKEN_LEDGER