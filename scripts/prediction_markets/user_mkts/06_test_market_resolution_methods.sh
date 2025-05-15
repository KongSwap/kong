#!/bin/bash
# 06_test_market_resolution_methods.sh - Tests that users can only create markets with admin resolution

set -e

echo "==== Testing Market Resolution Method Restrictions ===="

# Get canister IDs
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)
KONG_LEDGER=$(dfx canister id kskong_ledger)

echo "Prediction Markets Canister: $PREDICTION_MARKETS_CANISTER"
echo "KONG Ledger: $KONG_LEDGER"

# Step 1: Try to create a market with Oracle resolution as a regular user (Alice)
echo -e "\n==== Step 1: Trying to create a market with Oracle resolution as regular user (Alice) ===="
dfx identity use alice
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo "Using Alice's principal: $ALICE_PRINCIPAL"

echo "Attempting to create market with Oracle resolution (should fail)..."
# Create a set of oracle principals
ORACLE_PRINCIPAL=$(dfx identity get-principal)
ADMIN_PRINCIPAL=$(dfx identity use default && dfx identity get-principal)
dfx identity use alice

# Try to create market with Oracle resolution
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will DOT reach $30 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Oracle = record { oracle_principals = vec { principal \"$ORACLE_PRINCIPAL\"; principal \"$ADMIN_PRINCIPAL\" }; required_confirmations = 1 : nat } }, \
  variant { Duration = 300 : nat }, null, null, null, \
  opt \"${KONG_LEDGER}\")")

echo "Result: $RESULT"

# Step 2: Create a market with Admin resolution as a regular user (Alice)
echo -e "\n==== Step 2: Creating a market with Admin resolution as regular user (Alice) ===="
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will DOT reach $30 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 300 : nat }, null, null, null, \
  opt \"${KONG_LEDGER}\")")

# Extract market ID
MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
echo "Market created with ID: $MARKET_ID"

# Step 3: Check market status (should be Pending)
echo -e "\n==== Step 3: Checking market status (should be Pending) ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID)"

# Step 4: Create a market with Oracle resolution as admin (default)
echo -e "\n==== Step 4: Creating a market with Oracle resolution as admin (default) ===="
dfx identity use default
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo "Using Admin's principal: $DEFAULT_PRINCIPAL"

# Create market with Oracle resolution
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ATOM reach $20 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Oracle = record { oracle_principals = vec { principal \"$ALICE_PRINCIPAL\"; principal \"$DEFAULT_PRINCIPAL\" }; required_confirmations = 1 : nat } }, \
  variant { Duration = 300 : nat }, null, null, null, \
  opt \"${KONG_LEDGER}\")")

# Extract market ID
MARKET_ID_ADMIN=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
echo "Market created with ID: $MARKET_ID_ADMIN"

# Step 5: Check admin-created market status (should be Active)
echo -e "\n==== Step 5: Checking admin-created market status (should be Active) ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID_ADMIN)"

# Step 6: Try to create a market with Decentralized resolution as a regular user (Bob)
echo -e "\n==== Step 6: Trying to create a market with Decentralized resolution as regular user (Bob) ===="
dfx identity use bob
BOB_PRINCIPAL=$(dfx identity get-principal)
echo "Using Bob's principal: $BOB_PRINCIPAL"

echo "Attempting to create market with Decentralized resolution (should fail)..."
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ALGO reach $5 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Decentralized = record { quorum = 100000 : nat } }, \
  variant { Duration = 300 : nat }, null, null, null, \
  opt \"${KONG_LEDGER}\")")


echo "Result: $RESULT"

# Step 7: Create a market with Decentralized resolution as admin (default)
echo -e "\n==== Step 7: Creating a market with Decentralized resolution as admin (default) ===="
dfx identity use default
echo "Using Admin's principal: $DEFAULT_PRINCIPAL"

# Create market with Decentralized resolution
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ALGO reach $5 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Decentralized = record { quorum = 100000 : nat } }, \
  variant { Duration = 300 : nat }, null, null, null, \
  opt \"${KONG_LEDGER}\")")


# Extract market ID
MARKET_ID_ADMIN2=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
echo "Market created with ID: $MARKET_ID_ADMIN2"

# Step 8: Check admin-created market status (should be Active)
echo -e "\n==== Step 8: Checking admin-created market status (should be Active) ===="
dfx canister call prediction_markets_backend get_market "($MARKET_ID_ADMIN2)"

echo -e "\n==== Test completed successfully ===="
