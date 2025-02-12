#!/bin/bash

# Constants for bet amounts (in e8s)
KONG_BET=10000000000
DEFAULT_BET=30000000000
USER1_BET=70000000000
USER2_BET=40000000000

# Print initial balances
echo "Initial balances:"
echo "--------------------------------------------------------"
./get_balance.sh
echo "--------------------------------------------------------"

# Create a new market
# Create market as default user
echo "Creating a new market as default user..."
dfx identity use default
./create_market.sh
echo "--------------------------------------------------------"

# Place bets
echo "Placing bets..."

echo "Kong bets 100 on KONG (0)"
dfx identity use kong
./place_bet.sh 0 0 $KONG_BET

echo "Default bets 300 on BOB (1)"
dfx identity use default
./place_bet.sh 0 1 $DEFAULT_BET

echo "User1 bets 700 on BOB (1)"
dfx identity use kong_user1
./place_bet.sh 0 1 $USER1_BET

echo "User2 bets 400 on KONG (0)"
dfx identity use kong_user2
./place_bet.sh 0 0 $USER2_BET

echo "--------------------------------------------------------"

# Switch back to sns_proposal for admin operations
echo "Switching identity back to sns_proposal..."
dfx identity use sns_proposal

# Show market bets
echo "Market bets summary:"
./get_market_bets.sh 0

# Show balances after betting
echo "Balances after betting:"
echo "--------------------------------------------------------"
./get_balance.sh
echo "--------------------------------------------------------"

# Calculate and display pool information
total_pool=$((KONG_BET + DEFAULT_BET + USER1_BET + USER2_BET))
kong_pool=$((KONG_BET + USER2_BET))
bob_pool=$((DEFAULT_BET + USER1_BET))

echo "Pool Information:"
echo "Total pool: $((total_pool/100000000)) KONG ($total_pool e8s)"
echo "KONG pool: $((kong_pool/100000000)) KONG ($kong_pool e8s)"
echo "BOB pool: $((bob_pool/100000000)) KONG ($bob_pool e8s)"
echo "--------------------------------------------------------"

# Wait for market end
echo "Waiting 60 seconds for market to end..."
sleep 60

# Resolve market - KONG wins
echo "Resolving market - KONG wins (outcome 0)"
dfx identity use default
./resolve_market.sh 0 0

# Show final balances
echo "Final balances:"
echo "--------------------------------------------------------"
./get_balance.sh
echo "--------------------------------------------------------"

# Calculate expected winnings
echo "Expected Winnings (e8s):"
echo "KONG winners:"
kong_expected=$((KONG_BET + (KONG_BET * bob_pool / kong_pool)))
user2_expected=$((USER2_BET + (USER2_BET * bob_pool / kong_pool)))
echo "Kong: $kong_expected"
echo "User2: $user2_expected"

echo "BOB losers:"
echo "Default: 0 (lost $DEFAULT_BET)"
echo "User1: 0 (lost $USER1_BET)"

# Show fee balance
echo "Fee balance:"
./get_fee_balance.sh

echo "Testing sequence completed."