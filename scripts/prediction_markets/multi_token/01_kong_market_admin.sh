#!/bin/bash

# Test script for creating an admin market with KONG tokens
# and having multiple users place bets on different outcomes

# Set up variables
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kong_ledger)
KONG_TOKEN_ID=$(dfx canister id kong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}

# Set up identities for different users
ALICE_IDENTITY="alice"
BOB_IDENTITY="bob"
CAROL_IDENTITY="carol"
DAVE_IDENTITY="dave"

echo "=== Testing KONG Admin Market with Multiple Users ==="
echo "Prediction Markets Canister: ${PREDICTION_MARKETS_CANISTER}"
echo "KONG Ledger: ${KONG_LEDGER}"
echo "KONG Fee: ${KONG_FEE}"

# Step 1: Create a market using KONG token (as admin)
echo "Creating a new market with KONG tokens as admin..."
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ETH reach $ 5,000 by the end of 2025?\", variant { Crypto }, \
  \"Prediction on Ethereum price. Market resolves YES if ETH reaches $ 5,000 on any major exchange before the end of 2025.\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 120 : nat }, null, null, null, \
  opt \"o7oak-iyaaa-aaaaq-aadzq-cai\")")

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

# Step 2: Place bets with different users
# First, make sure all users have KONG tokens (this assumes you've already set up these identities)

# Set a standard bet amount for all users
BET_AMOUNT=10000000000  # 100 KONG

# Alice bets 100 KONG on "Yes" (outcome 0)
echo "Alice placing bet..."
place_bet "${ALICE_IDENTITY}" "${MARKET_ID}" 0 ${BET_AMOUNT} "${KONG_TOKEN_ID}" "${KONG_LEDGER}" "${KONG_FEE}"

# Wait 10 seconds before next bet
echo "Waiting 10 seconds before next bet..."
sleep 10

# Bob bets 100 KONG on "No" (outcome 1)
echo "Bob placing bet..."
place_bet "${BOB_IDENTITY}" "${MARKET_ID}" 1 ${BET_AMOUNT} "${KONG_TOKEN_ID}" "${KONG_LEDGER}" "${KONG_FEE}"

# Wait 10 seconds before next bet
echo "Waiting 10 seconds before next bet..."
sleep 10

# Carol bets 100 KONG on "Yes" (outcome 0)
echo "Carol placing bet..."
place_bet "${CAROL_IDENTITY}" "${MARKET_ID}" 0 ${BET_AMOUNT} "${KONG_TOKEN_ID}" "${KONG_LEDGER}" "${KONG_FEE}"

# Wait 10 seconds before next bet
echo "Waiting 10 seconds before next bet..."
sleep 10

# Dave bets 100 KONG on "No" (outcome 1)
echo "Dave placing bet..."
place_bet "${DAVE_IDENTITY}" "${MARKET_ID}" 1 ${BET_AMOUNT} "${KONG_TOKEN_ID}" "${KONG_LEDGER}" "${KONG_FEE}"

# Switch back to default identity
dfx identity use default

# Step 3: Get market status to verify bets were placed
echo "Checking market status..."
dfx canister call prediction_markets_backend get_market "(${MARKET_ID})"

# Step 4: Get all bets for the market
echo "Getting all bets for market ${MARKET_ID}..."
dfx canister call prediction_markets_backend get_market_bets "(${MARKET_ID})"

# Wait for market to close (120 seconds from creation)
echo "Waiting for market to close (120 seconds total)..."
echo "This will take approximately 90 more seconds from now..."
sleep 90

# Step 5: Resolve the market as admin (choosing "Yes" as the winning outcome)
echo "Resolving market as admin with 'Yes' as the winning outcome..."
dfx canister call prediction_markets_backend resolve_via_admin "(${MARKET_ID}, vec { 0 })" | tee /tmp/market_resolution.log

# Extract transaction IDs from the logs
echo "\nTransaction IDs:"
grep -o "Transaction ID: [0-9]\+" /tmp/dfx.log | tail -3 | while read -r line; do
  tx_id=$(echo "$line" | awk '{print $3}')
  echo "- $tx_id"
done

# Step 6: Check user histories to see payouts
echo "Checking user histories for payouts..."

# Check Alice's history (bet on winning outcome)
dfx identity use ${ALICE_IDENTITY}
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo "Alice's payout history:"
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${ALICE_PRINCIPAL}\"
)"

# Check Bob's history (bet on losing outcome)
dfx identity use ${BOB_IDENTITY}
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Bob's payout history:"
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${BOB_PRINCIPAL}\"
)"

# Check Carol's history (bet on winning outcome)
dfx identity use ${CAROL_IDENTITY}
CAROL_PRINCIPAL=$(dfx identity get-principal)
echo "Carol's payout history:"
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${CAROL_PRINCIPAL}\"
)"

# Check Dave's history (bet on losing outcome)
dfx identity use ${DAVE_IDENTITY}
DAVE_PRINCIPAL=$(dfx identity get-principal)
echo "Dave's payout history:"
dfx canister call prediction_markets_backend get_user_history "(
  principal \"${DAVE_PRINCIPAL}\"
)"

# Switch back to default identity
dfx identity use default

# Get payout information directly from the canister
echo "Getting payout information from canister..."

# Get Alice's payout information
dfx identity use ${ALICE_IDENTITY}
ALICE_HISTORY=$(dfx canister call prediction_markets_backend get_user_history "(principal \"${ALICE_PRINCIPAL}\")")
ALICE_WINNINGS=$(echo "$ALICE_HISTORY" | grep -o "winnings = opt [0-9]\+" | awk '{print $NF}' | head -1)

# Get Carol's payout information
dfx identity use ${CAROL_IDENTITY}
CAROL_HISTORY=$(dfx canister call prediction_markets_backend get_user_history "(principal \"${CAROL_PRINCIPAL}\")")
CAROL_WINNINGS=$(echo "$CAROL_HISTORY" | grep -o "winnings = opt [0-9]\+" | awk '{print $NF}' | head -1)

# Convert to KONG units (divide by 10^8)
if [ ! -z "$ALICE_WINNINGS" ]; then
    ALICE_PAYOUT_KONG=$(echo "scale=2; $ALICE_WINNINGS / 100000000" | bc)
else
    ALICE_PAYOUT_KONG="N/A"
fi

if [ ! -z "$CAROL_WINNINGS" ]; then
    CAROL_PAYOUT_KONG=$(echo "scale=2; $CAROL_WINNINGS / 100000000" | bc)
else
    CAROL_PAYOUT_KONG="N/A"
fi

# Get market details to check time-weighting
dfx identity use default
MARKET_DETAILS=$(dfx canister call prediction_markets_backend get_market "(${MARKET_ID})")
USES_TIME_WEIGHTING=$(echo "$MARKET_DETAILS" | grep -o "uses_time_weighting = [a-z]\+" | awk -F '= ' '{print $2}')

echo "=== KONG Admin Market Test Complete ==="
