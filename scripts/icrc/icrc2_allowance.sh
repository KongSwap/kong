#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

USER_PRINCIPAL_ID=$(dfx identity get-principal --identity kong_user1)
KONG_BACKEND=$(dfx canister id kong_backend)
TOKEN_LEDGER=$(dfx canister id ckusdt_ledger)

dfx canister call ${NETWORK} ${TOKEN_LEDGER} icrc2_allowance '
  record {
    account = record {
      owner = principal "'${USER_PRINCIPAL_ID}'";
    };
    spender = record {
      owner = principal "'${KONG_BACKEND}'";
    };
  }
'