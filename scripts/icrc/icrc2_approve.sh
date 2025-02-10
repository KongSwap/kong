#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

IDENTITY="--identity kong_user1"
KONG_BACKEND=$(dfx canister id kong_backend)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 10000000000" | bc)  # 10 seconds from now
TOKEN_LEDGER=$(dfx canister id ksusdt_ledger)

dfx canister call ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} icrc2_approve '
  record {
    amount = 100_010_000;
    expires_at = opt '${EXPIRES_AT}';
    spender = record {
      owner = principal "'${KONG_BACKEND}'";
    };
  }
'