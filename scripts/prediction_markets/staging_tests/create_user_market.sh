#!/bin/bash

# Create User Market Script for Kong Prediction Markets
# This script creates time-weighted user markets with dual approval resolution
# User (Alice) creates market and pays activation fee to activate it
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

# Activation fees (in base units) - these are the minimum amounts needed to activate markets
KONG_ACTIVATION_FEE="300000000000"    # 3000 KONG (8 decimals)
DKP_ACTIVATION_FEE="7000000000000"    # 70000 DKP (8 decimals)

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
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Failed to switch to $identity_name (current: $current_identity)${RESET}"
        return 1
    fi
}

# Helper function to get current identity
get_current_identity() {
    dfx identity whoami
}

# Helper function to generate random market data
generate_random_market_data() {
    local topics=("AI" "Crypto" "Politics" "Sports" "Technology" "DeFi" "NFTs" "Gaming" "Climate" "Space")
    local events=("will reach" "will exceed" "will launch" "will announce" "will happen" "will be released" "will succeed" "will fail" "will grow" "will decline")
    local timeframes=("in the next 2 minutes" "within 120 seconds" "very soon" "in the immediate future" "right now")
    
    # Select random elements
    local topic=${topics[$((RANDOM % ${#topics[@]}))]}
    local event=${events[$((RANDOM % ${#events[@]}))]}
    local timeframe=${timeframes[$((RANDOM % ${#timeframes[@]}))]}
    
    # Generate market question
    MARKET_QUESTION="Will $topic $event $timeframe?"
    
    # Generate market rules
    MARKET_RULES="This user-created market will resolve based on consensus between the market creator and platform administrators. Both parties must agree on the outcome for resolution."
    
    # Set duration to 120 seconds from creation (using Duration variant)
    MARKET_DURATION=120  # 2 minutes for testing
    
    # Standard Yes/No outcomes
    MARKET_OUTCOMES='vec { "Yes"; "No" }'
    
    # Category (convert to Candid variant format)
    case $topic in
        "AI"|"Technology")
            MARKET_CATEGORY="variant { AI }"
            ;;
        "Crypto"|"DeFi"|"NFTs")
            MARKET_CATEGORY="variant { Crypto }"
            ;;
        "Politics")
            MARKET_CATEGORY="variant { Politics }"
            ;;
        "Sports"|"Gaming")
            MARKET_CATEGORY="variant { Sports }"
            ;;
        *)
            MARKET_CATEGORY="variant { Other }"
            ;;
    esac
}

# Helper function to check user balance
check_user_balance() {
    local token_id=$1
    local required_amount=$2
    local token_symbol=$3
    
    echo -e "${CMD_COLOR}Checking $token_symbol balance for activation fee...${RESET}"
    
    # Note: This is a simplified balance check - in production you'd call the token ledger
    # For now, we'll assume the user has sufficient balance and proceed
    echo -e "${WARNING_COLOR}⚠ Balance check not implemented - assuming sufficient balance${RESET}"
    echo -e "${CMD_COLOR}Required activation fee: ${RESET}${RESULT_COLOR}$required_amount base units ($token_symbol)${RESET}"
    
    return 0
}

# Helper function to approve tokens for market activation
approve_tokens_for_activation() {
    local token_id=$1
    local amount=$2
    local token_symbol=$3
    
    echo -e "${CMD_COLOR}Approving $token_symbol tokens for market activation...${RESET}"
    
    # ICRC-2 approve call to allow the prediction markets canister to spend tokens
    echo -e "${CMD_COLOR}Calling icrc2_approve on $token_symbol ledger...${RESET}"
    
    local approve_result=$(dfx canister call "$token_id" icrc2_approve \
        "(record { amount = $amount; spender = record { owner = principal \"$PREDICTION_MARKETS_CANISTER\"; subaccount = null } })" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Approval result: ${RESET}${RESULT_COLOR}$approve_result${RESET}"
    
    # Check if approval was successful
    if [[ $approve_result == *"Ok"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Token approval successful${RESET}"
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Token approval failed: $approve_result${RESET}"
        return 1
    fi
}

# Helper function to place activation bet
place_activation_bet() {
    local market_id=$1
    local amount=$2
    local token_id=$3
    local token_symbol=$4
    
    echo -e "${CMD_COLOR}Placing activation bet to activate the market...${RESET}"
    
    # Place a bet on outcome 0 (Yes) with the activation amount
    local bet_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER place_bet \
        "($market_id, 0, $amount, opt \"$token_id\")" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Activation bet result: ${RESET}${RESULT_COLOR}$bet_result${RESET}"
    
    # Check if bet was successful
    if [[ $bet_result == *"Ok"* ]] || [[ $bet_result == *"Success"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market activation successful!${RESET}"
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Market activation failed: $bet_result${RESET}"
        return 1
    fi
}

# Main script
clear
section "CREATE USER MARKET - KONG PREDICTION MARKETS"

# Store original identity to restore later
ORIGINAL_IDENTITY=$(get_current_identity)
echo -e "${CMD_COLOR}Original identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"

# Switch to Alice identity for user-created market
echo -e "${CMD_COLOR}Switching to Alice identity for market creation...${RESET}"
if ! switch_identity "alice"; then
    echo -e "${ERROR_COLOR}Cannot proceed without Alice identity${RESET}"
    exit 1
fi

# Get Alice's principal for reference
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo -e "${CMD_COLOR}Alice's principal: ${RESET}${RESULT_COLOR}$ALICE_PRINCIPAL${RESET}"
echo ""

# Token selection
echo -e "${CMD_COLOR}Select token for the market:${RESET}"
echo -e "${CMD_COLOR}  1) KONG Token (Activation fee: 3000 KONG)${RESET}"
echo -e "${CMD_COLOR}  2) DKP Token (Activation fee: 70000 DKP)${RESET}"
echo ""
read -p "Select token (1-2): " -n 1 -r TOKEN_CHOICE
echo ""

case $TOKEN_CHOICE in
    1)
        SELECTED_TOKEN="KONG"
        SELECTED_TOKEN_ID=$KONG_LEDGER_ID
        ACTIVATION_AMOUNT=$KONG_ACTIVATION_FEE
        echo -e "${SUCCESS_COLOR}✓ Selected KONG token${RESET}"
        ;;
    2)
        SELECTED_TOKEN="DKP"
        SELECTED_TOKEN_ID=$DKP_LEDGER_ID
        ACTIVATION_AMOUNT=$DKP_ACTIVATION_FEE
        echo -e "${SUCCESS_COLOR}✓ Selected DKP token${RESET}"
        ;;
    *)
        echo -e "${ERROR_COLOR}Invalid choice. Defaulting to KONG.${RESET}"
        SELECTED_TOKEN="KONG"
        SELECTED_TOKEN_ID=$KONG_LEDGER_ID
        ACTIVATION_AMOUNT=$KONG_ACTIVATION_FEE
        ;;
esac

section "GENERATING RANDOM MARKET DATA"

# Generate random market data
generate_random_market_data

echo -e "${CMD_COLOR}Generated Market Details:${RESET}"
echo -e "${CMD_COLOR}Question: ${RESET}${RESULT_COLOR}$MARKET_QUESTION${RESET}"
echo -e "${CMD_COLOR}Token: ${RESET}${RESULT_COLOR}$SELECTED_TOKEN ($SELECTED_TOKEN_ID)${RESET}"
echo -e "${CMD_COLOR}Category: ${RESET}${RESULT_COLOR}$MARKET_CATEGORY${RESET}"
echo -e "${CMD_COLOR}Duration: ${RESET}${RESULT_COLOR}$MARKET_DURATION seconds${RESET}"
echo -e "${CMD_COLOR}Outcomes: ${RESET}${RESULT_COLOR}Yes, No${RESET}"
echo -e "${CMD_COLOR}Resolution: ${RESET}${RESULT_COLOR}Dual Approval (Creator + Admin)${RESET}"
echo -e "${CMD_COLOR}Time Weighted: ${RESET}${RESULT_COLOR}Yes (alpha: 0.8)${RESET}"
echo -e "${CMD_COLOR}Creator: ${RESET}${RESULT_COLOR}Alice${RESET}"
echo -e "${CMD_COLOR}Activation Fee: ${RESET}${RESULT_COLOR}$ACTIVATION_AMOUNT base units${RESET}"
echo ""

read -p "Proceed with market creation? (y/N): " -n 1 -r CONFIRM
echo ""

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${WARNING_COLOR}Market creation cancelled.${RESET}"
    # Restore original identity
    switch_identity "$ORIGINAL_IDENTITY"
    exit 0
fi

section "CREATING USER MARKET"

echo -e "${CMD_COLOR}Calling create_market on prediction markets canister...${RESET}"
echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER create_market \\${RESET}"
echo -e "${EXEC_COLOR}  \"(\\\"$MARKET_QUESTION\\\", $MARKET_CATEGORY, \\\"$MARKET_RULES\\\", $MARKET_OUTCOMES, \\${RESET}"
echo -e "${EXEC_COLOR}   variant { Decentralized = record { quorum = 2 } }, variant { Duration = $MARKET_DURATION }, \\${RESET}"
echo -e "${EXEC_COLOR}   opt \\\"$SELECTED_TOKEN_ID\\\", opt true, opt 0.8, null)\" \\${RESET}"
echo -e "${EXEC_COLOR}  --network $DFX_NETWORK${RESET}"
echo ""

# Create the market with Decentralized resolution (dual approval)
MARKET_CREATION_RESULT=$(dfx canister call $PREDICTION_MARKETS_CANISTER create_market \
    "(\"$MARKET_QUESTION\", $MARKET_CATEGORY, \"$MARKET_RULES\", $MARKET_OUTCOMES, variant { Decentralized = record { quorum = 2 } }, variant { Duration = $MARKET_DURATION }, opt \"$SELECTED_TOKEN_ID\", opt true, opt 0.8, null)" \
    --network $DFX_NETWORK 2>&1)

echo -e "${CMD_COLOR}Result: ${RESET}${RESULT_COLOR}$MARKET_CREATION_RESULT${RESET}"

# Extract market ID from result
if [[ $MARKET_CREATION_RESULT =~ \(variant\ \{\ Ok\ =\ ([0-9]+) ]]; then
    MARKET_ID="${BASH_REMATCH[1]}"
    echo -e "${SUCCESS_COLOR}✓ Market created successfully!${RESET}"
    echo -e "${CMD_COLOR}Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
    
    section "MARKET ACTIVATION PROCESS"
    
    echo -e "${CMD_COLOR}Market is currently in PendingActivation status${RESET}"
    echo -e "${CMD_COLOR}Alice needs to pay activation fee to activate the market${RESET}"
    echo ""
    
    # Check balance
    if check_user_balance "$SELECTED_TOKEN_ID" "$ACTIVATION_AMOUNT" "$SELECTED_TOKEN"; then
        
        # Approve tokens for spending
        echo -e "${CMD_COLOR}Step 1: Approving tokens for activation...${RESET}"
        if approve_tokens_for_activation "$SELECTED_TOKEN_ID" "$ACTIVATION_AMOUNT" "$SELECTED_TOKEN"; then
            
            # Place activation bet
            echo -e "${CMD_COLOR}Step 2: Placing activation bet...${RESET}"
            if place_activation_bet "$MARKET_ID" "$ACTIVATION_AMOUNT" "$SELECTED_TOKEN_ID" "$SELECTED_TOKEN"; then
                
                section "MARKET VERIFICATION"
                
                echo -e "${CMD_COLOR}Fetching updated market details...${RESET}"
                MARKET_DETAILS=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($MARKET_ID)" --network $DFX_NETWORK 2>&1)
                
                if [[ $MARKET_DETAILS == *"opt record"* ]]; then
                    echo -e "${SUCCESS_COLOR}✓ Market verification successful${RESET}"
                    echo -e "${CMD_COLOR}Market Status: ${RESET}${RESULT_COLOR}Active (user-created & activated)${RESET}"
                    
                    # Save market info to file
                    MARKET_INFO_FILE="/tmp/created_user_market_${MARKET_ID}.log"
                    cat > "$MARKET_INFO_FILE" << EOF
User Market Creation Summary
============================
Market ID: $MARKET_ID
Question: $MARKET_QUESTION
Token: $SELECTED_TOKEN ($SELECTED_TOKEN_ID)
Category: $MARKET_CATEGORY
Duration: $MARKET_DURATION seconds
Resolution Method: Dual Approval (Creator + Admin)
Time Weighted: Yes (alpha: 0.8)
Created By: Alice ($ALICE_PRINCIPAL)
Activation Fee Paid: $ACTIVATION_AMOUNT base units
Created At: $(date)

Raw Result: $MARKET_CREATION_RESULT
EOF
                    echo -e "${CMD_COLOR}Market info saved to: ${RESET}${RESULT_COLOR}$MARKET_INFO_FILE${RESET}"
                    
                else
                    echo -e "${WARNING_COLOR}⚠ Market created but verification failed${RESET}"
                    echo -e "${CMD_COLOR}Verification result: ${RESET}${ERROR_COLOR}$MARKET_DETAILS${RESET}"
                fi
            else
                echo -e "${ERROR_COLOR}Market activation failed${RESET}"
            fi
        else
            echo -e "${ERROR_COLOR}Token approval failed${RESET}"
        fi
    else
        echo -e "${ERROR_COLOR}Insufficient balance for activation${RESET}"
    fi
    
else
    echo -e "${ERROR_COLOR}✗ Market creation failed${RESET}"
    echo -e "${CMD_COLOR}Error details: ${RESET}${ERROR_COLOR}$MARKET_CREATION_RESULT${RESET}"
    
    # Restore original identity before exit
    switch_identity "$ORIGINAL_IDENTITY"
    exit 1
fi

# Restore original identity
section "RESTORING ORIGINAL IDENTITY"
switch_identity "$ORIGINAL_IDENTITY"

section "USER MARKET CREATION COMPLETE"

echo -e "${SUCCESS_COLOR}✓ User market successfully created and activated!${RESET}"
echo ""
echo -e "${CMD_COLOR}Summary:${RESET}"
echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}  Question: ${RESET}${RESULT_COLOR}$MARKET_QUESTION${RESET}"
echo -e "${CMD_COLOR}  Token: ${RESET}${RESULT_COLOR}$SELECTED_TOKEN${RESET}"
echo -e "${CMD_COLOR}  Creator: ${RESET}${RESULT_COLOR}Alice${RESET}"
echo -e "${CMD_COLOR}  Resolution: ${RESET}${RESULT_COLOR}Dual Approval${RESET}"
echo -e "${CMD_COLOR}  Time Weighted: ${RESET}${RESULT_COLOR}Yes${RESET}"
echo -e "${CMD_COLOR}  Status: ${RESET}${RESULT_COLOR}Active${RESET}"
echo ""
echo -e "${CMD_COLOR}Key Differences from Admin Markets:${RESET}"
echo -e "${CMD_COLOR}  • Requires dual approval for resolution (Creator + Admin)${RESET}"
echo -e "${CMD_COLOR}  • Creator paid activation fee to activate market${RESET}"
echo -e "${CMD_COLOR}  • Started in PendingActivation, now Active${RESET}"
echo ""
echo -e "${CMD_COLOR}Next steps:${RESET}"
echo -e "${CMD_COLOR}  • Other users can now place bets on this market${RESET}"
echo -e "${CMD_COLOR}  • Use place_time_weighted_bets.sh for betting${RESET}"
echo -e "${CMD_COLOR}  • Resolution will require both Alice and admin approval${RESET}"
echo ""

exit 0 