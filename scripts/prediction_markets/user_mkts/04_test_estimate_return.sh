#!/bin/bash
# 04_test_estimate_return.sh - Tests the estimate_bet_return functionality for a live market

set -e

echo "==== Testing Estimate Bet Return Functionality ===="

# Get canister IDs
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
ACTIVATION_FEE=3000000000 # 3000 KONG

echo "Prediction Markets Canister: $PREDICTION_MARKETS_CANISTER"
echo "KONG Ledger: $KONG_LEDGER"
echo "KONG Fee: $KONG_FEE"

# Step 1: Create a new market as admin (default) with time weighting
echo -e "\n==== Step 1: Creating market as admin with time weighting ===="
dfx identity use default
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo "Using Admin's principal: $DEFAULT_PRINCIPAL"

RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will AVAX reach $100 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 600 : nat }, null, opt true, opt 0.2)")

# Extract market ID
MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
echo "Market created with ID: $MARKET_ID"

# Step 2: Check market status (should be Active since created by admin)
echo -e "\n==== Step 2: Checking market status (should be Active) ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 3: Place initial bets to create a pool
echo -e "\n==== Step 3: Placing initial bets to create a pool ===="
BET_AMOUNT=5000000000 # 5000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo "Approving tokens for transfer..."
dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place bet on "Yes"
echo "Admin placing bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Step 4: Have Bob place a bet on "No"
echo -e "\n==== Step 4: Having Bob place a bet on 'No' ===="
dfx identity use bob
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Using Bob's principal: $BOB_PRINCIPAL"

BET_AMOUNT=3000000000 # 3000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo "Approving tokens for transfer..."
dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place bet
echo "Bob placing bet on 'No'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 1 : nat, $BET_AMOUNT : nat)"

# Step 5: Test estimate_bet_return with various amounts
echo -e "\n==== Step 5: Testing estimate_bet_return with various amounts ===="
CURRENT_TIME=$(date +%s)

echo "Estimating return for a 100 KONG bet on 'Yes':"
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 0, 100000000, $CURRENT_TIME)"

echo "Estimating return for a 1000 KONG bet on 'Yes':"
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 0, 1000000000, $CURRENT_TIME)"

echo "Estimating return for a 100 KONG bet on 'No':"
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 1, 100000000, $CURRENT_TIME)"

echo "Estimating return for a 1000 KONG bet on 'No':"
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 1, 1000000000, $CURRENT_TIME)"

# Step 6: Wait a bit and test time-weighted estimates
echo -e "\n==== Step 6: Testing time-weighted estimates after delay ===="
echo "Waiting 30 seconds to demonstrate time-weighting effect..."
sleep 30

CURRENT_TIME=$(date +%s)
echo "Estimating return for a 1000 KONG bet on 'Yes' after delay:"
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 0, 1000000000, $CURRENT_TIME)"

echo "Estimating return for a 1000 KONG bet on 'No' after delay:"
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 1, 1000000000, $CURRENT_TIME)"

# Step 7: Place one more bet and check market status
echo -e "\n==== Step 7: Placing one more bet and checking market status ===="
dfx identity use carol
CAROL_PRINCIPAL=$(dfx identity get-principal)
echo "Using Carol's principal: $CAROL_PRINCIPAL"

BET_AMOUNT=2000000000 # 2000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo "Approving tokens for transfer..."
dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place bet
echo "Carol placing bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Check market status
echo "Checking final market status:"
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Return to default identity
dfx identity use default
echo -e "\n==== Test completed successfully ===="
