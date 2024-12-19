#!/usr/bin/env bash

network="--network $1"
identity="--identity kong_token_minter"

to_principal_id=v53f5-te3dj-sm5it-e2iaf-ymftm-l2mqj-cac7w-veisd-xxx6i-jdmau-zqe
#to_principal_id=a3rqz-stbdu-qbi46-eiave-4nufu-pubny-ja6wg-cubyr-fa2p7-dggfx-cae

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
