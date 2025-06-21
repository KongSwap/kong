#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

PAY_TOKEN="ksUSDT"
PAY_TOKEN_LEDGER=$(dfx canister id ${NETWORK} $(echo ${PAY_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
PAY_AMOUNT=10_000_000  # 10 ksUSDT (6 decimals)
PAY_AMOUNT=${PAY_AMOUNT//_/}    # remove underscore
RECEIVE_TOKEN="SOL"  # Native SOL token
RECEIVE_AMOUNT=0  # Let the system calculate optimal amount
MAX_SLIPPAGE=90.0  # 90%
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

echo "=============== ksUSDT to SOL SWAP ==============="
echo "Network: ${NETWORK:-local}"
echo "Pay Token: $PAY_TOKEN"
echo "Pay Amount: $PAY_AMOUNT"
echo "Receive Token: SOL"
echo "Max Slippage: $MAX_SLIPPAGE%"
echo "=================================================="

# 1. Get swap amounts quote
echo
echo "Step 1: Getting swap quote..."
SWAP_QUOTE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts "(\"${PAY_TOKEN}\", ${PAY_AMOUNT}, \"${RECEIVE_TOKEN}\")")
echo "Swap quote: ${SWAP_QUOTE}"

# 2. Calculate gas fee needed for transfer
echo
echo "Step 2: Calculating fees..."
FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${PAY_TOKEN_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
FEE=${FEE//_/}
echo "ksUSDT fee: ${FEE}"

# 3. Submit icrc2_approve to allow canister to transfer pay token from the caller
echo
echo "Step 3: Approving ksUSDT spending..."
STATE1_START=$SECONDS
APPROVE_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${PAY_TOKEN_LEDGER} icrc2_approve "(record {
	amount = $(echo "${PAY_AMOUNT} + ${FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${KONG_CANISTER}\";
	};
})" | awk -F'=' '{print $2}' | awk '{print $1}')
STATE1_FINISH=$SECONDS

echo "icrc2_approve block id: ${APPROVE_BLOCK_ID}"
echo "Approval duration: $((STATE1_FINISH - STATE1_START)) seconds"

# 4. Get Solana wallet address
echo
echo "Step 4: Getting Solana wallet address..."
SOLANA_ADDRESS=$(solana address)
echo "Solana address: ${SOLANA_ADDRESS}"

# 5. Submit swap to kong swap canister
echo
echo "Step 5: Executing swap..."
STATE2_START=$SECONDS
SWAP_RESULT=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap "(record {
	pay_token = \"${PAY_TOKEN}\";
	pay_amount = ${PAY_AMOUNT};
	receive_token = \"${RECEIVE_TOKEN}\";
	receive_amount = opt ${RECEIVE_AMOUNT};
	max_slippage = opt ${MAX_SLIPPAGE};
	receive_address = opt \"${SOLANA_ADDRESS}\";
})")
STATE2_FINISH=$SECONDS

echo "Swap result: ${SWAP_RESULT}"
echo "Swap duration: $((STATE2_FINISH - STATE2_START)) seconds"
echo
echo "=============== SWAP COMPLETED DO solana balance check===============" 
solana balance