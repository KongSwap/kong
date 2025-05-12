#!/bin/bash
# 05_test_payout_records.sh - Tests the get_market_payout_records functionality

set -e

echo "==== Testing Market Payout Records Functionality ===="

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
  "(\"Will LINK reach $50 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 300 : nat }, null, opt true, opt 0.15)")

# Extract market ID
MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
echo "Market created with ID: $MARKET_ID"

# Step 2: Have Alice place an early bet on "Yes"
echo -e "\n==== Step 2: Alice placing early bet on 'Yes' ===="
dfx identity use alice
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo "Using Alice's principal: $ALICE_PRINCIPAL"

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

# Place bet
echo "Alice placing bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Step 3: Wait 15 seconds and have Bob place a bet on "No"
echo -e "\n==== Step 3: Waiting 15 seconds and having Bob place a bet on 'No' ===="
echo "Waiting 15 seconds..."
sleep 15

dfx identity use bob
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Using Bob's principal: $BOB_PRINCIPAL"

BET_AMOUNT=8000000000 # 8000 KONG
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

# Step 4: Wait 15 more seconds and have Carol place a bet on "Yes"
echo -e "\n==== Step 4: Waiting 15 more seconds and having Carol place a bet on 'Yes' ===="
echo "Waiting 15 seconds..."
sleep 15

dfx identity use carol
CAROL_PRINCIPAL=$(dfx identity get-principal)
echo "Using Carol's principal: $CAROL_PRINCIPAL"

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
echo "Carol placing bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Step 5: Check market bets and status
echo -e "\n==== Step 5: Checking market bets and status ===="
dfx canister call prediction_markets_backend get_market_bets "($MARKET_ID)"
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 6: Fast forward time (market must end before resolution)
echo -e "\n==== Step 6: Fast forwarding time (waiting for market to end) ===="
echo "Waiting for market to end..."
sleep 270

# Step 7: Admin resolves market with "Yes" as winner
echo -e "\n==== Step 7: Admin resolving market with 'Yes' as winner ===="
dfx identity use default
echo "Admin resolving market..."
dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 : nat })"

# Step 8: Check market status after resolution
echo -e "\n==== Step 8: Checking market status after resolution ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 9: Get market payout records
echo -e "\n==== Step 9: Getting market payout records ===="
dfx canister call prediction_markets_backend get_market_payout_records "($MARKET_ID)"

# Step 10: Check user histories to verify payouts
echo -e "\n==== Step 10: Checking user histories to verify payouts ===="
echo "Alice's history (should show time-weighted bonus):"
dfx canister call prediction_markets_backend get_user_history "( principal \"$ALICE_PRINCIPAL\" )"
echo "Bob's history (should show loss):"
dfx canister call prediction_markets_backend get_user_history "( principal \"$BOB_PRINCIPAL\" )"
echo "Carol's history (should show win with less time-weighted bonus):"
dfx canister call prediction_markets_backend get_user_history "( principal \"$CAROL_PRINCIPAL\" )"

echo -e "\n==== Test completed successfully ===="
