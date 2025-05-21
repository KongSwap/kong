#!/bin/bash
# 02_test_dual_resolution.sh - Tests the dual resolution process for user-created markets

set -e

echo "==== Testing Dual Resolution for User-Created Markets ===="

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
dfx identity use alice
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo "Using Alice's principal: $ALICE_PRINCIPAL"

RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ETH price exceed $ 5000 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 120 : nat }, null, opt true, opt 0.1, \
  opt \"${KONG_LEDGER}\")")

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
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $ACTIVATION_FEE : nat, opt \"${KONG_LEDGER}\")"

# Wait 15 seconds before next bet to demonstrate time-weighting
echo "Waiting 15 seconds before next bet..."
sleep 15

# Step 3: Bob places bet on "Yes"
echo -e "\n==== Step 3: Bob placing bet on 'Yes' ===="
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
echo "Bob placing bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat, opt \"${KONG_LEDGER}\")"

# Wait 15 seconds before next bet to demonstrate time-weighting
echo "Waiting 15 seconds before next bet..."
sleep 15

# Step 4: Carol places bet on "Yes"
echo -e "\n==== Step 4: Carol placing bet on 'Yes' ===="
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
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat, opt \"${KONG_LEDGER}\")"

# Wait 15 seconds before next bet to demonstrate time-weighting
echo "Waiting 15 seconds before next bet..."
sleep 15

# Step 5: Dave places bet on "No"
echo -e "\n==== Step 5: Dave placing bet on 'No' ===="
dfx identity use dave
DAVE_PRINCIPAL=$(dfx identity get-principal)
echo "Using Dave's principal: $DAVE_PRINCIPAL"

BET_AMOUNT=10000000000 # 10000 KONG
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
echo "Dave placing bet on 'No'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 1 : nat, $BET_AMOUNT : nat, opt \"${KONG_LEDGER}\")"

# Step 6: Check market bets and status
echo -e "\n==== Step 6: Checking market bets and status ===="
dfx canister call prediction_markets_backend get_market_bets "($MARKET_ID)"
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 7: Fast forwarding time (waiting for market to end)
echo -e "\n==== Step 7: Fast forwarding time (waiting for market to end) ===="
echo "Waiting for market to end (120 seconds)..."
sleep 125

# Check market status after waiting
echo "Checking market status after waiting period..."
MARKET_CHECK=$(dfx canister call prediction_markets_backend get_market "($MARKET_ID)")
echo "$MARKET_CHECK" | grep -A 1 "status ="

# Step 8: Alice (creator) proposes resolution with "Yes" as winner
echo -e "\n==== Step 8: Alice (creator) proposing resolution with 'Yes' as winner ===="
dfx identity use alice
echo "Alice proposing resolution..."
PROPOSE_RESULT=$(dfx canister call prediction_markets_backend propose_resolution "($MARKET_ID, vec { 0 : nat })")
echo "Proposal result: $PROPOSE_RESULT"

# If resolution proposal failed due to market still being open, wait a bit longer
if [[ $PROPOSE_RESULT == *"MarketStillOpen"* ]]; then
    echo "Market is still open, waiting an additional 30 seconds..."
    sleep 30
    echo "Trying resolution proposal again..."
    PROPOSE_RESULT=$(dfx canister call prediction_markets_backend propose_resolution "($MARKET_ID, vec { 0 : nat })")
    echo "Second proposal result: $PROPOSE_RESULT"
fi

# Step 9: Admin approving resolution
echo -e "\n==== Step 9: Admin approving resolution ===="
dfx identity use default
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo "Using Admin's principal: $DEFAULT_PRINCIPAL"
echo "Admin approving resolution..."
RESOLVE_RESULT=$(dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 : nat })")
echo "Resolution result: $RESOLVE_RESULT"

# If resolution failed due to market still being open, wait a bit longer
if [[ $RESOLVE_RESULT == *"MarketStillOpen"* ]]; then
    echo "Market is still open, waiting an additional 30 seconds..."
    sleep 30
    echo "Trying resolution again..."
    RESOLVE_RESULT=$(dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 : nat })")
    echo "Second resolution result: $RESOLVE_RESULT"
fi

# Step 10: Check market status after resolution
echo -e "\n==== Step 10: Checking market status after resolution ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 11: Check user histories to verify payouts
echo -e "\n==== Step 11: Checking user histories to verify payouts ====" 
echo "Alice's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$ALICE_PRINCIPAL\" )"
echo "Bob's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$BOB_PRINCIPAL\" )"
echo "Carol's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$CAROL_PRINCIPAL\" )"
echo "Dave's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$DAVE_PRINCIPAL\" )"

# Step 12: Check market payout records to verify time-weighted payouts
echo -e "\n==== Step 12: Checking market payout records to verify time-weighted payouts ====" 
dfx canister call prediction_markets_backend get_market_payout_records "($MARKET_ID)"

# Step 13: Check for pending claims for each user
echo -e "\n==== Step 13: Checking for pending claims ===="

# Alice's pending claims
echo "Checking Alice's pending claims:"
dfx identity use alice
ALICE_CLAIMS=$(dfx canister call prediction_markets_backend get_user_pending_claims "()")
echo "Alice's pending claims: $ALICE_CLAIMS"

# Bob's pending claims
echo "Checking Bob's pending claims:"
dfx identity use bob
BOB_CLAIMS=$(dfx canister call prediction_markets_backend get_user_pending_claims "()")
echo "Bob's pending claims: $BOB_CLAIMS"

# Carol's pending claims
echo "Checking Carol's pending claims:"
dfx identity use carol
CAROL_CLAIMS=$(dfx canister call prediction_markets_backend get_user_pending_claims "()")
echo "Carol's pending claims: $CAROL_CLAIMS"

# Dave's pending claims
echo "Checking Dave's pending claims:"
dfx identity use dave
DAVE_CLAIMS=$(dfx canister call prediction_markets_backend get_user_pending_claims "()")
echo "Dave's pending claims: $DAVE_CLAIMS"

# Step 12: Claim winnings for each user with pending claims
echo -e "\n==== Step 12: Claiming winnings ===="

# Function to extract claim IDs from pending claims output
extract_claim_ids() {
    local claims=$1
    if [[ $claims == *"vec {}"* ]]; then
        echo "No pending claims found."
        return 1
    fi
    
    # Extract claim_id values
    local claim_ids=$(echo "$claims" | grep -o "claim_id=[0-9]\+" | grep -o "[0-9]\+")
    if [ -z "$claim_ids" ]; then
        echo "No claim IDs found in output."
        return 1
    fi
    
    # Format claim IDs for the claim_winnings call
    local formatted_ids="vec { "
    for id in $claim_ids; do
        formatted_ids+="$id : nat64; "
    done
    formatted_ids+="}"
    echo "$formatted_ids"
    return 0
}

# Claim Alice's winnings
echo "Claiming Alice's winnings:"
dfx identity use alice
ALICE_CLAIM_IDS=$(extract_claim_ids "$ALICE_CLAIMS")
if [ $? -eq 0 ]; then
    echo "Claim IDs: $ALICE_CLAIM_IDS"
    ALICE_CLAIM_RESULT=$(dfx canister call prediction_markets_backend claim_winnings "($ALICE_CLAIM_IDS)")
    echo "Alice's claim result: $ALICE_CLAIM_RESULT"
fi

# Claim Bob's winnings
echo "Claiming Bob's winnings:"
dfx identity use bob
BOB_CLAIM_IDS=$(extract_claim_ids "$BOB_CLAIMS")
if [ $? -eq 0 ]; then
    echo "Claim IDs: $BOB_CLAIM_IDS"
    BOB_CLAIM_RESULT=$(dfx canister call prediction_markets_backend claim_winnings "($BOB_CLAIM_IDS)")
    echo "Bob's claim result: $BOB_CLAIM_RESULT"
fi

# Claim Carol's winnings
echo "Claiming Carol's winnings:"
dfx identity use carol
CAROL_CLAIM_IDS=$(extract_claim_ids "$CAROL_CLAIMS")
if [ $? -eq 0 ]; then
    echo "Claim IDs: $CAROL_CLAIM_IDS"
    CAROL_CLAIM_RESULT=$(dfx canister call prediction_markets_backend claim_winnings "($CAROL_CLAIM_IDS)")
    echo "Carol's claim result: $CAROL_CLAIM_RESULT"
fi

# Check if Dave has any claims (he bet on the losing outcome)
echo "Checking if Dave has any claims:"
dfx identity use dave
DAVE_CLAIM_IDS=$(extract_claim_ids "$DAVE_CLAIMS")
if [ $? -eq 0 ]; then
    echo "Claim IDs: $DAVE_CLAIM_IDS"
    DAVE_CLAIM_RESULT=$(dfx canister call prediction_markets_backend claim_winnings "($DAVE_CLAIM_IDS)")
    echo "Dave's claim result: $DAVE_CLAIM_RESULT"
fi

# Step 13: Check final balances
echo -e "\n==== Step 13: Checking final KONG balances ===="

check_balance() {
    local identity=$1
    dfx identity use $identity
    local principal=$(dfx identity get-principal)
    local balance=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"${principal}\"; })")
    echo "$identity's balance: $balance"
}

check_balance "alice"
check_balance "bob"
check_balance "carol"
check_balance "dave"

echo -e "\n==== Test completed successfully ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 7: Fast forwarding time (waiting for market to end)
echo -e "\n==== Step 7: Fast forwarding time (waiting for market to end) ===="
echo "Waiting for market to end (120 seconds)..."
sleep 125

# Check market status after waiting
echo "Checking market status after waiting period..."
MARKET_CHECK=$(dfx canister call prediction_markets_backend get_market "($MARKET_ID)")
echo "$MARKET_CHECK" | grep -A 1 "status ="

# Step 8: Alice (creator) proposes resolution with "Yes" as winner
echo -e "\n==== Step 8: Alice (creator) proposing resolution with 'Yes' as winner ===="
dfx identity use alice
echo "Alice proposing resolution..."
PROPOSE_RESULT=$(dfx canister call prediction_markets_backend propose_resolution "($MARKET_ID, vec { 0 : nat })")
echo "Proposal result: $PROPOSE_RESULT"

# If resolution proposal failed due to market still being open, wait a bit longer
if [[ $PROPOSE_RESULT == *"MarketStillOpen"* ]]; then
    echo "Market is still open, waiting an additional 30 seconds..."
    sleep 30
    echo "Trying resolution proposal again..."
    PROPOSE_RESULT=$(dfx canister call prediction_markets_backend propose_resolution "($MARKET_ID, vec { 0 : nat })")
    echo "Second proposal result: $PROPOSE_RESULT"
fi

# Step 9: Admin approving resolution
echo -e "\n==== Step 9: Admin approving resolution ===="
dfx identity use default
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo "Using Admin's principal: $DEFAULT_PRINCIPAL"
echo "Admin approving resolution..."
RESOLVE_RESULT=$(dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 : nat })")
echo "Resolution result: $RESOLVE_RESULT"

# If resolution failed due to market still being open, wait a bit longer
if [[ $RESOLVE_RESULT == *"MarketStillOpen"* ]]; then
    echo "Market is still open, waiting an additional 30 seconds..."
    sleep 30
    echo "Trying resolution again..."
    RESOLVE_RESULT=$(dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 : nat })")
    echo "Second resolution result: $RESOLVE_RESULT"
fi

# Step 10: Check market status after resolution
echo -e "\n==== Step 10: Checking market status after resolution ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

echo -e "\n==== Step 11: Checking user histories to verify payouts ====" 
echo "Alice's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$ALICE_PRINCIPAL\" )"
echo "Bob's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$BOB_PRINCIPAL\" )"
echo "Carol's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$CAROL_PRINCIPAL\" )"
echo "Dave's history:"
dfx canister call prediction_markets_backend get_user_history "( principal \"$DAVE_PRINCIPAL\" )"

# Step 12: Check market payout records to verify time-weighted payouts
echo -e "\n==== Step 12: Checking market payout records to verify time-weighted payouts ====" 
dfx canister call prediction_markets_backend get_market_payout_records "($MARKET_ID)"

echo -e "\n==== Test completed successfully ===="
