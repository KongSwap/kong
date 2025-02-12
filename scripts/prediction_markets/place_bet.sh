#!/bin/bash

# Check if all required arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <market_id> <outcome_index> <amount>"
    echo "Example: $0 1 0 100"
    echo "  market_id: The ID of the market to bet on"
    echo "  outcome_index: The index of the outcome (0 for first option, 1 for second, etc.)"
    echo "  amount: Amount of tokens to bet"
    exit 1
fi

MARKET_ID=$1
OUTCOME_INDEX=$2
AMOUNT=$3

# icrc2_approve KONG token so backend can icrc2_transfer_from
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${AMOUNT} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, $OUTCOME_INDEX : nat, $AMOUNT : nat)"


# # Bet 100 tokens on EXE (first option)
# ./place_bet.sh 0 0 100

# # Bet 100 tokens on ALICE (second option)
# ./place_bet.sh 0 1 100

# # Place a bet of 100 tokens on the first outcome (index 0) of market 1
# ./place_bet.sh 1 0 100

# # Place a bet of 50 tokens on the second outcome (index 1) of market 2
# ./place_bet.sh 2 1 50