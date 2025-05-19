#!/bin/bash
# 07_test_simulate_future_weight.sh - Tests the simulate_future_weight functionality

set -e

echo "==== Testing Simulate Future Weight Functionality ===="

# Get canister IDs
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)

echo "Prediction Markets Canister: $PREDICTION_MARKETS_CANISTER"
echo "KONG Ledger: $KONG_LEDGER"

# Step 1: Create a new market as admin (default) with time weighting
echo -e "\n==== Step 1: Creating market as admin with time weighting ===="
dfx identity use default
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo "Using Admin's principal: $DEFAULT_PRINCIPAL"

# Create market with time weighting enabled and alpha = 0.25
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will XRP reach $2 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 600 : nat }, null, opt true, opt 0.25, \
  opt \"${KONG_LEDGER}\")")


# Extract market ID
MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
echo "Market created with ID: $MARKET_ID"

# Step 2: Generate time weight curve
echo -e "\n==== Step 2: Generating time weight curve ===="
dfx canister call prediction_markets_backend generate_time_weight_curve "($MARKET_ID, 10)"

# Step 3: Get current time and simulate weights at different future times
echo -e "\n==== Step 3: Simulating weights at different future times ===="
CURRENT_TIME=$(date +%s)
FUTURE_TIME_1=$((CURRENT_TIME + 60))  # 1 minute in the future
FUTURE_TIME_2=$((CURRENT_TIME + 300)) # 5 minutes in the future
FUTURE_TIME_3=$((CURRENT_TIME + 600)) # 10 minutes in the future

echo "Current time: $CURRENT_TIME"
echo "Future time 1 (1 minute later): $FUTURE_TIME_1"
echo "Future time 2 (5 minutes later): $FUTURE_TIME_2"
echo "Future time 3 (10 minutes later): $FUTURE_TIME_3"

echo "Simulating weight for a bet placed now and resolved in 1 minute:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $CURRENT_TIME, $FUTURE_TIME_1)"

echo "Simulating weight for a bet placed now and resolved in 5 minutes:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $CURRENT_TIME, $FUTURE_TIME_2)"

echo "Simulating weight for a bet placed now and resolved in 10 minutes:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $CURRENT_TIME, $FUTURE_TIME_3)"

# Step 4: Wait 30 seconds and simulate weights again
echo -e "\n==== Step 4: Waiting 30 seconds and simulating weights again ===="
echo "Waiting 30 seconds..."
sleep 30

DELAYED_TIME=$(date +%s)
FUTURE_TIME_1=$((DELAYED_TIME + 60))  # 1 minute in the future
FUTURE_TIME_2=$((DELAYED_TIME + 300)) # 5 minutes in the future
FUTURE_TIME_3=$((DELAYED_TIME + 600)) # 10 minutes in the future

echo "Current time after delay: $DELAYED_TIME"
echo "Future time 1 (1 minute later): $FUTURE_TIME_1"
echo "Future time 2 (5 minutes later): $FUTURE_TIME_2"
echo "Future time 3 (10 minutes later): $FUTURE_TIME_3"

echo "Simulating weight for a bet placed now and resolved in 1 minute:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $DELAYED_TIME, $FUTURE_TIME_1)"

echo "Simulating weight for a bet placed now and resolved in 5 minutes:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $DELAYED_TIME, $FUTURE_TIME_2)"

echo "Simulating weight for a bet placed now and resolved in 10 minutes:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $DELAYED_TIME, $FUTURE_TIME_3)"

# Step 5: Compare weights at different time points
echo -e "\n==== Step 5: Comparing weights for bets placed at different times ===="
echo "Simulating weight for a bet placed at the beginning and resolved at the end:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $CURRENT_TIME, $FUTURE_TIME_3)"

echo "Simulating weight for a bet placed in the middle and resolved at the end:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $DELAYED_TIME, $FUTURE_TIME_3)"

echo "Simulating weight for a bet placed near the end and resolved at the end:"
LATE_TIME=$((FUTURE_TIME_3 - 60))  # 1 minute before the end
echo "Simulating weight for a bet placed 1 minute before the end:"
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $LATE_TIME, $FUTURE_TIME_3)"

echo -e "\n==== Test completed successfully ===="
