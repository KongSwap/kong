#!/bin/bash

# Test script for testing resolution disagreement with multi-token support
# This demonstrates how the system handles disagreements between creator and admin
# and ensures that token-specific activation fees are properly burned

# Set up variables
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KSUSDT_LEDGER=$(dfx canister id ksusdt_ledger)
KSUSDT_TOKEN_ID="v56tl-sp777-77774-qaahq-cai"
KSUSDT_FEE=$(dfx canister call ${KSUSDT_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KSUSDT_FEE=${KSUSDT_FEE//_/}

# Set up identities for different users
ALICE_IDENTITY="alice"
BOB_IDENTITY="bob"
CAROL_IDENTITY="carol"

echo "=== Testing Resolution Disagreement with Multi-Token Support ==="
echo "Prediction Markets Canister: ${PREDICTION_MARKETS_CANISTER}"
echo "ksUSDT Ledger: ${KSUSDT_LEDGER}"
echo "ksUSDT Fee: ${KSUSDT_FEE}"

# Function to place a bet with a specific identity
place_bet() {
    local identity=$1
    local market_id=$2
    local outcome_index=$3
    local amount=$4
    local token_id=$5
    local token_ledger=$6
    local token_fee=$7
    
    echo "Placing bet as ${identity} on outcome ${outcome_index} with ${amount} tokens..."
    
    # Switch to the user's identity
    dfx identity use ${identity}
    
    # Get the current identity principal
    USER_PRINCIPAL=$(dfx identity get-principal)
    echo "${identity}'s principal: ${USER_PRINCIPAL}"
    
    # Approve tokens for transfer
    EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 600000000000" | bc)  # approval expires 600 seconds from now
    
    echo "Approving tokens for transfer..."
    dfx canister call ${token_ledger} icrc2_approve "(record {
        amount = $(echo "${amount} + ${token_fee}" | bc);
        expires_at = opt ${EXPIRES_AT};
        spender = record {
            owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
        };
    })"
    
    echo "Placing bet of ${amount} on outcome ${outcome_index} for market ${market_id}..."
    dfx canister call prediction_markets_backend place_bet "(${market_id}, ${outcome_index}, ${amount}, opt \"${token_id}\")"
}

# Step 1: Create a market using ksICP token (as Alice - a regular user)
# Switch to Alice's identity
dfx identity use ${ALICE_IDENTITY}
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo "Creating market as Alice (${ALICE_PRINCIPAL})..."

# The activation threshold for ksUSDT is 100 USDT (100000000 with 6 decimals)
ACTIVATION_AMOUNT=150000000

echo "Creating a new market with ksUSDT tokens as user..."
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ETH reach $ 10,000 by the end of 2025?\", variant { Crypto }, \
  \"Prediction on Ethereum price. Market resolves YES if ETH reaches $ 10,000 on any major exchange before the end of 2025.\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 120 : nat }, null, null, null, \
  opt \"${KSUSDT_TOKEN_ID}\")")

# Extract market ID and check for success
if [[ $RESULT == *"Ok"* ]]; then
    MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
    echo "Market created with ID: $MARKET_ID"
    
    # Verify market exists
    echo "Verifying market exists..."
    MARKET_CHECK=$(dfx canister call prediction_markets_backend get_market "($MARKET_ID)")
    if [[ $MARKET_CHECK == "(null)" ]]; then
        echo "ERROR: Market not found after creation."
        exit 1
    else
        echo "Market verified successfully."
    fi
else
    echo "ERROR: Failed to create market"
    echo "$RESULT"
    exit 1
fi

echo "Created market with ID: ${MARKET_ID}"

# Set a standard bet amount for all users (after activation)
STANDARD_BET=10000000  # 10 ksUSDT

# Step 2: Alice places the activation bet (25 ksUSDT) on "Yes" (outcome 0)
# This will activate the market since it meets the minimum activation threshold for ksUSDT
echo "Alice placing activation bet..."
place_bet "${ALICE_IDENTITY}" "${MARKET_ID}" 0 ${ACTIVATION_AMOUNT} "${KSUSDT_TOKEN_ID}" "${KSUSDT_LEDGER}" "${KSUSDT_FEE}"

# Wait 10 seconds before next bet
echo "Waiting 10 seconds before next bet..."
sleep 10

# Step 3: Other users place bets
# Bob bets 10 ksUSDT on "No" (outcome 1)
echo "Bob placing bet..."
place_bet "${BOB_IDENTITY}" "${MARKET_ID}" 1 ${STANDARD_BET} "${KSUSDT_TOKEN_ID}" "${KSUSDT_LEDGER}" "${KSUSDT_FEE}"

# Wait 10 seconds before next bet
echo "Waiting 10 seconds before next bet..."
sleep 10

# Carol bets 10 ksUSDT on "Yes" (outcome 0)
echo "Carol placing bet..."
place_bet "${CAROL_IDENTITY}" "${MARKET_ID}" 0 ${STANDARD_BET} "${KSUSDT_TOKEN_ID}" "${KSUSDT_LEDGER}" "${KSUSDT_FEE}"

# Step 4: Get market status to verify bets were placed
echo "Checking market status..."
dfx identity use default
dfx canister call prediction_markets_backend get_market "(${MARKET_ID})"

# Step 5: Get all bets for the market
echo "Getting all bets for market ${MARKET_ID}..."
dfx canister call prediction_markets_backend get_market_bets "(${MARKET_ID})"

# Step 6: Create resolution disagreement
# Wait for market to close (120 seconds from creation plus a buffer)
echo "Waiting for market to close (120 seconds total plus buffer)..."
echo "This will take approximately 130 seconds from now..."
sleep 120

# First, Alice (creator) proposes resolution with "Yes" as winning outcome
dfx identity use ${ALICE_IDENTITY}
echo "Alice (creator) proposes resolution with 'Yes' as winning outcome..."
dfx canister call prediction_markets_backend propose_resolution "(${MARKET_ID}, vec { 0 })"

# Then, admin proposes a different resolution ("No" as winning outcome)
echo "Admin proposing different resolution with 'No' as winning outcome..."
dfx identity use default
dfx canister call prediction_markets_backend resolve_via_admin "(
  ${MARKET_ID},
  vec { 1 }
)" | tee /tmp/market_resolution.log

# Extract transaction IDs from the logs
echo "\nTransaction IDs (refunds and burn):"
grep -o "Transaction ID: [0-9]\+" /tmp/dfx.log | tail -3 | while read -r line; do
  tx_id=$(echo "$line" | awk '{print $3}')
  echo "- $tx_id"
done

# Step 7: Check market status to verify it was voided
echo "Checking market status after resolution disagreement..."
dfx canister call prediction_markets_backend get_all_markets "(record {
  status_filter = null;
  start = 0;
  length = 10;
  sort_option = null;
})" | grep -A 30 "id = ${MARKET_ID} : nat"

# Step 8: Check user histories to verify refunds
echo "Checking user histories for refunds..."

# Check Alice's history (creator - should lose activation deposit)
dfx identity use ${ALICE_IDENTITY}
echo "Alice's history (should show activation deposit burned):"
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${ALICE_PRINCIPAL}\"
)"

# Check Bob's history (should be refunded)
dfx identity use ${BOB_IDENTITY}
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Bob's history (should show refund):"
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${BOB_PRINCIPAL}\"
)"

# Check Carol's history (should be refunded)
dfx identity use ${CAROL_IDENTITY}
CAROL_PRINCIPAL=$(dfx identity get-principal)
echo "Carol's history (should show refund):"
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${CAROL_PRINCIPAL}\"
)"

# Switch back to default identity
dfx identity use default

# Get market status directly from the canister
echo "Getting market status from canister..."
MARKET_DETAILS=$(dfx canister call prediction_markets_backend get_market "(${MARKET_ID})")
MARKET_STATUS=$(echo "$MARKET_DETAILS" | grep -o "status = variant { [A-Za-z]\+ }" | awk '{print $NF}' | tr -d '}')

# Get user histories to check for refunds
# Get Bob's history to check for refunds
dfx identity use ${BOB_IDENTITY}
BOB_HISTORY=$(dfx canister call prediction_markets_backend get_user_history "(principal \"${BOB_PRINCIPAL}\")")
BOB_REFUNDED=$(echo "$BOB_HISTORY" | grep -c "resolved_bets = vec {")
BOB_BET_AMOUNT=1000000000  # 10 ksICP standard bet

# Get Carol's history to check for refunds
dfx identity use ${CAROL_IDENTITY}
CAROL_HISTORY=$(dfx canister call prediction_markets_backend get_user_history "(principal \"${CAROL_PRINCIPAL}\")")
CAROL_REFUNDED=$(echo "$CAROL_HISTORY" | grep -c "resolved_bets = vec {")
CAROL_BET_AMOUNT=1000000000  # 10 ksICP standard bet

# Get Alice's history to check for burned activation deposit
dfx identity use ${ALICE_IDENTITY}
ALICE_HISTORY=$(dfx canister call prediction_markets_backend get_user_history "(principal \"${ALICE_PRINCIPAL}\")")
ALICE_DEPOSIT_BURNED=$(echo "$ALICE_HISTORY" | grep -c "active_bets = vec {}")

# Convert to ksICP units
BOB_REFUND_KSICP="10.00"
CAROL_REFUND_KSICP="10.00"
BURNED_KSICP="25.00"  # Alice's activation deposit

echo "=== Resolution Disagreement Test Complete ==="
