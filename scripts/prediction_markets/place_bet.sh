#!/bin/bash

# Check if all required arguments are provided
if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
    echo "Usage: $0 <market_id> <outcome_index> <amount> [token_id]"
    echo "Example: $0 1 0 100"
    echo "  market_id: The ID of the market to bet on"
    echo "  outcome_index: The index of the outcome (0 for first option, 1 for second, etc.)"
    echo "  amount: Amount of tokens to bet"
    echo "  token_id: (Optional) Token canister ID to use (defaults to KONG if not specified)"
    exit 1
fi

MARKET_ID=$1
OUTCOME_INDEX=$2
AMOUNT=$3
TOKEN_ID=${4:-"umunu-kh777-77774-qaaca-cai"} # Default to KONG if not specified

# Get token ledger canister ID based on token ID
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)

EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

echo "Approving ${AMOUNT} ${TOKEN_SYMBOL} tokens for transfer from ${TOKEN_LEDGER}..."
dfx canister call ${TOKEN_LEDGER} icrc2_approve "(record {
	amount = $(echo "${AMOUNT} + ${TOKEN_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

echo "Placing bet of ${AMOUNT} ${TOKEN_SYMBOL} on outcome ${OUTCOME_INDEX} for market ${MARKET_ID}..."
dfx canister call prediction_markets_backend place_bet "(
  $MARKET_ID : nat, 
  $OUTCOME_INDEX : nat, 
  $AMOUNT : nat,
  opt \"${TOKEN_ID}\"  
)"


# Examples:
# # Bet 100 KONG tokens on the first option (index 0) of market 0
# ./place_bet.sh 0 0 100

# # Bet 100 KONG tokens on the second option (index 1) of market 0
# ./place_bet.sh 0 1 100

# # Place a bet of 100 KONG tokens on the first outcome (index 0) of market 1
# ./place_bet.sh 1 0 100

# # Place a bet of 25 ksICP tokens on the first outcome (index 0) of market 1
# ./place_bet.sh 1 0 2500000000 ulvla-h7777-77774-qaacq-cai