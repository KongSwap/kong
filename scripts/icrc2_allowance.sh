#!/usr/bin/env bash

USER_PRINCIPAL_ID=$(dfx identity --identity kong_user1 get-principal)
KONG_BACKEND=$(dfx canister id kong_backend)
TOKEN="cngnf-vqaaa-aaaar-qag4q-cai"

dfx canister call ${TOKEN} icrc2_allowance '
  record {
    account = record {
      owner = principal "'${USER_PRINCIPAL_ID}'";
    };
    spender = record {
      owner = principal "'${KONG_BACKEND}'";
    };
  }
'