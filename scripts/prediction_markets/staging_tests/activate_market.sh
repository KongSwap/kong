#!/bin/bash

# Market Activation Script for Kong Prediction Markets
# This script allows Alice to activate pending markets by placing the required activation bet
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

# Transfer fees (for ICRC-2 approval)
KONG_TRANSFER_FEE="10000"             # 0.0001 KONG
DKP_TRANSFER_FEE="10000"              # 0.0001 DKP

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

# Helper function to get market information
get_market_info() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Fetching market information...${RESET}"
    echo -e "${CMD_COLOR}Calling: dfx canister call $PREDICTION_MARKETS_CANISTER get_market \"($market_id)\" --network $DFX_NETWORK${RESET}"
    
    local market_info=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($market_id)" --network $DFX_NETWORK 2>&1)
    local dfx_exit_code=$?
    
    echo -e "${CMD_COLOR}DFX exit code: ${RESET}${RESULT_COLOR}$dfx_exit_code${RESET}"
    
    if [ $dfx_exit_code -ne 0 ]; then
        echo -e "${ERROR_COLOR}✗ DFX call failed${RESET}"
        echo -e "${ERROR_COLOR}Error: $market_info${RESET}"
        return 1
    fi
    
    if [[ $market_info == *"(null)"* ]]; then
        echo -e "${ERROR_COLOR}✗ Market with ID $market_id not found${RESET}"
        return 1
    fi
    
    echo -e "${SUCCESS_COLOR}✓ Market found${RESET}"
    echo -e "${CMD_COLOR}Market details: ${RESET}${RESULT_COLOR}$market_info${RESET}"
    
    # Extract market status
    if [[ $market_info == *"status = variant { PendingActivation }"* ]]; then
        echo -e "${WARNING_COLOR}⚠ Market is in PendingActivation status - needs activation${RESET}"
        MARKET_STATUS="PendingActivation"
    elif [[ $market_info == *"status = variant { Active }"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market is already Active${RESET}"
        MARKET_STATUS="Active"
        return 2  # Special return code for already active
    else
        echo -e "${WARNING_COLOR}⚠ Market has unknown status${RESET}"
        MARKET_STATUS="Unknown"
    fi
    
    # Extract token ID - using simpler approach
    MARKET_TOKEN_ID=$(echo "$market_info" | grep -o 'token_id = "[^"]*"' | sed 's/token_id = "\([^"]*\)"/\1/')
    if [ -n "$MARKET_TOKEN_ID" ]; then
        echo -e "${CMD_COLOR}Market token: ${RESET}${RESULT_COLOR}$MARKET_TOKEN_ID${RESET}"
    else
        echo -e "${ERROR_COLOR}✗ Could not extract token ID${RESET}"
        return 1
    fi
    
    # Extract market creator - using simpler approach
    MARKET_CREATOR=$(echo "$market_info" | grep -o 'creator = principal "[^"]*"' | sed 's/creator = principal "\([^"]*\)"/\1/')
    if [ -n "$MARKET_CREATOR" ]; then
        echo -e "${CMD_COLOR}Market creator: ${RESET}${RESULT_COLOR}$MARKET_CREATOR${RESET}"
    else
        echo -e "${ERROR_COLOR}✗ Could not extract market creator${RESET}"
        return 1
    fi
    
    return 0
}

# Helper function to determine token details
determine_token_details() {
    local token_id=$1
    
    if [ "$token_id" = "$KONG_LEDGER_ID" ]; then
        SELECTED_TOKEN="KONG"
        SELECTED_TOKEN_ID=$KONG_LEDGER_ID
        ACTIVATION_AMOUNT=$KONG_ACTIVATION_FEE
        TRANSFER_FEE=$KONG_TRANSFER_FEE
        echo -e "${SUCCESS_COLOR}✓ Detected KONG market${RESET}"
    elif [ "$token_id" = "$DKP_LEDGER_ID" ]; then
        SELECTED_TOKEN="DKP"
        SELECTED_TOKEN_ID=$DKP_LEDGER_ID
        ACTIVATION_AMOUNT=$DKP_ACTIVATION_FEE
        TRANSFER_FEE=$DKP_TRANSFER_FEE
        echo -e "${SUCCESS_COLOR}✓ Detected DKP market${RESET}"
    else
        echo -e "${ERROR_COLOR}✗ Unknown token type: $token_id${RESET}"
        return 1
    fi
    
    echo -e "${CMD_COLOR}Activation amount needed: ${RESET}${RESULT_COLOR}$ACTIVATION_AMOUNT base units ($SELECTED_TOKEN)${RESET}"
    return 0
}

# Helper function to approve tokens for activation
approve_tokens() {
    local token_id=$1
    local amount_plus_fee=$2
    local token_symbol=$3
    
    echo -e "${CMD_COLOR}Step 1: Approving $token_symbol tokens for activation...${RESET}"
    
    # Calculate expiration time (60 seconds from now in nanoseconds)
    local current_time_ns=$(date +%s)000000000
    local expires_at=$((current_time_ns + 60000000000))
    
    echo -e "${CMD_COLOR}Approval amount: ${RESET}${RESULT_COLOR}$amount_plus_fee base units${RESET}"
    echo -e "${CMD_COLOR}Expires at: ${RESET}${RESULT_COLOR}$expires_at ns${RESET}"
    
    # ICRC-2 approve call
    local approve_result=$(dfx canister call "$token_id" icrc2_approve \
        "(record { 
            amount = $amount_plus_fee; 
            expires_at = opt $expires_at; 
            spender = record { 
                owner = principal \"$PREDICTION_MARKETS_CANISTER\"; 
                subaccount = null 
            } 
        })" \
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
    
    echo -e "${CMD_COLOR}Step 2: Placing activation bet...${RESET}"
    echo -e "${CMD_COLOR}Market ID: ${RESET}${RESULT_COLOR}$market_id${RESET}"
    echo -e "${CMD_COLOR}Bet amount: ${RESET}${RESULT_COLOR}$amount base units${RESET}"
    echo -e "${CMD_COLOR}Outcome: ${RESET}${RESULT_COLOR}0 (Yes)${RESET}"
    echo -e "${CMD_COLOR}Token: ${RESET}${RESULT_COLOR}$token_symbol ($token_id)${RESET}"
    
    # Place bet using correct Candid format: (market_id, outcome_index, amount, opt token_id)
    local bet_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER place_bet \
        "($market_id, 0, $amount, opt \"$token_id\")" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Bet result: ${RESET}${RESULT_COLOR}$bet_result${RESET}"
    
    # Check if bet was successful
    if [[ $bet_result == *"Ok"* ]] || [[ $bet_result == *"Success"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Activation bet placed successfully!${RESET}"
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Activation bet failed: $bet_result${RESET}"
        return 1
    fi
}

# Helper function to verify market activation
verify_market_activation() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Verifying market activation...${RESET}"
    
    # Wait a moment for processing
    sleep 3
    
    local updated_market_info=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($market_id)" --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Updated market info: ${RESET}${RESULT_COLOR}$updated_market_info${RESET}"
    
    if [[ $updated_market_info == *"status = variant { Active }"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market successfully activated!${RESET}"
        return 0
    elif [[ $updated_market_info == *"status = variant { PendingActivation }"* ]]; then
        echo -e "${WARNING_COLOR}⚠ Market still in PendingActivation - may need more bets${RESET}"
        return 1
    else
        echo -e "${WARNING_COLOR}⚠ Market status unclear${RESET}"
        return 1
    fi
}

# Main script
clear
section "MARKET ACTIVATION - KONG PREDICTION MARKETS"

# Store original identity to restore later
ORIGINAL_IDENTITY=$(dfx identity whoami)
echo -e "${CMD_COLOR}Original identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"

# Get market ID from user
echo -e "${CMD_COLOR}Enter the Market ID to activate:${RESET}"
read -p "Market ID: " MARKET_ID

# Validate market ID is a number
if ! [[ "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${ERROR_COLOR}Error: Market ID must be a number${RESET}"
    exit 1
fi

section "MARKET VALIDATION"

# Get market information
get_market_info "$MARKET_ID"
market_info_result=$?

case $market_info_result in
    0)
        # Market found and pending activation
        ;;
    1)
        # Market not found
        echo -e "${ERROR_COLOR}Cannot proceed with invalid market${RESET}"
        exit 1
        ;;
    2)
        # Market already active
        echo -e "${WARNING_COLOR}Market is already active - no activation needed${RESET}"
        exit 0
        ;;
esac

# Check if market needs activation
if [ "$MARKET_STATUS" != "PendingActivation" ]; then
    echo -e "${WARNING_COLOR}Market is not in PendingActivation status${RESET}"
    echo -e "${CMD_COLOR}Current status: ${RESET}${RESULT_COLOR}$MARKET_STATUS${RESET}"
    exit 1
fi

# Determine token details
if ! determine_token_details "$MARKET_TOKEN_ID"; then
    echo -e "${ERROR_COLOR}Cannot determine token details${RESET}"
    exit 1
fi

section "ACTIVATION PREPARATION"

# Switch to Alice identity
echo -e "${CMD_COLOR}Switching to Alice identity for market activation...${RESET}"
if ! switch_identity "alice"; then
    echo -e "${ERROR_COLOR}Cannot proceed without Alice identity${RESET}"
    exit 1
fi

# Get Alice's principal
ALICE_PRINCIPAL=$(dfx identity get-principal)
echo -e "${CMD_COLOR}Alice's principal: ${RESET}${RESULT_COLOR}$ALICE_PRINCIPAL${RESET}"

# Check if Alice is the market creator
if [ "$ALICE_PRINCIPAL" != "$MARKET_CREATOR" ]; then
    echo -e "${WARNING_COLOR}⚠ Alice is not the market creator${RESET}"
    echo -e "${CMD_COLOR}Market creator: ${RESET}${RESULT_COLOR}$MARKET_CREATOR${RESET}"
    echo -e "${CMD_COLOR}Alice principal: ${RESET}${RESULT_COLOR}$ALICE_PRINCIPAL${RESET}"
    read -p "Continue anyway? (y/N): " -n 1 -r CONTINUE
    echo ""
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        echo -e "${WARNING_COLOR}Activation cancelled${RESET}"
        switch_identity "$ORIGINAL_IDENTITY"
        exit 0
    fi
fi

echo -e "${CMD_COLOR}Activation Summary:${RESET}"
echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}  Token: ${RESET}${RESULT_COLOR}$SELECTED_TOKEN${RESET}"
echo -e "${CMD_COLOR}  Activation Amount: ${RESET}${RESULT_COLOR}$ACTIVATION_AMOUNT base units${RESET}"
echo -e "${CMD_COLOR}  Outcome: ${RESET}${RESULT_COLOR}Yes (0)${RESET}"
echo ""

read -p "Proceed with market activation? (y/N): " -n 1 -r CONFIRM
echo ""

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${WARNING_COLOR}Market activation cancelled${RESET}"
    switch_identity "$ORIGINAL_IDENTITY"
    exit 0
fi

section "MARKET ACTIVATION PROCESS"

# Calculate total amount needed (activation amount + transfer fee)
TOTAL_AMOUNT=$((ACTIVATION_AMOUNT + TRANSFER_FEE))
echo -e "${CMD_COLOR}Total amount for approval: ${RESET}${RESULT_COLOR}$TOTAL_AMOUNT base units${RESET}"

# Step 1: Approve tokens
if ! approve_tokens "$SELECTED_TOKEN_ID" "$TOTAL_AMOUNT" "$SELECTED_TOKEN"; then
    echo -e "${ERROR_COLOR}Token approval failed - cannot proceed${RESET}"
    switch_identity "$ORIGINAL_IDENTITY"
    exit 1
fi

# Step 2: Place activation bet
if ! place_activation_bet "$MARKET_ID" "$ACTIVATION_AMOUNT" "$SELECTED_TOKEN_ID" "$SELECTED_TOKEN"; then
    echo -e "${ERROR_COLOR}Activation bet failed${RESET}"
    switch_identity "$ORIGINAL_IDENTITY"
    exit 1
fi

section "ACTIVATION VERIFICATION"

# Verify market was activated
if verify_market_activation "$MARKET_ID"; then
    ACTIVATION_SUCCESS=true
    echo -e "${SUCCESS_COLOR}✓ Market activation completed successfully!${RESET}"
else
    ACTIVATION_SUCCESS=false
    echo -e "${WARNING_COLOR}⚠ Market activation status unclear${RESET}"
fi

# Restore original identity
section "RESTORING ORIGINAL IDENTITY"
switch_identity "$ORIGINAL_IDENTITY"

section "ACTIVATION SUMMARY"

echo -e "${CMD_COLOR}Activation Results:${RESET}"
echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}  Token: ${RESET}${RESULT_COLOR}$SELECTED_TOKEN${RESET}"
echo -e "${CMD_COLOR}  Activation Amount: ${RESET}${RESULT_COLOR}$ACTIVATION_AMOUNT base units${RESET}"
echo -e "${CMD_COLOR}  Activator: ${RESET}${RESULT_COLOR}Alice${RESET}"

if [ "$ACTIVATION_SUCCESS" = true ]; then
    echo -e "${CMD_COLOR}  Status: ${RESET}${SUCCESS_COLOR}✓ Successfully Activated${RESET}"
else
    echo -e "${CMD_COLOR}  Status: ${RESET}${WARNING_COLOR}⚠ Activation Unclear${RESET}"
fi

echo ""
echo -e "${CMD_COLOR}Next Steps:${RESET}"
echo -e "${CMD_COLOR}  • Market is now active and ready for betting${RESET}"
echo -e "${CMD_COLOR}  • Use place_time_weighted_bets.sh for time-weighted betting${RESET}"
echo -e "${CMD_COLOR}  • Use dual_resolve_market.sh for dual approval resolution${RESET}"
echo ""

exit 0 