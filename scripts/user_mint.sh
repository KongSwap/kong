#!/usr/bin/env bash

network="--network $1"
identity="--identity kong_token_minter"

to_principal_id=$(dfx identity $network --identity kong_user1 get-principal)
#to_principal_id=c4etj-7mp7x-5vmzi-kpthz-5h4ve-l3vss-mbs3r-kwihx-tifdo-jwlaz-nae

# 100,000 ICP
amount=10_000_000_000_000
token="icp"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 1,000,000 ckUSDT
amount=1_000_000_000_000
token="ckusdt"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 5 ckBTC
amount=500_000_000
token="ckbtc"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 60 ckETH
amount=60_000_000_000_000_000_000
token="cketh"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 5,000,000 KONG
amount=500_000_000_000_000
token="kong"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"
