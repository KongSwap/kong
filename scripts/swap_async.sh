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
APPROVE_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${PAY_TOKEN_LEDGER} icrc2_approve "(record {
	amount = $(echo "${PAY_AMOUNT} + ${FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${KONG_CANISTER}\";
	};
})" | awk -F'=' '{print $2}' | awk '{print $1}')

# 3. submit swap to kingkongswap canister
REQUEST_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_async "(record {
    pay_token = \"${PAY_TOKEN}\";
    pay_amount = ${PAY_AMOUNT};
    receive_token = \"${RECEIVE_TOKEN}\";
    receive_amount = opt ${RECEIVE_AMOUNT};
    max_slippage = opt ${MAX_SLIPPAGE};
})" | awk -F'=' '{print $2}' | awk '{print $1}')

#4. keep polling requests until it's completed
echo
echo "States:"
LAST_STATUS=""
while true; do
    STATUS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} requests --output json '(opt '${REQUEST_ID}')' | jq -r '.Ok[].statuses[-1]')
    if [ "${STATUS}" != "${LAST_STATUS}" ]; then
        echo ${STATUS}
        LAST_STATUS=${STATUS}
    fi
    if [ "${STATUS}" = "Success" ] || [ "${STATUS}" = "Failed" ]; then
    	break
    fi
    sleep 1
done
