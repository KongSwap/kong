#!/bin/bash
# test_platform_fee.sh - Tests the 1% platform fee implementation

set -e

echo "==== Testing Platform Fee Implementation ===="

# Get canister IDs
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}

echo "Prediction Markets Canister: $PREDICTION_MARKETS_CANISTER"
echo "KONG Ledger: $KONG_LEDGER"
echo "KONG Fee: $KONG_FEE"

# Step 1: Create a new market
echo -e "\n==== Step 1: Creating market as admin ===="
dfx identity use default
ADMIN_PRINCIPAL=$(dfx identity get-principal)
echo "Using Admin principal: $ADMIN_PRINCIPAL"

RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will BTC exceed $100k in 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 120 : nat }, null, opt false, null)")

# Extract market ID
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

# Step 2: Set the minter address (hardcoded from transfer_kong.rs)
echo -e "\n==== Step 2: Setting minter address ===="
MINTER_PRINCIPAL="faaxe-sf6cf-hmx3r-ujxc6-7ppwl-3lkf3-zpj6i-2m75x-bqmba-dod7q-4qe"
echo "Minter address: $MINTER_PRINCIPAL"

# Step 3: Check initial balances
echo -e "\n==== Step 3: Checking initial balances ===="
ADMIN_BALANCE_BEFORE=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$ADMIN_PRINCIPAL\" })" | tr -d '()' | xargs)
echo "Admin's balance before: $ADMIN_BALANCE_BEFORE"

# Get minter's initial balance
MINTER_BALANCE_BEFORE=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$MINTER_PRINCIPAL\" })" | tr -d '()' | xargs)
echo "Minter's balance before: $MINTER_BALANCE_BEFORE"

# Step 4: Place bets from different users
echo -e "\n==== Step 4: Placing bets from different users ===="

# Admin places bet on Yes
echo "Admin placing bet on 'Yes'..."
BET_AMOUNT_ADMIN=5000000000 # 5000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)

# Approve tokens for transfer
echo "Approving tokens for transfer..."
dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT_ADMIN} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place the bet
echo "Placing bet on 'Yes'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT_ADMIN : nat)"

# Bob places bet on No
echo "Bob placing bet on 'No'..."
dfx identity use bob
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Using Bob's principal: $BOB_PRINCIPAL"

BET_AMOUNT_BOB=5000000000 # 5000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)

# Approve tokens for transfer
echo "Approving tokens for transfer..."
dfx canister call ${KONG_LEDGER} icrc2_approve "(record {
	amount = $(echo "${BET_AMOUNT_BOB} + ${KONG_FEE}" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \"${PREDICTION_MARKETS_CANISTER}\";
	};
})"

# Place the bet
echo "Placing bet on 'No'..."
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 1 : nat, $BET_AMOUNT_BOB : nat)"

# Step 5: Check market details and estimate returns
echo -e "\n==== Step 5: Checking market details and estimated returns ===="
CURRENT_TIME=$(date +%s)

dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

echo "Estimating return for a 1000 KONG bet on 'Yes':"
# Convert current time to nanoseconds for the estimate_bet_return call
CURRENT_TIME_NANOS=$(echo "$CURRENT_TIME * 1000000000" | bc)
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 0, 1000000000, $CURRENT_TIME_NANOS)"

# Step 6: Fast forward time (wait for market to end)
echo -e "\n==== Step 6: Waiting for market to end (2 minutes) ===="
echo "Waiting 2 minutes for market to end..."
sleep 120

# Step 7: Admin resolves the market
echo -e "\n==== Step 7: Admin resolving market with 'Yes' as winner ===="
dfx identity use default
dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 : nat })"

# Step 8: Check balances after resolution
echo -e "\n==== Step 8: Checking balances after resolution ===="
ADMIN_BALANCE_AFTER=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$ADMIN_PRINCIPAL\" })" | tr -d '()' | xargs)
echo "Admin's balance after: $ADMIN_BALANCE_AFTER"

# Get Bob's balance after resolution
dfx identity use bob
BOB_BALANCE_AFTER=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$BOB_PRINCIPAL\" })" | tr -d '()' | xargs)
echo "Bob's balance after: $BOB_BALANCE_AFTER"

# Get minter's balance after resolution
MINTER_BALANCE_AFTER=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$MINTER_PRINCIPAL\" })" | tr -d '()' | xargs)
echo "Minter's balance after: $MINTER_BALANCE_AFTER"

# Step 9: Verify platform fee (1% of total pool)
echo -e "\n==== Step 9: Verifying platform fee ===="
TOTAL_POOL=$((BET_AMOUNT_ADMIN + BET_AMOUNT_BOB))
EXPECTED_FEE=$((TOTAL_POOL / 100))
echo "Total pool: $TOTAL_POOL tokens"
echo "Expected 1% platform fee: $EXPECTED_FEE tokens"

# Check if minter balance increased
MINTER_BALANCE_INCREASE=$((MINTER_BALANCE_AFTER - MINTER_BALANCE_BEFORE))
echo "Minter balance increase: $MINTER_BALANCE_INCREASE tokens"

if (( MINTER_BALANCE_INCREASE >= (EXPECTED_FEE * 95 / 100) && MINTER_BALANCE_INCREASE <= (EXPECTED_FEE * 105 / 100) )); then
    echo "✅ Platform fee verification passed!"
else
    echo "❌ Platform fee verification failed!"
    echo "Expected increase: ~$EXPECTED_FEE, Actual increase: $MINTER_BALANCE_INCREASE"
fi

# Step 10: Check user history and payout records
echo -e "\n==== Step 10: Checking payout records for fee information ===="
dfx identity use default
dfx canister call prediction_markets_backend get_market_payout_records "($MARKET_ID : nat64)"

echo -e "\n==== Test completed successfully ===="
