#!/bin/bash

# Double Spend Test Script for Kong Swap Prediction Markets
# This script tests the protection against double-spending of claims by attempting to
# process the same claim multiple times simultaneously.

# Color definitions for output formatting
TITLE_COLOR=$(tput bold; tput setaf 6)   # Bold Cyan for section titles
CMD_COLOR=$(tput setaf 2)                # Green for commands/descriptions
EXEC_COLOR=$(tput setaf 3)               # Yellow for executed commands  
RESULT_COLOR=$(tput setaf 4)             # Blue for results/responses
ERROR_COLOR=$(tput setaf 1)              # Red for errors
RESET=$(tput sgr0)                       # Reset color

# Helper function to print section titles
section() {
  echo -e "${TITLE_COLOR}==== $1 ====${RESET}"
}

# Helper function to run a dfx command and display the result with proper formatting
run_dfx() {
  local cmd=$1
  local desc=$2
  
  # Print command description if provided
  if [ -n "$desc" ]; then
    echo -e "${CMD_COLOR}$desc${RESET}"
  fi
  
  # Print the command being executed
  echo -e "${EXEC_COLOR}$ $cmd${RESET}"
  
  # Execute and capture the result
  local result
  if result=$(eval "$cmd" 2>&1); then
    # Print the result
    echo -e "${RESULT_COLOR}${result}${RESET}"
    echo ""
    return 0
  else
    # Print error
    echo -e "${ERROR_COLOR}ERROR: Command failed!${RESET}"
    echo -e "${ERROR_COLOR}${result}${RESET}"
    echo ""
    return 1
  fi
}

# Catch errors
set -e

section "Double Spend Vulnerability Test for Kong Swap Prediction Markets"
echo -e "${CMD_COLOR}This script tests the protection against double-spending of claims.${RESET}"
echo -e "${CMD_COLOR}It attempts to process the same claim multiple times to verify the vulnerability is fixed.${RESET}"
echo ""

# Get canister IDs
run_dfx "PREDICTION_MARKETS_CANISTER=\$(dfx canister id prediction_markets_backend)" "Getting prediction markets canister ID"
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)

run_dfx "KONG_LEDGER=\$(dfx canister id kskong_ledger)" "Getting KONG ledger canister ID"
KONG_LEDGER=$(dfx canister id kskong_ledger)

run_dfx "KONG_FEE=\$(dfx canister call \${KONG_LEDGER} icrc1_fee \"()\" | awk -F'[:]+' '{print \$1}' | awk '{gsub(/\(/, \"\"); print}')" "Getting KONG transaction fee"
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}

# Set bet amount and activation fee
BET_AMOUNT=10000000000 # 100 KONG, token has 8 decimal places
ACTIVATION_FEE=300000000000 # 3000 KONG

echo -e "${CMD_COLOR}Using the following configuration:${RESET}"
echo -e "${CMD_COLOR}• Prediction Markets Canister: ${RESET}${RESULT_COLOR}$PREDICTION_MARKETS_CANISTER${RESET}"
echo -e "${CMD_COLOR}• KONG Ledger: ${RESET}${RESULT_COLOR}$KONG_LEDGER${RESET}"
echo -e "${CMD_COLOR}• KONG Fee: ${RESET}${RESULT_COLOR}$KONG_FEE${RESET}"
echo -e "${CMD_COLOR}• Bet Amount: ${RESET}${RESULT_COLOR}$BET_AMOUNT (100 KONG)${RESET}"
echo -e "${CMD_COLOR}• Activation Fee: ${RESET}${RESULT_COLOR}$ACTIVATION_FEE (3000 KONG)${RESET}"
echo ""

# Step 1: Create a new market as admin
section "Step 1: Creating market as admin"

run_dfx "dfx identity use default" "Switching to default (admin) identity"
run_dfx "ADMIN_PRINCIPAL=\$(dfx identity get-principal)" "Getting Admin's principal"
ADMIN_PRINCIPAL=$(dfx identity get-principal)

echo -e "${CMD_COLOR}Creating a new prediction market...${RESET}"
run_dfx "dfx canister call prediction_markets_backend create_market \
  \"(\\\"Will ETH price exceed \$ 5000 by end of 2025?\\\", variant { Crypto }, \\\"Standard rules apply\\\", \
  vec { \\\"Yes\\\"; \\\"No\\\" }, variant { Admin }, \
  variant { Duration = 120 : nat }, null, opt true, opt 0.1, \
  opt \\\"\${KONG_LEDGER}\\\")\"" "Creating market with time-weighted rewards"

# Extract market ID and check for success
RESULT=$(dfx canister call prediction_markets_backend create_market \
  "(\"Will ETH price exceed \$ 5000 by end of 2025?\", variant { Crypto }, \"Standard rules apply\", \
  vec { \"Yes\"; \"No\" }, variant { Admin }, \
  variant { Duration = 120 : nat }, null, opt true, opt 0.1, \
  opt \"${KONG_LEDGER}\")")

if [[ $RESULT == *"Ok"* ]]; then
    MARKET_ID=$(echo $RESULT | grep -o '[0-9]\+' | head -1)
    echo -e "${CMD_COLOR}Market created with ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
    
    # Verify market exists
    echo -e "${CMD_COLOR}Verifying market exists...${RESET}"
    run_dfx "dfx canister call prediction_markets_backend get_market \"($MARKET_ID)\"" "Checking market details"
else
    echo -e "${ERROR_COLOR}ERROR: Failed to create market${RESET}"
    echo -e "${ERROR_COLOR}${RESULT}${RESET}"
    exit 1
fi

# Step 2: Setup test users and mint KONG tokens
section "Step 2: Setting up test users and minting KONG tokens"

# Create/switch to Alice identity
run_dfx "dfx identity new --disable-encryption alice || true" "Creating Alice identity if not exists"
run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "ALICE_PRINCIPAL=\$(dfx identity get-principal)" "Getting Alice's principal"
ALICE_PRINCIPAL=$(dfx identity get-principal)

# Create/switch to Bob identity
run_dfx "dfx identity new --disable-encryption bob || true" "Creating Bob identity if not exists"
run_dfx "dfx identity use bob" "Switching to Bob identity"
run_dfx "BOB_PRINCIPAL=\$(dfx identity get-principal)" "Getting Bob's principal"
BOB_PRINCIPAL=$(dfx identity get-principal)

# Mint KONG tokens for Alice and Bob
run_dfx "dfx identity use default" "Switching to default (admin) identity for minting tokens"
run_dfx "dfx canister call $KONG_LEDGER icrc1_transfer '(record { to = record { owner = principal \"$ALICE_PRINCIPAL\" }; amount = 1_000_000_000_000 })'" "Minting 10,000 KONG tokens for Alice"
run_dfx "dfx canister call $KONG_LEDGER icrc1_transfer '(record { to = record { owner = principal \"$BOB_PRINCIPAL\" }; amount = 1_000_000_000_000 })'" "Minting 10,000 KONG tokens for Bob"

# Check balances
run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "dfx canister call $KONG_LEDGER icrc1_balance_of '(record { owner = principal \"$ALICE_PRINCIPAL\" })'" "Checking Alice's KONG balance"
run_dfx "dfx identity use bob" "Switching to Bob identity"
run_dfx "dfx canister call $KONG_LEDGER icrc1_balance_of '(record { owner = principal \"$BOB_PRINCIPAL\" })'" "Checking Bob's KONG balance"

# Step 3: Alice and Bob place bets on the market
section "Step 3: Placing bets on the market"

# Alice bets on "Yes"
run_dfx "dfx identity use alice" "Switching to Alice identity"

# Approve tokens for Alice's bet
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now
echo -e "${CMD_COLOR}Approving tokens for Alice's bet...${RESET}"
run_dfx "dfx canister call ${KONG_LEDGER} icrc2_approve \"(record {
	amount = \$(echo \"${BET_AMOUNT} + ${KONG_FEE}\" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \\\"${PREDICTION_MARKETS_CANISTER}\\\";
	};
})\"" "Approving token transfer for Alice"

# Alice places bet on "Yes"
echo -e "${CMD_COLOR}Alice placing bet on 'Yes'...${RESET}"
run_dfx "dfx canister call prediction_markets_backend place_bet \"($MARKET_ID : nat, 0 : nat, $BET_AMOUNT : nat, opt \\\"${KONG_LEDGER}\\\")\"" "Alice betting on Yes (outcome 0)"

# Wait 10 seconds to demonstrate time-weighted rewards
echo -e "${CMD_COLOR}Waiting 10 seconds before Bob places bet...${RESET}"
for i in {1..10}; do
    sleep 1
    echo -ne "${EXEC_COLOR}▌${RESET}"
done
echo ""

# Bob bets on "No"
run_dfx "dfx identity use bob" "Switching to Bob identity"

# Approve tokens for Bob's bet
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now
echo -e "${CMD_COLOR}Approving tokens for Bob's bet...${RESET}"
run_dfx "dfx canister call ${KONG_LEDGER} icrc2_approve \"(record {
	amount = \$(echo \"${BET_AMOUNT} + ${KONG_FEE}\" | bc);
	expires_at = opt ${EXPIRES_AT};
	spender = record {
		owner = principal \\\"${PREDICTION_MARKETS_CANISTER}\\\";
	};
})\"" "Approving token transfer for Bob"

# Bob places bet on "No"
echo -e "${CMD_COLOR}Bob placing bet on 'No'...${RESET}"
run_dfx "dfx canister call prediction_markets_backend place_bet \"($MARKET_ID : nat, 1 : nat, $BET_AMOUNT : nat, opt \\\"${KONG_LEDGER}\\\")\"" "Bob betting on No (outcome 1)"

# Check market status after bets
run_dfx "dfx canister call prediction_markets_backend get_market \"($MARKET_ID)\"" "Checking market status after bets"

# Step 4: Wait for market duration to pass
section "Step 4: Waiting for market duration to pass"

echo -e "${CMD_COLOR}Waiting for market duration (120 seconds) to pass...${RESET}"
for i in {1..12}; do
    sleep 10
    echo -ne "${EXEC_COLOR}▌${RESET}"
done
echo -e "\n${CMD_COLOR}Market duration has passed.${RESET}"
echo ""

# Check if market has expired
run_dfx "dfx canister call prediction_markets_backend get_market \"($MARKET_ID)\"" "Checking market status after waiting period"

# Step 5: Admin resolves the market with "Yes" as winner
section "Step 5: Admin resolving market with 'Yes' as winner"

run_dfx "dfx identity use default" "Switching to admin identity"
echo -e "${CMD_COLOR}Admin resolving market...${RESET}"
run_dfx "dfx canister call prediction_markets_backend resolve_via_admin \"($MARKET_ID, vec { 0 : nat })\"" "Admin resolving with Yes as winner"

# Step 6: Check for Alice's pending claim (she bet on Yes)
section "Step 6: Checking for Alice's pending claim"

run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "dfx canister call prediction_markets_backend get_user_pending_claims \"()\"" "Checking Alice's pending claims"

# Extract Alice's claim ID
ALICE_CLAIMS=$(dfx canister call prediction_markets_backend get_user_pending_claims "()")
ALICE_CLAIM_ID=$(echo "$ALICE_CLAIMS" | grep -o "claim_id = [0-9]\+" | head -1 | awk '{print $3}')

if [[ -z "$ALICE_CLAIM_ID" ]]; then
    echo -e "${ERROR_COLOR}ERROR: Alice has no pending claims. Test cannot continue.${RESET}"
    exit 1
else
    echo -e "${CMD_COLOR}Found Alice's claim ID: ${RESET}${RESULT_COLOR}$ALICE_CLAIM_ID${RESET}"
fi

# Step 7: Check Alice's initial balance
section "Step 7: Checking Alice's initial balance"

run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "dfx canister call $KONG_LEDGER icrc1_balance_of '(record { owner = principal \"$ALICE_PRINCIPAL\" })'" "Checking Alice's initial KONG balance"
INITIAL_BALANCE=$(dfx canister call $KONG_LEDGER icrc1_balance_of "(record { owner = principal \"$ALICE_PRINCIPAL\" })" | grep -o '[0-9_]\+' | tr -d '_')
echo -e "${CMD_COLOR}Alice's initial balance: ${RESET}${RESULT_COLOR}$INITIAL_BALANCE${RESET}"

# Step 8: Double spend attempt - Process Alice's claim multiple times
section "Step 8: Double Spend Test - Processing Alice's claim multiple times"

echo -e "${CMD_COLOR}Attempting to process Alice's claim multiple times in quick succession...${RESET}"

# First processing (should succeed)
run_dfx "dfx canister call prediction_markets_backend claim_winnings \"(vec { $ALICE_CLAIM_ID; })\"" "First attempt to process Alice's claim"

# Second processing (should fail if vulnerability is fixed)
run_dfx "dfx canister call prediction_markets_backend claim_winnings \"(vec { $ALICE_CLAIM_ID; })\"" "Second attempt to process Alice's claim"

# Third processing (should also fail)
run_dfx "dfx canister call prediction_markets_backend claim_winnings \"(vec { $ALICE_CLAIM_ID; })\"" "Third attempt to process Alice's claim"

# Step 9: Check Alice's final balance
section "Step 9: Checking Alice's final balance"

run_dfx "dfx canister call $KONG_LEDGER icrc1_balance_of '(record { owner = principal \"$ALICE_PRINCIPAL\" })'" "Checking Alice's final KONG balance"
FINAL_BALANCE=$(dfx canister call $KONG_LEDGER icrc1_balance_of "(record { owner = principal \"$ALICE_PRINCIPAL\" })" | grep -o '[0-9_]\+' | tr -d '_')
echo -e "${CMD_COLOR}Alice's final balance: ${RESET}${RESULT_COLOR}$FINAL_BALANCE${RESET}"

# Calculate the amount received
RECEIVED=$((FINAL_BALANCE - INITIAL_BALANCE))
echo -e "${CMD_COLOR}Alice received: ${RESET}${RESULT_COLOR}$RECEIVED${RESET}"

# Step 10: Check claim status to verify it was processed only once
section "Step 10: Verifying claim status"

# Check Alice's claims (should no longer be pending if processed successfully)
run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "dfx canister call prediction_markets_backend get_user_claims \"()\"" "Checking Alice's processed claims"

# Check if the specific claim has the correct status
run_dfx "dfx canister call prediction_markets_backend get_claim_by_id \"($ALICE_CLAIM_ID)\"" "Checking status of claim ID $ALICE_CLAIM_ID"

# Get overall claims statistics
run_dfx "dfx canister call prediction_markets_backend get_claims_stats \"()\"" "Getting claims statistics"

# Final summary of the test
section "Double Spend Test Summary"

echo -e "${CMD_COLOR}Test Results:${RESET}"
echo -e "${CMD_COLOR}• If the claim was processed only once, you should see:${RESET}"
echo -e "  - First claim processing: ${RESULT_COLOR}Success${RESET}"
echo -e "  - Subsequent attempts: ${RESULT_COLOR}Failure with 'Claim is not in pending state' error${RESET}"
echo -e "  - Alice's balance increased by only the expected amount${RESET}"
echo ""
echo -e "${CMD_COLOR}• If the double-spend vulnerability persists, you would see:${RESET}"
echo -e "  - Multiple successful claim processings${RESET}"
echo -e "  - Alice's balance increased by multiples of the expected amount${RESET}"
echo ""
echo -e "${CMD_COLOR}Check the above outputs to verify the double-spend protection is working correctly.${RESET}"
