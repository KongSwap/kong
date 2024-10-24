#!/usr/bin/env bash

USER=kong_user1
KONG_BACKEND=$(dfx canister id kong_backend)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 10000000000" | bc)  # 10 seconds from now
TOKEN="icp"

dfx canister call --identity ${USER} ${TOKEN}_ledger icrc2_approve '
  record {
    amount = 100_010_000;
    expires_at = opt '${EXPIRES_AT}';
    spender = record {
      owner = principal "'${KONG_BACKEND}'";
    };
  }
'