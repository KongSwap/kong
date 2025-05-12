#!/bin/bash
# test_time_weighting.sh - Tests the time-weighted prediction markets feature

set -e

# Ensure we're using the default identity
dfx identity use default

# Create a new market with time weighting
echo "Creating time-weighted market..."
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ETH price exceed $ 3000 by end of month?\", variant { Crypto }, \"Standard rules\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 300 : nat }, null, opt true, opt 0.1)")

# Extract market ID
MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
echo "Market created with ID: $MARKET_ID"

# Get visualization data
echo "Getting time weight curve..."
dfx canister call prediction_markets_backend generate_time_weight_curve "($MARKET_ID, 10)"

# Place early bet (Alice)
echo "Alice placing early bet..."
dfx identity use alice

# Get canister IDs and setup approval
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now
BET_AMOUNT=100000000

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
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Estimate return now for a bet
echo "Estimating return for a potential bet now..."
CURRENT_TIME=$(date +%s)
dfx canister call prediction_markets_backend estimate_bet_return "($MARKET_ID, 0, 100000000, $CURRENT_TIME)"

# Wait 30 seconds
echo "Waiting 30 seconds..."
sleep 30

# Place middle bet (Bob)
echo "Bob placing mid-time bet..."
dfx identity use bob

# Get canister IDs and setup approval
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now
BET_AMOUNT=100000000

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
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Wait 30 more seconds
echo "Waiting 30 more seconds..."
sleep 30

# Simulate what weight would apply at a future time
echo "Simulating future bet weight..."
BET_TIME=$(date +%s)
FUTURE_TIME=$((BET_TIME + 60))
dfx canister call prediction_markets_backend simulate_future_weight \
  "($MARKET_ID, $BET_TIME, $FUTURE_TIME)"

# Place late bet (Carol)
echo "Carol placing late bet..."
dfx identity use carol

# Get canister IDs and setup approval
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now
BET_AMOUNT=100000000

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
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat)"

# Place incorrect bet (Dave)
echo "Dave placing bet on different outcome..."
dfx identity use dave

# Get canister IDs and setup approval
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now
BET_AMOUNT=150000000

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
dfx canister call prediction_markets_backend place_bet "($MARKET_ID : nat, 1 : nat, $BET_AMOUNT : nat)"

# Get market statistics
echo "Getting market statistics..."
dfx canister call prediction_markets_backend get_stats "()"

# Get market bets
echo "Getting market bets..."
dfx canister call prediction_markets_backend get_market_bets "($MARKET_ID : nat)"

# Wait for market to end
echo "Waiting for market to end..."
sleep 210

# Resolve market
echo "Resolving market..."
dfx identity use default
dfx canister call prediction_markets_backend resolve_via_admin "($MARKET_ID, vec { 0 })"

# Check payout records
echo "Checking payout records..."
dfx canister call prediction_markets_backend get_market_payout_records "($MARKET_ID)"

# Check individual user rewards
echo "Checking market payouts..."
dfx identity use default
dfx canister call prediction_markets_backend get_market_payout_records \
  "($MARKET_ID)"

# Switch to Alice to see her rewards
echo "Checking Alice's rewards..."
dfx identity use alice
dfx canister call prediction_markets_backend get_user_history "(principal \"$(dfx identity get-principal)\")"

# Switch to Bob to see his rewards
echo "Checking Bob's rewards..."
dfx identity use bob
dfx canister call prediction_markets_backend get_user_history "(principal \"$(dfx identity get-principal)\")"

# Switch to Carol to see her rewards
echo "Checking Carol's rewards..."
dfx identity use carol
dfx canister call prediction_markets_backend get_user_history "(principal \"$(dfx identity get-principal)\")"

# Switch to Dave to see his rewards
echo "Checking Dave's rewards..."
dfx identity use dave
dfx canister call prediction_markets_backend get_user_history "(principal \"$(dfx identity get-principal)\")"

# switch back to default identity
dfx identity use default

echo "Test completed!"
