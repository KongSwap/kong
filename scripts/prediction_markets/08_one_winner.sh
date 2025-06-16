#!/bin/bash
# Enhanced prediction markets test script with colorized output
# This script clearly distinguishes between commands and canister responses

# Color definitions using tput (more reliable across different terminals)
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

section "Testing User-Created Markets with Enhanced Output"

# Get canister IDs
run_dfx "PREDICTION_MARKETS_CANISTER=\$(dfx canister id prediction_markets_backend)" "Getting prediction markets canister ID"
PREDICTION_MARKETS_CANISTER=$(dfx canister id prediction_markets_backend)

run_dfx "KONG_LEDGER=\$(dfx canister id kskong_ledger)" "Getting KONG ledger canister ID"
KONG_LEDGER=$(dfx canister id kskong_ledger)

run_dfx "KONG_FEE=\$(dfx canister call \${KONG_LEDGER} icrc1_fee \"()\" | awk -F'[:]+' '{print \$1}' | awk '{gsub(/\(/, \"\"); print}')" "Getting KONG transaction fee"
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}

ACTIVATION_FEE=300000000000 # 3000 KONG, token has decimal precision 8

echo -e "${CMD_COLOR}Using the following configuration:${RESET}"
echo -e "${CMD_COLOR}• Prediction Markets Canister: ${RESET}${RESULT_COLOR}$PREDICTION_MARKETS_CANISTER${RESET}"
echo -e "${CMD_COLOR}• KONG Ledger: ${RESET}${RESULT_COLOR}$KONG_LEDGER${RESET}"
echo -e "${CMD_COLOR}• KONG Fee: ${RESET}${RESULT_COLOR}$KONG_FEE${RESET}"
echo -e "${CMD_COLOR}• Activation Fee: ${RESET}${RESULT_COLOR}$ACTIVATION_FEE${RESET}"
echo ""

# Step 1: Create a new market as a regular user (Alice)
section "Step 1: Creating market as regular user (Alice)"

run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "ALICE_PRINCIPAL=\$(dfx identity get-principal)" "Getting Alice's principal"
ALICE_PRINCIPAL=$(dfx identity get-principal)

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

# Step 2: Alice places activation bet (3000 KONG) on "Yes"
section "Step 2: Alice placing activation bet (3000 KONG) on 'Yes'"

EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo -e "${CMD_COLOR}Approving tokens for transfer...${RESET}"
run_dfx "dfx canister call \${KONG_LEDGER} icrc2_approve \"(record {
	amount = \$(echo \"\${ACTIVATION_FEE} + \${KONG_FEE}\" | bc);
	expires_at = opt \${EXPIRES_AT};
	spender = record {
		owner = principal \\\"\${PREDICTION_MARKETS_CANISTER}\\\";
	};
})\"" "Approving token transfer"

# Place activation bet
echo -e "${CMD_COLOR}Alice placing activation bet on 'Yes'...${RESET}"
run_dfx "dfx canister call prediction_markets_backend place_bet \"(\$MARKET_ID : nat, 0 : nat, \$ACTIVATION_FEE : nat, opt \\\"\${KONG_LEDGER}\\\")\"" "Placing bet"

# -------------------------------------------------------------

# Step 6: Check market bets and status
section "Step 6: Checking market bets and status"

run_dfx "dfx canister call prediction_markets_backend get_market_bets \"(\$MARKET_ID)\"" "Getting all bets for market"
run_dfx "dfx canister call prediction_markets_backend get_market \"(\$MARKET_ID)\"" "Getting market details"

# Step 7: Fast forward time (waiting for market to end)
section "Step 7: Fast forward time (waiting for market to end)"

echo -e "${CMD_COLOR}Waiting for market to end (120 seconds)...${RESET}"
echo -ne "${EXEC_COLOR}▌${RESET}"
for i in {1..60}; do
    sleep 2
    echo -ne "${EXEC_COLOR}▌${RESET}"
done
echo -e "\n${CMD_COLOR}Market duration has passed.${RESET}"
echo ""

# Check if market has expired
run_dfx "dfx canister call prediction_markets_backend get_market \"(\$MARKET_ID)\"" "Checking market status after waiting period"

# -------------------------------------------------------------

# Step 8: Alice (creator) proposes resolution with "Yes" as winner
section "Step 8: Alice (creator) proposing resolution with 'Yes' as winner"

run_dfx "dfx identity use alice" "Switching back to Alice identity (market creator)"
echo -e "${CMD_COLOR}Alice proposing resolution...${RESET}"
run_dfx "dfx canister call prediction_markets_backend propose_resolution \"(\$MARKET_ID, vec { 0 : nat })\"" "Proposing market resolution with Yes as winner"

# Step 9: Admin approving resolution
section "Step 9: Admin approving resolution"

run_dfx "dfx identity use default" "Switching to default (admin) identity"
run_dfx "DEFAULT_PRINCIPAL=\$(dfx identity get-principal)" "Getting Admin's principal"
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo -e "${CMD_COLOR}Admin approving resolution...${RESET}"
run_dfx "dfx canister call prediction_markets_backend resolve_via_admin \"(\$MARKET_ID, vec { 0 : nat })\"" "Admin confirming resolution"

# Step 10: Checking market status after resolution
section "Step 10: Checking market status after resolution"

run_dfx "dfx canister call prediction_markets_backend get_market \"(\$MARKET_ID)\"" "Getting market details after resolution"

# Step 11: Checking market resolution details
section "Step 11: Checking market resolution details"
run_dfx "dfx identity use default" "Switching to default (admin) identity"
run_dfx "dfx canister call prediction_markets_backend get_market_resolution_details \"(\$MARKET_ID)\"" "Getting resolution details for market"

# Step 12: Checking market payout records to verify time-weighted payouts
section "Step 12: Checking market payout records to verify time-weighted payouts"

run_dfx "dfx canister call prediction_markets_backend get_market_payout_records \"(\$MARKET_ID)\"" "Getting payout records for market"

# Step 13: Checking for pending claims for each user
section "Step 13: Checking for pending claims"

# Alice's pending claims
run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "dfx canister call prediction_markets_backend get_user_pending_claims \"()\"" "Checking Alice's pending claims"

# Step 14: Claiming winnings for users with pending claims
section "Step 14: Claiming winnings"

# Function to extract claim IDs from pending claims output and claim them
claim_winnings() {
    local user=$1
    echo -e "${CMD_COLOR}Switching to $user identity${RESET}"
    dfx identity use $user
    
    echo -e "${CMD_COLOR}Checking pending claims for $user...${RESET}"
    local claims=$(dfx canister call prediction_markets_backend get_user_pending_claims "()")
    echo -e "${RESULT_COLOR}${claims}${RESET}"
    
    # Extract claim IDs - this is a simple extraction that may need to be adjusted based on actual output format
    if [[ $claims == *"claim_id ="* ]]; then
        echo -e "${CMD_COLOR}Found pending claims for $user, attempting to claim...${RESET}"
        local claim_ids=$(echo "$claims" | grep -o "claim_id = [0-9]\+" | awk '{print $3}')
        
        # Create the vec argument for claiming
        local claim_vec="vec {"
        for id in $claim_ids; do
            claim_vec="$claim_vec $id;"
        done
        claim_vec="$claim_vec }"
        
        run_dfx "dfx canister call prediction_markets_backend claim_winnings \"($claim_vec)\"" "Claiming winnings for $user"
    else
        echo -e "${CMD_COLOR}No pending claims found for $user${RESET}"
    fi
}

# Try to claim for each user who placed a bet on the winning side
claim_winnings "alice"

# Verify claims were processed by checking history again
section "Step 14: Verifying claims were processed"

run_dfx "dfx identity use alice" "Switching to Alice identity"
run_dfx "dfx canister call prediction_markets_backend get_user_pending_claims \"()\"" "Checking if Alice has any remaining pending claims"

echo -e "${TITLE_COLOR}==== Test Complete ====${RESET}"
echo -e "${CMD_COLOR}The dual resolution market test has completed successfully!${RESET}"
echo ""
