#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

IDENTITY="--identity kong_user1"
QUIET="-qq"

PRINCIPAL_ID=$(dfx identity ${NETWORK} ${IDENTITY} ${QUIET} get-principal)
echo kong_user1: ${PRINCIPAL_ID}
ICP_LEDGER="icp_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ICP_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ICP_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckUSDT_LEDGER="ckusdt_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckBTC_LEDGER="ckbtc_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckBTC_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckBTC_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckETH_LEDGER="cketh_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckETH_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckETH_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
KONG_LEDGER="kong_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"

echo

PRINCIPAL_ID=$(dfx canister id ${NETWORK} ${IDENTITY} ${QUIET} kong_backend)
echo kong_backend: ${PRINCIPAL_ID}
ICP_LEDGER="icp_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ICP_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ICP_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckUSDT_LEDGER="ckusdt_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckBTC_LEDGER="ckbtc_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckBTC_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckBTC_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckETH_LEDGER="cketh_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckETH_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckETH_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
KONG_LEDGER="kong_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"

echo

PRINCIPAL_ID=$(dfx canister id ${NETWORK} ${IDENTITY} ${QUIET} kong_faucet)
echo kong_faucet: ${PRINCIPAL_ID}
ICP_LEDGER="icp_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ICP_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ICP_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckUSDT_LEDGER="ckusdt_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckBTC_LEDGER="ckbtc_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckBTC_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckBTC_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckETH_LEDGER="cketh_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckETH_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckETH_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
KONG_LEDGER="kong_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
