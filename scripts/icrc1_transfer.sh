#!/usr/bin/env bash

PRINCIPAL_ID=$(dfx canister id kong_backend)

TO_PRINCIPAL_ID="snb3j-s62qn-qownd-imqtp-fmqwk-paao6-w67uo-zzhwr-ntrwu-2ngtu-xae"
AMOUNT=1_000_000_000
TOKEN_LEDGER="ckbtc_icp_lp_ledger"

dfx canister --identity kong call ${TOKEN_LEDGER} icrc1_transfer "(record {
  to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
  amount=${AMOUNT};
},)"
