#!/usr/bin/env bash

if ! command -v cargo >/dev/null; then
	echo "Rust/Cargo is not installed"
	exit 1
fi

if ! command -v npm >/dev/null; then
	echo "Node.js/npm is not installed"
	exit 1
fi

if ! command -v dfx >/dev/null; then
	echo "Dfinity CDK is not installed"
	exit 1
fi

if ! command -v jq >/dev/null; then
	echo "jq is not installed"
	exit 1
fi

USER_LIST=$(dfx identity list 2>&1)
if [[ $USER_LIST != *"kong"* ]] || [[ $USER_LIST != *"kong_token_minter"* ]] || [[ $USER_LIST != *"kong_user1"* ]]; then
	echo "User kong, kong_token_minter or kong_user1 does not exists. run create_identity.sh"
	exit 1
fi

cd ..

dfx identity use kong

if [ -z "$1" ]; then
	set -- "local"	# default to local build if none specified
fi

echo Building and deploying to $1

if [ "$1" == "local" ]; then
	dfx deploy internet_identity --network $1
fi

dfx deploy kong_backend --network $1
dfx deploy kong_data --network $1
dfx deploy kong_svelte --network $1
./deploy_ksusdt_ledger.sh $1
./deploy_ksicp_ledger.sh $1
./deploy_ksusdc_ledger.sh $1
./deploy_ksbtc_ledger.sh $1
./deploy_kseth_ledger.sh $1
./deploy_kskong_ledger.sh $1

if [ "$1" == "staging" ] || [ "$1" == "local" ]; then
 	dfx deploy kong_faucet --network $1
	./user_mint.sh $1
fi

pwd
echo "Current DFX identity: $(dfx identity whoami)"
