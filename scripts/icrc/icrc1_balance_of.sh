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
ksICP_LEDGER="icp_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksICP_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksICP_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ksUSDT_LEDGER="ksusdt_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksUSDT_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksUSDT_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ksBTC_LEDGER="ksbtc_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksBTC_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksBTC_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ksETH_LEDGER="kseth_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksETH_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksETH_LEDGER} icrc1_balance_of "(record {
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
ksICP_LEDGER="icp_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksICP_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksICP_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckUSDT_LEDGER="ksusdt_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ksBTC_LEDGER="ksbtc_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksBTC_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksBTC_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ksETH_LEDGER="kseth_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksETH_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksETH_LEDGER} icrc1_balance_of "(record {
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
ksICP_LEDGER="icp_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksICP_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksICP_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ckUSDT_LEDGER="ksusdt_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ckUSDT_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ksBTC_LEDGER="ksbtc_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksBTC_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksBTC_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
ksETH_LEDGER="kseth_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksETH_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${ksETH_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
KONG_LEDGER="kong_ledger"
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_symbol '()'
dfx canister call ${NETWORK} ${IDENTITY} ${QUIET} ${KONG_LEDGER} icrc1_balance_of "(record {
	owner=principal \"${PRINCIPAL_ID}\"; subaccount=null;
},)"
