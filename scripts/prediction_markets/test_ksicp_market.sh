#!/bin/bash

# Test script for creating and interacting with a prediction market using ICP tokens
# This demonstrates the multi-token functionality of the Kong Swap prediction markets

# Set up variables
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
ICP_LEDGER=$(dfx canister id icp_ledger)
ICP_FEE=$(dfx canister call ${ICP_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
ICP_FEE=${ICP_FEE//_/}

echo "=== Testing ICP Multi-Token Market ==="
echo "Prediction Markets Canister: ${PREDICTION_MARKETS_CANISTER}"
echo "ICP Ledger: ${ICP_LEDGER}"
echo "ICP Fee: ${ICP_FEE}"

# Step 1: Create a market using ICP token
echo "Creating a new market with ICP tokens..."
MARKET_ID=$(dfx canister call prediction_markets_backend create_market '(
  "Will BTC reach $100,000 by the end of 2025?",
  variant { Crypto },
  "Prediction on Bitcoin price. Market resolves YES if BTC reaches $100,000 on any major exchange before the end of 2025.",
  vec { "Yes"; "No" },
  variant { Admin },
  variant { Timestamp = 1766822400000000000 }, 
  null,
  null, 
  null,
  opt "ulvla-h7777-77774-qaacq-cai"
)' | grep -oP '\(\s*\K[0-9]+(?=\s*:\s*nat\s*\))')

echo "Created market with ID: ${MARKET_ID}"

# Step 2: Place a bet using ICP
echo "Placing a bet with ICP tokens..."

# The activation threshold for ICP is 25 ICP
BET_AMOUNT=2500000000 # 25 ICP (8 decimals)
OUTCOME_INDEX=0 # Betting on "Yes"

# Approve the tokens for transfer
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 600000000000" | bc)  # approval expires 600 seconds from now

echo "Approving ICP tokens for transfer..."
dfx canister call ${ICP_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT} + ${ICP_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

echo "Placing bet of ${BET_AMOUNT} ICP on outcome ${OUTCOME_INDEX} for market ${MARKET_ID}..."
dfx canister call prediction_markets_backend place_bet "(
  ${MARKET_ID} : nat, 
  ${OUTCOME_INDEX} : nat, 
  ${BET_AMOUNT} : nat,
  opt \"ulvla-h7777-77774-qaacq-cai\"
)"

# Step 3: Get market status to verify bet was placed
echo "Checking market status..."
dfx canister call prediction_markets_backend get_all_markets "(record {
  offset = 0;
  limit = 10;
  filter = null;
  sort_by = null;
  direction = null;
  include_resolved = true;
})" | grep -A 20 "id = ${MARKET_ID} : nat"

# Step 4: Place another bet on the other outcome
echo "Placing a second bet on the opposite outcome..."
SECOND_BET_AMOUNT=2500000000 # 25 ICP
SECOND_OUTCOME_INDEX=1 # Betting on "No"

# Approve the tokens for transfer
dfx canister call ${ICP_LEDGER} icrc2_approve "(record {
	amount = $(echo "${SECOND_BET_AMOUNT} + ${ICP_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

dfx canister call prediction_markets_backend place_bet "(
  ${MARKET_ID} : nat, 
  ${SECOND_OUTCOME_INDEX} : nat, 
  ${SECOND_BET_AMOUNT} : nat,
  opt \"ulvla-h7777-77774-qaacq-cai\"
)"

# Step 5: Get all bets for the market
echo "Getting all bets for market ${MARKET_ID}..."
dfx canister call prediction_markets_backend get_all_market_bets "(${MARKET_ID} : nat)"

# Step 6: Resolve the market (admin resolution)
echo "Resolving market as admin..."
dfx canister call prediction_markets_backend resolve_via_admin "(
  ${MARKET_ID} : nat,
  vec { ${OUTCOME_INDEX} : nat }
)"

# Step 7: Check user history to see payouts
echo "Checking user history for payouts..."
USER_PRINCIPAL=$(dfx identity get-principal)
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${USER_PRINCIPAL}\"
)"

echo "=== ICP Market Test Complete ==="
