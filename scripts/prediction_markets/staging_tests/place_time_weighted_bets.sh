#!/bin/bash

# Time-Weighted Betting Script for Kong Prediction Markets
# This script demonstrates time weighting by having multiple users place bets at intervals
set -e

# Color definitions for better output formatting
if [ -t 1 ]; then
    TITLE_COLOR=$(tput bold 2>/dev/null && tput setaf 6 2>/dev/null || echo '')
    CMD_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    EXEC_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    RESULT_COLOR=$(tput setaf 4 2>/dev/null || echo '')
    ERROR_COLOR=$(tput setaf 1 2>/dev/null || echo '')
    SUCCESS_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    WARNING_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    RESET=$(tput sgr0 2>/dev/null || echo '')
else
    TITLE_COLOR=''
    CMD_COLOR=''
    EXEC_COLOR=''
    RESULT_COLOR=''
    ERROR_COLOR=''
    SUCCESS_COLOR=''
    WARNING_COLOR=''
    RESET=''
fi

# Constants
PREDICTION_MARKETS_CANISTER="qqoq7-zaaaa-aaaan-qzzvq-cai"
DFX_NETWORK="ic"

# Token configurations  
KONG_LEDGER_ID="o7oak-iyaaa-aaaaq-aadzq-cai"
DKP_LEDGER_ID="zfcdd-tqaaa-aaaaq-aaaga-cai"

# Betting amounts (in base units)
KONG_AMOUNT="500000000"     # 5 KONG (8 decimals)
DKP_AMOUNT="1000000000"     # 10 DKP (8 decimals)

# Helper function to print section headers
section() {
    echo ""
    echo -e "${TITLE_COLOR}===========================================${RESET}"
    echo -e "${TITLE_COLOR}$1${RESET}"
    echo -e "${TITLE_COLOR}===========================================${RESET}"
    echo ""
}

# Helper function to switch dfx identity
switch_identity() {
    local identity_name=$1
    echo -e "${CMD_COLOR}Switching to identity: ${RESET}${RESULT_COLOR}$identity_name${RESET}"
    dfx identity use "$identity_name"
    
    # Verify switch was successful
    local current_identity=$(dfx identity whoami)
    if [ "$current_identity" = "$identity_name" ]; then
        echo -e "${SUCCESS_COLOR}✓ Successfully switched to $identity_name${RESET}"
    else
        echo -e "${ERROR_COLOR}✗ Failed to switch to $identity_name (current: $current_identity)${RESET}"
        exit 1
    fi
}

# Helper function to check user balance
check_balance() {
    local user_name=$1
    local amount_needed=$2
    local token_id=$3
    local token_symbol=$4
    
    echo -e "${CMD_COLOR}   Checking $user_name's $token_symbol balance...${RESET}"
    
    local balance_result=$(dfx canister call "$token_id" icrc1_balance_of "(
      record {
        owner = principal \"$(dfx identity get-principal)\";
        subaccount = null;
      }
    )" --network $DFX_NETWORK 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Extract the balance number from the result (same as get_balances.sh)
        local balance=$(echo "$balance_result" | grep -o '[0-9_]*' | head -1 | tr -d '_')
    else
        local balance="0"
    fi
    
    if [ -z "$balance" ] || [ "$balance" = "0" ]; then
        echo -e "${ERROR_COLOR}   ✗ Could not determine balance for $user_name${RESET}"
        return 1
    fi
    
    echo -e "${CMD_COLOR}   Current balance: ${RESET}${RESULT_COLOR}$balance base units${RESET}"
    echo -e "${CMD_COLOR}   Amount needed: ${RESET}${RESULT_COLOR}$amount_needed base units (including fee)${RESET}"
    
    if [ "$balance" -ge "$amount_needed" ]; then
        echo -e "${SUCCESS_COLOR}   ✓ Sufficient balance for $user_name${RESET}"
        return 0
    else
        local deficit=$((amount_needed - balance))
        echo -e "${ERROR_COLOR}   ✗ Insufficient balance for $user_name${RESET}"
        echo -e "${ERROR_COLOR}   Shortfall: $deficit base units${RESET}"
        return 1
    fi
}

# Helper function to place a bet
place_bet() {
    local user_name=$1
    local market_id=$2
    local outcome_index=$3
    local amount=$4
    local token_id=$5
    local token_symbol=$6
    
    echo -e "${CMD_COLOR}📍 $user_name placing bet...${RESET}"
    echo -e "${CMD_COLOR}   Market ID: ${RESET}${RESULT_COLOR}$market_id${RESET}"
    echo -e "${CMD_COLOR}   Outcome: ${RESET}${RESULT_COLOR}$outcome_index ($([ $outcome_index -eq 0 ] && echo "Yes" || echo "No"))${RESET}"
    echo -e "${CMD_COLOR}   Amount: ${RESET}${RESULT_COLOR}$amount base units ($token_symbol)${RESET}"
    echo -e "${CMD_COLOR}   Time: ${RESET}${RESULT_COLOR}$(date '+%H:%M:%S')${RESET}"
    
    # Step 1: Check balance before proceeding
    local total_approval=$((amount + TOKEN_FEE))
    
    if ! check_balance "$user_name" "$total_approval" "$token_id" "$token_symbol"; then
        echo -e "${ERROR_COLOR}   ✗ $user_name cannot place bet due to insufficient balance${RESET}"
        return 1
    fi
    
    # Step 2: Approve tokens for transfer (amount + transfer fee)
    local current_time_ns=$(date +%s)000000000
    local expires_at=$((current_time_ns + 60000000000))  # 60 seconds from now
    
    echo -e "${CMD_COLOR}   Step 2: Approving $token_symbol tokens...${RESET}"
    echo -e "${CMD_COLOR}   Approval amount: ${RESET}${RESULT_COLOR}$total_approval base units${RESET}"
    
    local approve_result=$(dfx canister call "$token_id" icrc2_approve \
        "(record { 
            amount = $total_approval; 
            expires_at = opt $expires_at; 
            spender = record { 
                owner = principal \"$PREDICTION_MARKETS_CANISTER\"; 
                subaccount = null 
            } 
        })" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}   Approval result: ${RESET}${RESULT_COLOR}$approve_result${RESET}"
    
    # Check if approval was successful
    if [[ $approve_result == *"Ok"* ]]; then
        echo -e "${SUCCESS_COLOR}   ✓ Token approval successful${RESET}"
    else
        echo -e "${ERROR_COLOR}   ✗ Token approval failed: $approve_result${RESET}"
        return 1
    fi
    
    # Step 3: Place the bet
    echo -e "${CMD_COLOR}   Step 3: Placing bet...${RESET}"
    local bet_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER place_bet \
        "($market_id, $outcome_index, $amount, opt \"$token_id\")" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}   Bet result: ${RESET}${RESULT_COLOR}$bet_result${RESET}"
    
    # Check if bet was successful
    if [[ $bet_result == *"Ok"* ]] || [[ $bet_result == *"Success"* ]]; then
        echo -e "${SUCCESS_COLOR}   ✓ $user_name's bet placed successfully!${RESET}"
        return 0
    else
        echo -e "${ERROR_COLOR}   ✗ $user_name's bet failed: $bet_result${RESET}"
        return 1
    fi
}

# Helper function to show market info
show_market_info() {
    local market_id=$1
    echo -e "${CMD_COLOR}Fetching market information...${RESET}"
    
    local market_info=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($market_id)" --network $DFX_NETWORK 2>&1)
    
    if [[ $market_info == *"opt record"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market found${RESET}"
        
        # Extract some key info (simplified parsing)
        if [[ $market_info == *'"question"'* ]]; then
            echo -e "${CMD_COLOR}Market appears to be valid and active${RESET}"
        fi
    else
        echo -e "${ERROR_COLOR}✗ Market not found or invalid${RESET}"
        echo -e "${CMD_COLOR}Response: ${RESET}${ERROR_COLOR}$market_info${RESET}"
        return 1
    fi
}

# Helper function to countdown
countdown() {
    local seconds=$1
    local message=$2
    
    echo -e "${WARNING_COLOR}$message${RESET}"
    for ((i=seconds; i>0; i--)); do
        echo -ne "${WARNING_COLOR}⏱️  Waiting $i seconds...${RESET}\r"
        sleep 1
    done
    echo -e "${WARNING_COLOR}⏱️  Time's up! Proceeding...${RESET}"
}

# Helper function to detect token type and set amounts
detect_token_and_set_amounts() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Detecting market token type...${RESET}"
    local market_info=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($market_id)" --network $DFX_NETWORK 2>&1)
    
    if [[ $market_info == *"$KONG_LEDGER_ID"* ]]; then
        SELECTED_TOKEN="KONG"
        SELECTED_TOKEN_ID=$KONG_LEDGER_ID
        BET_AMOUNT=$KONG_AMOUNT
        echo -e "${SUCCESS_COLOR}✓ Detected KONG market${RESET}"
        
        # Get actual KONG transfer fee
        echo -e "${CMD_COLOR}Getting KONG transfer fee...${RESET}"
        TOKEN_FEE=$(dfx canister call "$KONG_LEDGER_ID" icrc1_fee "()" --network $DFX_NETWORK | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
        TOKEN_FEE=${TOKEN_FEE//_/}  # Remove underscores
        echo -e "${CMD_COLOR}KONG transfer fee: ${RESET}${RESULT_COLOR}$TOKEN_FEE${RESET}"
        
    elif [[ $market_info == *"$DKP_LEDGER_ID"* ]]; then
        SELECTED_TOKEN="DKP"
        SELECTED_TOKEN_ID=$DKP_LEDGER_ID
        BET_AMOUNT=$DKP_AMOUNT
        echo -e "${SUCCESS_COLOR}✓ Detected DKP market${RESET}"
        
        # Get actual DKP transfer fee
        echo -e "${CMD_COLOR}Getting DKP transfer fee...${RESET}"
        TOKEN_FEE=$(dfx canister call "$DKP_LEDGER_ID" icrc1_fee "()" --network $DFX_NETWORK | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
        TOKEN_FEE=${TOKEN_FEE//_/}  # Remove underscores
        echo -e "${CMD_COLOR}DKP transfer fee: ${RESET}${RESULT_COLOR}$TOKEN_FEE${RESET}"
        
    else
        echo -e "${ERROR_COLOR}✗ Could not detect token type from market${RESET}"
        echo -e "${WARNING_COLOR}Defaulting to KONG...${RESET}"
        SELECTED_TOKEN="KONG"
        SELECTED_TOKEN_ID=$KONG_LEDGER_ID
        BET_AMOUNT=$KONG_AMOUNT
        TOKEN_FEE=10000  # Default fallback
    fi
}

# Main script
clear
section "TIME-WEIGHTED BETTING DEMONSTRATION"

# Get market ID from user
echo -e "${CMD_COLOR}Enter the Market ID to place bets on:${RESET}"
read -p "Market ID: " MARKET_ID

# Validate market ID is a number
if ! [[ "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${ERROR_COLOR}Error: Market ID must be a number${RESET}"
    exit 1
fi

section "MARKET VALIDATION"

# Show market info
if ! show_market_info "$MARKET_ID"; then
    echo -e "${ERROR_COLOR}Cannot proceed with invalid market${RESET}"
    exit 1
fi

# Detect token type and set amounts
detect_token_and_set_amounts "$MARKET_ID"

section "BALANCE CHECK"

echo -e "${CMD_COLOR}Checking balances for all participants...${RESET}"
echo ""

# Check balances for all users
for user in alice bob carol dave; do
    echo -e "${CMD_COLOR}Checking $user's balance:${RESET}"
    dfx identity use "$user" > /dev/null 2>&1
    
    user_balance_result=$(dfx canister call "$SELECTED_TOKEN_ID" icrc1_balance_of "(
      record {
        owner = principal \"$(dfx identity get-principal)\";
        subaccount = null;
      }
    )" --network $DFX_NETWORK 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Extract the balance number from the result (same as get_balances.sh)
        user_balance=$(echo "$user_balance_result" | grep -o '[0-9_]*' | head -1 | tr -d '_')
    else
        user_balance="0"
    fi
    
    if [ -n "$user_balance" ]; then
        balance_formatted=$(echo "scale=8; $user_balance / 100000000" | bc)
        echo -e "${CMD_COLOR}  $user: ${RESET}${RESULT_COLOR}$balance_formatted $SELECTED_TOKEN ($user_balance base units)${RESET}"
        
        # Check if user has enough for their planned bet
        needed=$((BET_AMOUNT + TOKEN_FEE))
        
        if [ "$user_balance" -ge "$needed" ]; then
            echo -e "${SUCCESS_COLOR}    ✓ Sufficient balance${RESET}"
        else
            shortfall=$((needed - user_balance))
            echo -e "${ERROR_COLOR}    ✗ Insufficient balance (need $shortfall more base units)${RESET}"
        fi
    else
        echo -e "${ERROR_COLOR}  $user: Could not determine balance${RESET}"
    fi
    echo ""
done

section "BETTING PLAN"

echo -e "${CMD_COLOR}Time-weighted betting sequence planned:${RESET}"
echo -e "${CMD_COLOR}  Token Type: ${RESET}${RESULT_COLOR}$SELECTED_TOKEN${RESET}"
echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}  Transfer Fee: ${RESET}${RESULT_COLOR}$TOKEN_FEE base units${RESET}"
echo ""
echo -e "${CMD_COLOR}Betting Schedule (10-second intervals):${RESET}"
if [ "$SELECTED_TOKEN" = "KONG" ]; then
echo -e "${CMD_COLOR}  1. Alice → 5 $SELECTED_TOKEN on YES (outcome 0)${RESET}"
echo -e "${CMD_COLOR}  2. Bob   → 5 $SELECTED_TOKEN on NO  (outcome 1) [+10s]${RESET}"
    echo -e "${CMD_COLOR}  3. Carol → 5 $SELECTED_TOKEN on YES (outcome 0) [+20s]${RESET}"
    echo -e "${CMD_COLOR}  4. Dave  → 5 $SELECTED_TOKEN on NO  (outcome 1) [+30s]${RESET}"
else
    echo -e "${CMD_COLOR}  1. Alice → 10 $SELECTED_TOKEN on YES (outcome 0)${RESET}"
    echo -e "${CMD_COLOR}  2. Bob   → 10 $SELECTED_TOKEN on NO  (outcome 1) [+10s]${RESET}"
echo -e "${CMD_COLOR}  3. Carol → 10 $SELECTED_TOKEN on YES (outcome 0) [+20s]${RESET}"
    echo -e "${CMD_COLOR}  4. Dave  → 10 $SELECTED_TOKEN on NO  (outcome 1) [+30s]${RESET}"
fi
echo ""
echo -e "${WARNING_COLOR}Note: Earlier bets will receive higher time weights!${RESET}"
echo -e "${WARNING_COLOR}Note: Users with insufficient balance will be skipped.${RESET}"
echo ""

read -p "Proceed with time-weighted betting sequence? (y/N): " -n 1 -r CONFIRM
echo ""

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${WARNING_COLOR}Betting sequence cancelled.${RESET}"
    exit 0
fi

section "EXECUTING TIME-WEIGHTED BETS"

# Store original identity to restore later
ORIGINAL_IDENTITY=$(dfx identity whoami)
echo -e "${CMD_COLOR}Original identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"

# Bet 1: Alice - uniform amount on YES (outcome 0)
echo -e "${TITLE_COLOR}📍 BET 1/4: ALICE${RESET}"
switch_identity "alice"
if place_bet "Alice" "$MARKET_ID" "0" "$BET_AMOUNT" "$SELECTED_TOKEN_ID" "$SELECTED_TOKEN"; then
    ALICE_SUCCESS=true
else
    ALICE_SUCCESS=false
fi

# Wait 10 seconds
countdown 10 "⏱️  Waiting 10 seconds for time weight differentiation..."

# Bet 2: Bob - uniform amount on NO (outcome 1)  
echo -e "${TITLE_COLOR}📍 BET 2/4: BOB${RESET}"
switch_identity "bob"
if place_bet "Bob" "$MARKET_ID" "1" "$BET_AMOUNT" "$SELECTED_TOKEN_ID" "$SELECTED_TOKEN"; then
    BOB_SUCCESS=true
else
    BOB_SUCCESS=false
fi

# Wait 10 seconds
countdown 10 "⏱️  Waiting 10 seconds for time weight differentiation..."

# Bet 3: Carol - uniform amount on YES (outcome 0)
echo -e "${TITLE_COLOR}📍 BET 3/4: CAROL${RESET}"
switch_identity "carol"
if place_bet "Carol" "$MARKET_ID" "0" "$BET_AMOUNT" "$SELECTED_TOKEN_ID" "$SELECTED_TOKEN"; then
    CAROL_SUCCESS=true
else
    CAROL_SUCCESS=false
fi

# Wait 10 seconds
countdown 10 "⏱️  Waiting 10 seconds for time weight differentiation..."

# Bet 4: Dave - uniform amount on NO (outcome 1)
echo -e "${TITLE_COLOR}📍 BET 4/4: DAVE${RESET}"
switch_identity "dave"
if place_bet "Dave" "$MARKET_ID" "1" "$BET_AMOUNT" "$SELECTED_TOKEN_ID" "$SELECTED_TOKEN"; then
    DAVE_SUCCESS=true
else
    DAVE_SUCCESS=false
fi

# Restore original identity (always default for these scripts)
section "RESTORING ORIGINAL IDENTITY"
switch_identity "default"

section "TIME-WEIGHTED BETTING SUMMARY"

echo -e "${CMD_COLOR}Betting Results Summary:${RESET}"
echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}  Token: ${RESET}${RESULT_COLOR}$SELECTED_TOKEN${RESET}"
echo ""

# Show results
if [ "$ALICE_SUCCESS" = true ]; then
    if [ "$SELECTED_TOKEN" = "KONG" ]; then
    echo -e "${SUCCESS_COLOR}  ✓ Alice: 5 $SELECTED_TOKEN on YES (outcome 0) - HIGHEST time weight${RESET}"
    else
        echo -e "${SUCCESS_COLOR}  ✓ Alice: 10 $SELECTED_TOKEN on YES (outcome 0) - HIGHEST time weight${RESET}"
    fi
else
    echo -e "${ERROR_COLOR}  ✗ Alice: FAILED${RESET}"
fi

if [ "$BOB_SUCCESS" = true ]; then
    if [ "$SELECTED_TOKEN" = "KONG" ]; then
    echo -e "${SUCCESS_COLOR}  ✓ Bob: 5 $SELECTED_TOKEN on NO (outcome 1) - HIGH time weight${RESET}"
    else
        echo -e "${SUCCESS_COLOR}  ✓ Bob: 10 $SELECTED_TOKEN on NO (outcome 1) - HIGH time weight${RESET}"
    fi
else
    echo -e "${ERROR_COLOR}  ✗ Bob: FAILED${RESET}"
fi

if [ "$CAROL_SUCCESS" = true ]; then
    if [ "$SELECTED_TOKEN" = "KONG" ]; then
        echo -e "${SUCCESS_COLOR}  ✓ Carol: 5 $SELECTED_TOKEN on YES (outcome 0) - MEDIUM time weight${RESET}"
    else
    echo -e "${SUCCESS_COLOR}  ✓ Carol: 10 $SELECTED_TOKEN on YES (outcome 0) - MEDIUM time weight${RESET}"
    fi
else
    echo -e "${ERROR_COLOR}  ✗ Carol: FAILED${RESET}"
fi

if [ "$DAVE_SUCCESS" = true ]; then
    if [ "$SELECTED_TOKEN" = "KONG" ]; then
    echo -e "${SUCCESS_COLOR}  ✓ Dave: 5 $SELECTED_TOKEN on NO (outcome 1) - LOWEST time weight${RESET}"
    else
        echo -e "${SUCCESS_COLOR}  ✓ Dave: 10 $SELECTED_TOKEN on NO (outcome 1) - LOWEST time weight${RESET}"
    fi
else
    echo -e "${ERROR_COLOR}  ✗ Dave: FAILED${RESET}"
fi

echo ""
echo -e "${CMD_COLOR}Time Weight Impact:${RESET}"
echo -e "${CMD_COLOR}  • Alice (earliest) will get the highest multiplier${RESET}"
echo -e "${CMD_COLOR}  • Dave (latest) will get the lowest multiplier${RESET}"
echo -e "${CMD_COLOR}  • This demonstrates early-bird advantage in time-weighted markets${RESET}"
echo ""

echo -e "${CMD_COLOR}Next Steps:${RESET}"
echo -e "${CMD_COLOR}  • Wait for market to close (2 minutes from creation)${RESET}"
echo -e "${CMD_COLOR}  • Use resolve_market.sh to resolve the market${RESET}"
echo -e "${CMD_COLOR}  • Check payout distribution to see time weight effects${RESET}"
echo ""

# Show current market bets
echo -e "${CMD_COLOR}Fetching current market bets...${RESET}"
MARKET_BETS=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market_bets "($MARKET_ID)" --network $DFX_NETWORK 2>&1)
echo -e "${CMD_COLOR}Market bets: ${RESET}${RESULT_COLOR}$MARKET_BETS${RESET}"

exit 0 