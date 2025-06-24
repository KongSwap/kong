#!/bin/bash

# Dual Resolution Script for Kong Prediction Markets
# This script demonstrates dual approval resolution where both Alice (creator) and admin must agree
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
    local market_info=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($market_id)" --network $DFX_NETWORK 2>&1)
    
    if [[ $market_info == *"null"* ]]; then
        echo -e "${ERROR_COLOR}✗ Market with ID $market_id not found${RESET}"
        return 1
    fi
    
    echo -e "${SUCCESS_COLOR}✓ Market found${RESET}"
    echo -e "${CMD_COLOR}Market details: ${RESET}${RESULT_COLOR}$market_info${RESET}"
    
    # Extract market creator if possible
    if [[ $market_info == *"creator"* ]]; then
        MARKET_CREATOR=$(echo "$market_info" | grep -o 'creator = principal "[^"]*"' | sed 's/creator = principal "\(.*\)"/\1/')
        echo -e "${CMD_COLOR}Market creator: ${RESET}${RESULT_COLOR}$MARKET_CREATOR${RESET}"
    fi
    
    # Extract resolution method
    if [[ $market_info == *"resolution_method"* ]]; then
        RESOLUTION_METHOD_INFO=$(echo "$market_info" | grep -o 'resolution_method = variant { [^}]*}')
        echo -e "${CMD_COLOR}Resolution method: ${RESET}${RESULT_COLOR}$RESOLUTION_METHOD_INFO${RESET}"
    fi
    
    return 0
}

# Helper function to display market outcomes
display_market_outcomes() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Available outcomes for market $market_id:${RESET}"
    echo -e "${CMD_COLOR}  [0] Yes${RESET}"
    echo -e "${CMD_COLOR}  [1] No${RESET}"
    echo ""
}

# Helper function to propose resolution (first step)
propose_resolution() {
    local market_id=$1
    local winning_outcomes=$2
    local proposer=$3
    
    echo -e "${CMD_COLOR}📋 $proposer proposing resolution...${RESET}"
    echo -e "${CMD_COLOR}Market ID: ${RESET}${RESULT_COLOR}$market_id${RESET}"
    echo -e "${CMD_COLOR}Winning outcomes: ${RESET}${RESULT_COLOR}$winning_outcomes${RESET}"
    
    # Call propose_resolution
    local proposal_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER propose_resolution \
        "(record { market_id = $market_id; winning_outcomes = $winning_outcomes })" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Proposal result: ${RESET}${RESULT_COLOR}$proposal_result${RESET}"
    
    # Check if proposal was successful
    if [[ $proposal_result == *"Success"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Resolution proposal successful!${RESET}"
        return 0
    elif [[ $proposal_result == *"AwaitingAdminApproval"* ]]; then
        echo -e "${WARNING_COLOR}⚠ Awaiting admin approval for resolution${RESET}"
        return 0
    elif [[ $proposal_result == *"AwaitingCreatorApproval"* ]]; then
        echo -e "${WARNING_COLOR}⚠ Awaiting creator approval for resolution${RESET}"
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Resolution proposal failed: $proposal_result${RESET}"
        return 1
    fi
}

# Helper function to finalize resolution (second step)
finalize_resolution() {
    local market_id=$1
    local winning_outcomes=$2
    local finalizer=$3
    
    echo -e "${CMD_COLOR}✅ $finalizer finalizing resolution...${RESET}"
    echo -e "${CMD_COLOR}Market ID: ${RESET}${RESULT_COLOR}$market_id${RESET}"
    echo -e "${CMD_COLOR}Winning outcomes: ${RESET}${RESULT_COLOR}$winning_outcomes${RESET}"
    
    # Call propose_resolution again (the second call should finalize if both parties agree)
    local finalization_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER propose_resolution \
        "(record { market_id = $market_id; winning_outcomes = $winning_outcomes })" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Finalization result: ${RESET}${RESULT_COLOR}$finalization_result${RESET}"
    
    # Check if finalization was successful
    if [[ $finalization_result == *"Success"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Resolution finalized successfully!${RESET}"
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Resolution finalization failed: $finalization_result${RESET}"
        return 1
    fi
}

# Main script
clear
section "DUAL RESOLUTION - KONG PREDICTION MARKETS"

# Store original identity to restore later
ORIGINAL_IDENTITY=$(dfx identity whoami)
echo -e "${CMD_COLOR}Original identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"

# Get market ID from user
echo -e "${CMD_COLOR}Enter the Market ID to resolve (should be a user-created market):${RESET}"
read -p "Market ID: " MARKET_ID

# Validate market ID is a number
if ! [[ "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${ERROR_COLOR}Error: Market ID must be a number${RESET}"
    exit 1
fi

section "MARKET VALIDATION"

# Get market information
if ! get_market_info "$MARKET_ID"; then
    echo -e "${ERROR_COLOR}Cannot proceed with invalid market${RESET}"
    exit 1
fi

# Display market outcomes
display_market_outcomes "$MARKET_ID"

# Get winning outcome selection
echo -e "${CMD_COLOR}Select the winning outcome:${RESET}"
echo -e "${CMD_COLOR}  0) Yes${RESET}"
echo -e "${CMD_COLOR}  1) No${RESET}"
echo ""
read -p "Enter winning outcome (0 or 1): " -n 1 -r OUTCOME_CHOICE
echo ""

case $OUTCOME_CHOICE in
    0)
        WINNING_OUTCOMES="vec { 0 }"
        OUTCOME_TEXT="Yes"
        ;;
    1)
        WINNING_OUTCOMES="vec { 1 }"
        OUTCOME_TEXT="No"
        ;;
    *)
        echo -e "${ERROR_COLOR}Invalid choice. Please select 0 or 1.${RESET}"
        exit 1
        ;;
esac

echo -e "${SUCCESS_COLOR}✓ Selected outcome: $OUTCOME_TEXT ($WINNING_OUTCOMES)${RESET}"
echo ""

section "DUAL RESOLUTION PROCESS"

echo -e "${CMD_COLOR}Dual resolution requires both creator and admin agreement:${RESET}"
echo -e "${CMD_COLOR}  1. Alice (creator) proposes resolution${RESET}"
echo -e "${CMD_COLOR}  2. Default user (admin) approves resolution${RESET}"
echo -e "${CMD_COLOR}  3. Market is resolved when both agree${RESET}"
echo ""

read -p "Proceed with dual resolution? (y/N): " -n 1 -r CONFIRM
echo ""

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${WARNING_COLOR}Dual resolution cancelled.${RESET}"
    exit 0
fi

section "STEP 1: ALICE PROPOSES RESOLUTION"

# Switch to Alice identity for first proposal
echo -e "${CMD_COLOR}Switching to Alice for resolution proposal...${RESET}"
if ! switch_identity "alice"; then
    echo -e "${ERROR_COLOR}Cannot proceed without Alice identity${RESET}"
    exit 1
fi

# Alice proposes resolution
if ! propose_resolution "$MARKET_ID" "$WINNING_OUTCOMES" "Alice"; then
    echo -e "${ERROR_COLOR}Alice's resolution proposal failed${RESET}"
    switch_identity "$ORIGINAL_IDENTITY"
    exit 1
fi

# Wait a moment for processing
echo -e "${CMD_COLOR}Waiting 3 seconds for proposal processing...${RESET}"
sleep 3

section "STEP 2: ADMIN APPROVES RESOLUTION"

# Switch to default identity (admin) for approval
echo -e "${CMD_COLOR}Switching to default identity (admin) for approval...${RESET}"
if ! switch_identity "$ORIGINAL_IDENTITY"; then
    echo -e "${ERROR_COLOR}Cannot switch back to admin identity${RESET}"
    exit 1
fi

# Admin finalizes resolution
if ! finalize_resolution "$MARKET_ID" "$WINNING_OUTCOMES" "Admin"; then
    echo -e "${ERROR_COLOR}Admin approval failed${RESET}"
    exit 1
fi

section "RESOLUTION VERIFICATION"

# Wait for resolution to process
echo -e "${CMD_COLOR}Waiting 5 seconds for resolution processing...${RESET}"
sleep 5

# Check final market status
echo -e "${CMD_COLOR}Checking final market status...${RESET}"
FINAL_MARKET_INFO=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($MARKET_ID)" --network $DFX_NETWORK 2>&1)

echo -e "${CMD_COLOR}Final market info: ${RESET}${RESULT_COLOR}$FINAL_MARKET_INFO${RESET}"

# Check if market is resolved
if [[ $FINAL_MARKET_INFO == *"Closed"* ]] || [[ $FINAL_MARKET_INFO == *"Resolved"* ]]; then
    echo -e "${SUCCESS_COLOR}✓ Market successfully resolved!${RESET}"
    RESOLUTION_SUCCESS=true
else
    echo -e "${WARNING_COLOR}⚠ Market status unclear - may still be processing${RESET}"
    RESOLUTION_SUCCESS=false
fi

section "DUAL RESOLUTION SUMMARY"

echo -e "${CMD_COLOR}Resolution Results:${RESET}"
echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}  Winning Outcome: ${RESET}${RESULT_COLOR}$OUTCOME_TEXT ($WINNING_OUTCOMES)${RESET}"
echo -e "${CMD_COLOR}  Resolution Method: ${RESET}${RESULT_COLOR}Dual Approval${RESET}"
echo ""

echo -e "${CMD_COLOR}Process Steps Completed:${RESET}"
echo -e "${SUCCESS_COLOR}  ✓ Alice proposed resolution${RESET}"
echo -e "${SUCCESS_COLOR}  ✓ Admin approved resolution${RESET}"

if [ "$RESOLUTION_SUCCESS" = true ]; then
    echo -e "${SUCCESS_COLOR}  ✓ Market resolved successfully${RESET}"
else
    echo -e "${WARNING_COLOR}  ⚠ Final resolution status pending${RESET}"
fi

echo ""
echo -e "${CMD_COLOR}Key Benefits of Dual Resolution:${RESET}"
echo -e "${CMD_COLOR}  • Prevents creator bias (Alice can't resolve alone)${RESET}"
echo -e "${CMD_COLOR}  • Prevents admin overreach (Admin can't resolve without creator)${RESET}"
echo -e "${CMD_COLOR}  • Ensures fair resolution through consensus${RESET}"
echo -e "${CMD_COLOR}  • Both parties must agree on the outcome${RESET}"
echo ""

echo -e "${CMD_COLOR}Next Steps:${RESET}"
echo -e "${CMD_COLOR}  • Check user claims with claim_rewards.sh${RESET}"
echo -e "${CMD_COLOR}  • Verify payouts reflect time weighting${RESET}"
echo -e "${CMD_COLOR}  • Review transaction histories${RESET}"
echo ""

section "ADDITIONAL INFORMATION"

echo -e "${CMD_COLOR}To check market bets:${RESET}"
echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER get_market_bets \"($MARKET_ID)\" --network $DFX_NETWORK${RESET}"
echo ""

echo -e "${CMD_COLOR}To check user claims:${RESET}"
echo -e "${EXEC_COLOR}./claim_rewards.sh${RESET}"
echo ""

echo -e "${CMD_COLOR}To get market resolution details:${RESET}"
echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER get_market_resolution_details \"($MARKET_ID)\" --network $DFX_NETWORK${RESET}"
echo ""

exit 0 