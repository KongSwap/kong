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

# Wait 15 seconds before next bet to demonstrate time-weighting
echo -e "${CMD_COLOR}Waiting 15 seconds before next bet for time-weighting demonstration...${RESET}"
sleep 2

# Step 3: Bob places bet on "Yes"
section "Step 3: Bob placing bet on 'Yes'"

run_dfx "dfx identity use bob" "Switching to Bob identity"
run_dfx "BOB_PRINCIPAL=\$(dfx identity get-principal)" "Getting Bob's principal"
BOB_PRINCIPAL=$(dfx identity get-principal)

BET_AMOUNT=300000000000 # 3'000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo -e "${CMD_COLOR}Approving tokens for transfer...${RESET}"
run_dfx "dfx canister call \${KONG_LEDGER} icrc2_approve \"(record {
	amount = \$(echo \"\${BET_AMOUNT} + \${KONG_FEE}\" | bc);
	expires_at = opt \${EXPIRES_AT};
	spender = record {
		owner = principal \\\"\${PREDICTION_MARKETS_CANISTER}\\\";
	};
})\"" "Approving token transfer"

# Place bet
echo -e "${CMD_COLOR}Bob placing bet on 'Yes'...${RESET}"
run_dfx "dfx canister call prediction_markets_backend place_bet \"(\$MARKET_ID : nat, 0 : nat, \$BET_AMOUNT : nat, opt \\\"\${KONG_LEDGER}\\\")\"" "Placing bet"

# Wait 15 seconds before next bet to demonstrate time-weighting
echo -e "${CMD_COLOR}Waiting 15 seconds before next bet...${RESET}"
sleep 2

# Step 4: Carol places bet on "Yes"
section "Step 4: Carol placing bet on 'Yes'"

run_dfx "dfx identity use carol" "Switching to Carol identity"
run_dfx "CAROL_PRINCIPAL=\$(dfx identity get-principal)" "Getting Carol's principal"
CAROL_PRINCIPAL=$(dfx identity get-principal)

BET_AMOUNT=300000000000 # 3'000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo -e "${CMD_COLOR}Approving tokens for transfer...${RESET}"
run_dfx "dfx canister call \${KONG_LEDGER} icrc2_approve \"(record {
	amount = \$(echo \"\${BET_AMOUNT} + \${KONG_FEE}\" | bc);
	expires_at = opt \${EXPIRES_AT};
	spender = record {
		owner = principal \\\"\${PREDICTION_MARKETS_CANISTER}\\\";
	};
})\"" "Approving token transfer"

# Place bet
echo -e "${CMD_COLOR}Carol placing bet on 'Yes'...${RESET}"
run_dfx "dfx canister call prediction_markets_backend place_bet \"(\$MARKET_ID : nat, 0 : nat, \$BET_AMOUNT : nat, opt \\\"\${KONG_LEDGER}\\\")\"" "Placing bet"

# Wait 15 seconds before next bet to demonstrate time-weighting
echo -e "${CMD_COLOR}Waiting 15 seconds before next bet...${RESET}"
sleep 2

# Step 5: Dave places bet on "No"
section "Step 5: Dave placing bet on 'No'"

run_dfx "dfx identity use dave" "Switching to Dave identity"
run_dfx "DAVE_PRINCIPAL=\$(dfx identity get-principal)" "Getting Dave's principal"
DAVE_PRINCIPAL=$(dfx identity get-principal)

BET_AMOUNT=100000000000 # 10'000 KONG
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # approval expires 60 seconds from now

# Approve tokens for transfer
echo -e "${CMD_COLOR}Approving tokens for transfer...${RESET}"
run_dfx "dfx canister call \${KONG_LEDGER} icrc2_approve \"(record {
	amount = \$(echo \"\${BET_AMOUNT} + \${KONG_FEE}\" | bc);
	expires_at = opt \${EXPIRES_AT};
	spender = record {
		owner = principal \\\"\${PREDICTION_MARKETS_CANISTER}\\\";
	};
})\"" "Approving token transfer"

# Place bet
echo -e "${CMD_COLOR}Dave placing bet on 'No'...${RESET}"
run_dfx "dfx canister call prediction_markets_backend place_bet \"(\$MARKET_ID : nat, 1 : nat, \$BET_AMOUNT : nat, opt \\\"\${KONG_LEDGER}\\\")\"" "Placing bet"

# Step 6: Check market bets and status
section "Step 6: Checking market bets and status"

run_dfx "dfx canister call prediction_markets_backend get_market_bets \"(\$MARKET_ID)\"" "Getting all bets for market"
run_dfx "dfx canister call prediction_markets_backend get_market \"(\$MARKET_ID)\"" "Getting market details"


echo -e "${TITLE_COLOR}==== Test Complete ====${RESET}"
echo -e "${CMD_COLOR}The dual resolution market test has completed successfully!${RESET}"
echo ""
