#!/usr/bin/env bash

network="--network $1"
identity="--identity kong_token_minter"
kong_faucet="kong_faucet"

to_principal_id=$(dfx canister id $network $kong_faucet)

# 100,000,000 ckUSDT
amount=100_000_000_000_000
token="ckusdt"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 10,000,000 ICP
amount=1_000_000_000_000_000
token="icp"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 1,500 ksBTC
amount=150_000_000_000
token="ckbtc"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 30,000 ksETH
amount=30_000_000_000_000_000_000_000
token="cketh"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 2,000,000 KONG
amount=200_000_000_000_000
token="kong"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"
