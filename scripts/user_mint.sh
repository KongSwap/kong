#!/usr/bin/env bash

network="--network $1"
identity="--identity kong_token_minter"

to_principal_id=$(dfx identity get-principal $network --identity kong)
# to_principal_id=$(dfx identity get-principal $network --identity kong_user1)
# to_principal_id=$(dfx identity get-principal $network --identity kong_user2)
# to_principal_id=jum6j-nhmrj-nuoi5-lccjt-3ftxs-dw5u6-enrtt-7432h-iaa4z-pnzoo-oqe
# to_principal_id=4s7ce-nntbc-oebfq-damfd-6fuxi-nydjp-fozv6-fherl-djnrj-xtgie-2qe

# 1,000,000 ksUSDT
amount=1_000_000_000_000
token="ksusdt"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 100,000 ksICP
amount=10_000_000_000_000
token="ksicp"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 5 ksBTC
amount=500_000_000
token="ksbtc"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 60 ksETH
amount=60_000_000_000_000_000_000
token="kseth"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"

# 5,000,000 ksKONG
amount=500_000_000_000_000
token="kskong"
token_ledger="${token}_ledger"

dfx canister call $network $identity $token_ledger icrc1_transfer "(record {
	to=record {owner=principal \"$to_principal_id\"; subaccount=null};
	amount=$amount;
},)"
