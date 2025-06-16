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

# Step 2: Alice never activates the market
section "Step 2: Alice never activating the market"
echo -e "${CMD_COLOR}Alice never activating the market...${RESET}"

# Step 3: Admin uses void_market to void the market
section "Step 3: Admin using void_market to void the market"

run_dfx "dfx identity use default" "Switching to default (admin) identity"
run_dfx "DEFAULT_PRINCIPAL=\$(dfx identity get-principal)" "Getting Admin's principal"
DEFAULT_PRINCIPAL=$(dfx identity get-principal)
echo -e "${CMD_COLOR}Admin using  void_market to void the market...${RESET}"
run_dfx "dfx canister call prediction_markets_backend void_market \"(\$MARKET_ID)\"" "Admin using void_market to void the market"

# Step 4: Checking market status after resolution
section "Step 4: Checking market status after resolution"

run_dfx "dfx canister call prediction_markets_backend get_market \"(\$MARKET_ID)\"" "Getting market details after resolution"

# Step 5: Checking market resolution details
section "Step 5: Checking market resolution details"
run_dfx "dfx identity use default" "Switching to default (admin) identity"
run_dfx "dfx canister call prediction_markets_backend get_market_resolution_details \"(\$MARKET_ID)\"" "Getting resolution details for market"

echo -e "${TITLE_COLOR}==== Test Complete ====${RESET}"
echo -e "${CMD_COLOR}The dual resolution market test has completed successfully!${RESET}"
echo ""
