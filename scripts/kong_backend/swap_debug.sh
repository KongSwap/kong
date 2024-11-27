#!/usr/bin/env bash

# kong swap canister swap interface with all the debug logging

KONG_CANISTER=$(dfx canister id kong_backend)
PAY_TOKEN="ICP"
PAY_AMOUNT=1_000_000_000
PAY_TOKEN_LEDGER=$(dfx canister id ckbtc_ledger)
RECEIVE_TOKEN="ckUSDT"
RECEIVE_AMOUNT=5_000_000
RECEIVE_TOKEN_LEDGER=$(dfx canister id icp_ledger)
MAX_SLIPPAGE=1.0           # 1%
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 10000000000" | bc)  # 10 seconds from now
APPROVE_TIMEOUT=$(($(date +%s%N) + 10000000000))  # 10 seconds from now

# 1. select id to use
dfx identity use default
# 1.1 display balances of user before swap
dfx canister call ${PAY_TOKEN_LEDGER} icrc1_balance_of "(record {
  owner=principal \"$(dfx identity get-principal)\";
  subaccount=null;
},)"
dfx canister call ${RECEIVE_TOKEN_LEDGER} icrc1_balance_of "(record {
  owner=principal \"$(dfx identity get-principal)\";
  subaccount=null;
},)"

# 2. calculate gas fee needed for transfer
if [ "${PAY_TOKEN}" = "ICP" ]; then
  GAS_FEE=$(dfx canister call ${PAY_TOKEN_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
else
  GAS_FEE=$(dfx canister call ${PAY_TOKEN_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
fi
echo "gas fee: ${GAS_FEE}"
echo

# 3. submit icrc2_approve to allow canister to transfer ICP from the caller
APPROVE_BLOCK_ID=$(dfx canister call ${PAY_TOKEN_LEDGER} icrc2_approve "(record {
  amount = $((${PAY_AMOUNT//_/} + ${GAS_FEE//_/}));
  expires_at = opt ${EXPIRES_AT};
  spender = record {
    owner = principal \"${KONG_CANISTER}\";
  };
},)" | awk -F'=' '{print $2}' | awk '{print $1}')
# 3.1 verify approve block id
echo "icrc2_approve block id: ${APPROVE_BLOCK_ID}"
if [ "${PAY_TOKEN}" = "ICP" ]; then
  dfx canister call ${PAY_TOKEN_LEDGER} query_blocks "(record {
    start = ${APPROVE_BLOCK_ID};
    length = 1;
  },)"
else
  dfx canister call ${PAY_TOKEN_LEDGER} get_transactions "(record {
    start = ${APPROVE_BLOCK_ID};
    length = 1;
  },)"
fi
echo

# 4.0 display balance of pool before swap
dfx canister call ${KONG_CANISTER} liquidity_pool_balances '()'
echo
# 4.1 submit swap to swap ICP to KONG
BLOCK_IDES=$(dfx canister call ${KONG_CANISTER} swap "(record {
  pay_token = \"${PAY_TOKEN}\";
  pay_amount = ${PAY_AMOUNT};
  receive_token = \"${RECEIVE_TOKEN}\";
  receive_amount = ${RECEIVE_AMOUNT};
  max_slippage = opt ${MAX_SLIPPAGE};
},)")
TRANSFER_FROM_BLOCK_ID=$(echo ${BLOCK_IDES} | awk -F';' '{print $2}' | awk '{print $1}')
TRANSFER_BLOCK_ID=$(echo ${BLOCK_IDES} | awk -F';' '{print $3}' | awk '{print $1}')
# display the transfer_block id
echo "icrc2_transfer_from block id: ${TRANSFER_FROM_BLOCK_ID}"
if [ "${PAY_TOKEN}" = "ICP" ]; then
  dfx canister call ${PAY_TOKEN_LEDGER} query_blocks "(record {
    start = ${TRANSFER_FROM_BLOCK_ID};
    length = 1;
  },)"
else
  dfx canister call ${PAY_TOKEN_LEDGER} get_transactions "(record {
    start = ${TRANSFER_FROM_BLOCK_ID};
    length = 1;
  },)"
fi
echo
# display the transfer_block id
echo "icrc1_transfer block id: ${TRANSFER_BLOCK_ID}"
if [ "${RECEIVE_TOKEN}" = "ICP" ]; then
  dfx canister call ${RECEIVE_TOKEN_LEDGER} query_blocks "(record {
    start = ${TRANSFER_BLOCK_ID};
    length = 1;
  },)"
else
  dfx canister call ${RECEIVE_TOKEN_LEDGER} get_transactions "(record {
    start = ${TRANSFER_BLOCK_ID};
    length = 1;
  },)"
fi
# 4.2 display balance of pool after swap
dfx canister call ${KONG_CANISTER} liquidity_pool_balances '()'
echo

# 5. display balances of user after swap
dfx canister call ${PAY_TOKEN_LEDGER} icrc1_balance_of "(record {
  owner=principal \"$(dfx identity get-principal)\";
  subaccount=null;
},)"
dfx canister call ${RECEIVE_TOKEN_LEDGER} icrc1_balance_of "(record {
  owner=principal \"$(dfx identity get-principal)\";
  subaccount=null;
},)"