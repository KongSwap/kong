#!/bin/bash
# 03_test_resolution_disagreement.sh - Tests the resolution disagreement process where creator's deposit is burned

set -e

echo "==== Testing Resolution Disagreement with Deposit Burning ===="

# Get canister IDs
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
ACTIVATION_FEE=3000000000 # 3000 KONG

echo "Prediction Markets Canister: $PREDICTION_MARKETS_CANISTER"
echo "KONG Ledger: $KONG_LEDGER"
echo "KONG Fee: $KONG_FEE"

# Step 1: Create a new market as a regular user (Alice)
echo -e "\n==== Step 1: Creating market as regular user (Alice) ===="
dfx identity use alice
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo "Using Alice's principal: $ALICE_PRINCIPAL"

RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will SOL price exceed $ 500 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 61 : nat }, null, opt true, opt 0.1)")

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

# Step 2: Alice places activation bet (3000 KONG) on "Yes"
echo -e "\n==== Step 2: Alice placing activation bet (3000 KONG) on 'Yes' ===="
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo "Approving tokens for transfer..."
dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${ACTIVATION_FEE} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place activation bet
echo "Alice placing activation bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $ACTIVATION_FEE : nat)"

# Step 3: Bob places bet on "Yes"
echo -e "\n==== Step 3: Bob placing bet on 'Yes' ===="
dfx identity use bob
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Using Bob's principal: $BOB_PRINCIPAL"

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
echo "Bob placing bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Step 4: Carol places bet on "No"
echo -e "\n==== Step 4: Carol placing bet on 'No' ===="
dfx identity use carol
CAROL_PRINCIPAL=$(dfx identity get-principal)
echo "Using Carol's principal: $CAROL_PRINCIPAL"

BET_AMOUNT=7000000000 # 7000 KONG
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
echo "Carol placing bet on 'No'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 1 : nat, $BET_AMOUNT : nat)"

# Step 5: Check market bets and status
echo -e "\n==== Step 5: Checking market bets and status ===="
dfx canister call prediction_markets_backend get_market_bets "($MARKET_ID)"
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 6: Fast forward time (market must end before resolution)
echo -e "\n==== Step 6: Fast forwarding time (waiting for market to end) ===="
echo "Waiting 1 minute for market to end..."
sleep 60

# Step 7: Check balances before resolution disagreement
echo -e "\n==== Step 7: Checking balances before resolution disagreement ===="
echo "Alice's balance before:"
dfx identity use alice
dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$ALICE_PRINCIPAL\"; })"

echo "Bob's balance before:"
dfx identity use bob
dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$BOB_PRINCIPAL\"; })"

echo "Carol's balance before:"
dfx identity use carol
dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$CAROL_PRINCIPAL\"; })"

# Step 8: Alice (creator) proposes resolution with "Yes" as winner
echo -e "\n==== Step 8: Alice (creator) proposing resolution with 'Yes' as winner ====" 
dfx identity use alice
echo "Alice proposing resolution..."
dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 : nat })"

# Step 9: Admin proposes different resolution with "No" as winner (creating disagreement)
echo -e "\n==== Step 9: Admin proposing different resolution with 'No' as winner ====" 
dfx identity use default
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo "Using Admin's principal: $DEFAULT_PRINCIPAL"

echo "Admin proposing different resolution (creating disagreement)..."
dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 1 : nat })"

# Step 10: Check market status after disagreement (should be voided)
echo -e "\n==== Step 10: Checking market status after disagreement (should be voided) ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 11: Check balances after resolution disagreement
echo -e "\n==== Step 11: Checking balances after resolution disagreement ===="
echo "Alice's balance after (should be missing 3000 KONG deposit):"
dfx identity use alice
dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$ALICE_PRINCIPAL\"; })"

echo "Bob's balance after (should be refunded):"
dfx identity use bob
dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$BOB_PRINCIPAL\"; })"

echo "Carol's balance after (should be refunded):"
dfx identity use carol
dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$CAROL_PRINCIPAL\"; })"

# Step 12: Check user histories
echo -e "\n==== Step 12: Checking user histories ===="
echo "Alice's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$ALICE_PRINCIPAL\" )"
echo "Bob's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$BOB_PRINCIPAL\" )"
echo "Carol's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$CAROL_PRINCIPAL\" )"

echo -e "\n==== Test completed successfully ===="
