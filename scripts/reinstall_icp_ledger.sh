#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_token_minter"
MINTER_ACCOUNT_ID=$(dfx ledger ${NETWORK} ${IDENTITY} account-id)

TOKEN_SYMBOL="ICP"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')

dfx build ${NETWORK} ${IDENTITY} icp_ledger
dfx canister install ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} --mode reinstall --argument '(variant {
	Init = record {
		minting_account = "'${MINTER_ACCOUNT_ID}'";
		initial_values = vec {};
		send_whitelist = vec {};
		transfer_fee = opt record {
			e8s = 10_000 : nat64;
		};
	}
})'
