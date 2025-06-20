#!/bin/bash
# 01_test_market_creation.sh - Tests the user market creation and activation with 3000 KONG fee

set -e

echo "==== Testing User Market Creation and Activation ===="

# Ensure we're using the alice identity (regular user)
dfx identity use alice
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo "Using Alice's principal: $ALICE_PRINCIPAL"

# Get canister IDs
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
ACTIVATION_FEE=300000000000 # 3000 KONG, token has decimal precision 8

echo "Prediction Markets Canister: $PREDICTION_MARKETS_CANISTER"
echo "KONG Ledger: $KONG_LEDGER"
echo "KONG Fee: $KONG_FEE"

# Step 1: Create a new market as a regular user (Alice)
echo -e "\n==== Step 1: Creating market as regular user (Alice) ===="
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will BTC reach $ 100k in 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 120 : nat }, null, null, null, \
  opt \"umunu-kh777-77774-qaaca-cai\")")
# ^ Using Admin resolution method - the dual approval flow is triggered automatically for non-admin creators

# Extract market ID and check for success
if [[ $RESULT == *"Ok"* ]]; then
    MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
    echo "Market created with ID: $MARKET_ID"
    
    # Verify market exists
    echo "Verifying market exists..."
    MARKET_CHECK=$(dfx canister call prediction_markets_backend get_market "($MARKET_ID)")
    if [[ $MARKET_CHECK == "(null)" ]]; then
        echo "ERROR: Market not found after creation. This could indicate a canister state issue."
        exit 1
    else
        echo "Market verified successfully."
    fi
else
    echo "ERROR: Failed to create market"
    echo "$RESULT"
    exit 1
fi

# Step 2: Check market status (should be Pending)
echo -e "\n==== Step 2: Checking market status (should be Pending) ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 3: Try to place a small bet (should fail due to activation requirement)
echo -e "\n==== Step 3: Trying to place small bet (should fail) ====" 
SMALL_BET=1000000 # 1 KONG

# Approve tokens for transfer
echo "Approving tokens for transfer..."
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${SMALL_BET} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Try to place bet (should fail)
echo "Attempting to place small bet (should fail)..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $SMALL_BET : nat, opt \"$KONG_LEDGER\")"

# Step 3.5: Have Carol try to place a bet while the market is still pending
echo -e "\n==== Step 3.5: Having Carol try to place a bet on a pending market (should fail) ====" 
dfx identity use carol
CAROL_PRINCIPAL=$(dfx identity get-principal)
echo "Using Carol's principal: $CAROL_PRINCIPAL"

BET_AMOUNT=5000000000 # 5000 KONG

# Approve tokens for transfer
echo "Approving tokens for transfer..."
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Try to place bet on pending market (should fail)
echo "Carol attempting to place bet on pending market (should fail)..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 1 : nat, $BET_AMOUNT : nat, opt \"$KONG_LEDGER\")"

# Switch back to Alice for next step
dfx identity use alice

# Step 4: Place activation bet (3000 KONG)
echo -e "\n==== Step 4: Placing activation bet (3000 KONG) ====" 

# Approve tokens for transfer
echo "Approving tokens for transfer..."
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${ACTIVATION_FEE} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place activation bet
echo "Placing activation bet..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $ACTIVATION_FEE : nat, opt \"$KONG_LEDGER\")"

# Step 5: Check market status again (should now be Active)
echo -e "\n==== Step 5: Checking market status (should now be Active) ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 6: Have another user place a bet on the now active market
echo -e "\n==== Step 6: Having Bob place a bet on the active market ====" 
dfx identity use bob
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Using Bob's principal: $BOB_PRINCIPAL"

BET_AMOUNT=50000000 # 50 KONG

# Approve tokens for transfer
echo "Approving tokens for transfer..."
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place bet
echo "Bob placing bet..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 1 : nat, $BET_AMOUNT : nat, opt \"$KONG_LEDGER\")"

# Step 7: Check market bets
echo -e "\n==== Step 7: Checking market bets ===="
dfx canister call prediction_markets_backend get_market_bets "($MARKET_ID)"

# Step 8: Check user history for Alice (market creator)
echo -e "\n==== Step 8: Checking user history for Alice (market creator) ===="
dfx canister call prediction_markets_backend get_user_history "( principal \"$ALICE_PRINCIPAL\" )"

# Return to default identity
dfx identity use default
echo -e "\n==== Test completed successfully ===="
