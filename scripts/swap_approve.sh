#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity konguser1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

PAY_TOKEN="ICP"
PAY_TOKEN_LEDGER=$(dfx canister id ${NETWORK} $(echo ${PAY_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
PAY_AMOUNT=1_000_000_000
PAY_AMOUNT=${PAY_AMOUNT//_/}    # remove underscore
RECEIVE_TOKEN="ckUSDT"
RECEIVE_TOKEN_LEDGER=$(dfx canister id ${NETWORK} $(echo ${RECEIVE_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
RECEIVE_AMOUNT=5_000_000
RECEIVE_AMOUNT=${RECEIVE_AMOUNT//_/}
MAX_SLIPPAGE=1.0					      # 1%
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

# 1. calculate gas fee needed for transfer
if [ "${PAY_TOKEN}" = "ICP" ]; then
  FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${PAY_TOKEN_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
else
  FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${PAY_TOKEN_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
fi
FEE=${FEE//_/}

# 2. submit icrc2_approve to allow canister to transfer pay token from the caller
STATE1_START=$SECONDS
APPROVE_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${PAY_TOKEN_LEDGER} icrc2_approve "(record {
	amount = $(echo "${PAY_AMOUNT} + ${FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${KONG_CANISTER}\";
	};
})" | awk -F'=' '{print $2}' | awk '{print $1}')
STATE1_FINISH=$SECONDS

echo
echo "icrc2_approve block id: ${APPROVE_BLOCK_ID}"
echo "STATE1_DURATION: $((STATE1_FINISH - STATE1_START)) seconds"

# 3. submit swap to kong swap canister
STATE2_START=$SECONDS
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap "(record {
	pay_token = \"${PAY_TOKEN}\";
	pay_amount = ${PAY_AMOUNT};
	receive_token = \"${RECEIVE_TOKEN}\";
	receive_amount = opt ${RECEIVE_AMOUNT};
	max_slippage = opt ${MAX_SLIPPAGE};
})"
STATE2_FINISH=$SECONDS

echo
echo "kong canister swap() completed"
echo "STATE2_DURATION: $((STATE2_FINISH - STATE2_START)) seconds"