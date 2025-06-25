#!/bin/bash

# Market Resolution Script for Kong Prediction Markets
# This script allows you to resolve markets using different resolution methods
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

# Helper function to print section titles
section() {
    echo -e "${TITLE_COLOR}==== $1 ====${RESET}"
}

# Configuration
PREDICTION_MARKETS_CANISTER="qqoq7-zaaaa-aaaan-qzzvq-cai"
DFX_NETWORK=ic

# Store original identity
ORIGINAL_IDENTITY=$(dfx identity whoami 2>/dev/null || echo "default")

section "MARKET RESOLUTION TOOL"
echo -e "${CMD_COLOR}Network: ${RESET}${RESULT_COLOR}$DFX_NETWORK${RESET}"
echo -e "${CMD_COLOR}Prediction Markets Canister: ${RESET}${RESULT_COLOR}$PREDICTION_MARKETS_CANISTER${RESET}"
echo -e "${CMD_COLOR}Current Identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"
echo ""

# Check network connectivity
echo -e "${CMD_COLOR}Testing network connectivity...${RESET}"
if ! dfx ping $DFX_NETWORK &>/dev/null; then
    echo -e "${ERROR_COLOR}ERROR: Cannot connect to the IC network. Please check your internet connection and dfx configuration.${RESET}"
    exit 1
fi
echo -e "${SUCCESS_COLOR}✓ Network connectivity confirmed${RESET}"
echo ""

# Interactive market ID input
section "MARKET SELECTION"
read -p "Enter the Market ID to resolve: " MARKET_ID

# Validate market ID
if ! [[ "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${ERROR_COLOR}ERROR: Invalid market ID. Please enter a valid number.${RESET}"
    exit 1
fi

# Get market information
echo -e "${CMD_COLOR}Fetching market information...${RESET}"
MARKET_INFO=$(dfx canister call ${PREDICTION_MARKETS_CANISTER} get_market "($MARKET_ID)" --network $DFX_NETWORK 2>/dev/null)

if [[ $MARKET_INFO == "(null)" ]]; then
    echo -e "${ERROR_COLOR}ERROR: Market with ID $MARKET_ID not found.${RESET}"
    exit 1
fi

echo -e "${SUCCESS_COLOR}✓ Market found${RESET}"
echo ""

# Display market details
section "MARKET DETAILS"
echo -e "${CMD_COLOR}Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"

# Extract market title (basic extraction)
MARKET_TITLE=$(echo "$MARKET_INFO" | grep -o 'title = "[^"]*"' | head -1 | sed 's/title = "\(.*\)"/\1/')
if [ -n "$MARKET_TITLE" ]; then
    echo -e "${CMD_COLOR}Title: ${RESET}${RESULT_COLOR}$MARKET_TITLE${RESET}"
fi

# Extract outcomes
echo -e "${CMD_COLOR}Market outcomes:${RESET}"
OUTCOMES=$(echo "$MARKET_INFO" | grep -o 'outcomes = vec {[^}]*}' | sed 's/outcomes = vec {\(.*\)}/\1/' | sed 's/; /\n/g' | sed 's/"//g')
OUTCOME_COUNT=0
while IFS= read -r outcome; do
    if [ -n "$outcome" ]; then
        echo -e "${CMD_COLOR}  [$OUTCOME_COUNT] ${RESET}${RESULT_COLOR}$outcome${RESET}"
        OUTCOME_COUNT=$((OUTCOME_COUNT + 1))
    fi
done <<< "$OUTCOMES"

echo ""

# Interactive resolution method selection
section "RESOLUTION METHOD SELECTION"
echo -e "${CMD_COLOR}Available resolution methods:${RESET}"
echo -e "${CMD_COLOR}  1) Admin Resolution (new format)${RESET}"
echo -e "${CMD_COLOR}  2) Admin Resolution Legacy (old format)${RESET}"
echo -e "${CMD_COLOR}  3) Oracle Resolution${RESET}"
echo -e "${CMD_COLOR}  4) Dual Resolution (propose_resolution)${RESET}"
echo ""
read -p "Select resolution method (1-4): " -n 1 -r RESOLUTION_METHOD
echo ""

case $RESOLUTION_METHOD in
    1)
        RESOLUTION_TYPE="Admin (New)"
        ;;
    2)
        RESOLUTION_TYPE="Admin (Legacy)"
        ;;
    3)
        RESOLUTION_TYPE="Oracle"
        ;;
    4)
        RESOLUTION_TYPE="Dual"
        ;;
    *)
        echo -e "${ERROR_COLOR}Invalid choice. Please select 1, 2, 3, or 4.${RESET}"
        exit 1
        ;;
esac

echo -e "${SUCCESS_COLOR}✓ Selected resolution method: $RESOLUTION_TYPE${RESET}"
echo ""

# Interactive winning outcome selection
section "WINNING OUTCOME SELECTION"
echo -e "${CMD_COLOR}Select the winning outcome(s):${RESET}"

if [ $OUTCOME_COUNT -eq 0 ]; then
    echo -e "${ERROR_COLOR}ERROR: No outcomes found for this market.${RESET}"
    exit 1
fi

# Display outcomes again for reference
OUTCOME_INDEX=0
while IFS= read -r outcome; do
    if [ -n "$outcome" ]; then
        echo -e "${CMD_COLOR}  [$OUTCOME_INDEX] ${RESET}${RESULT_COLOR}$outcome${RESET}"
        OUTCOME_INDEX=$((OUTCOME_INDEX + 1))
    fi
done <<< "$OUTCOMES"

echo ""
read -p "Enter winning outcome index(es) separated by commas (e.g., 0 or 0,1): " WINNING_OUTCOMES_INPUT

# Parse winning outcomes
IFS=',' read -ra WINNING_OUTCOMES_ARRAY <<< "$WINNING_OUTCOMES_INPUT"
WINNING_OUTCOMES_VEC="vec {"

for i in "${!WINNING_OUTCOMES_ARRAY[@]}"; do
    outcome_index=$(echo "${WINNING_OUTCOMES_ARRAY[$i]}" | tr -d ' ')
    
    # Validate outcome index
    if ! [[ "$outcome_index" =~ ^[0-9]+$ ]] || [ "$outcome_index" -ge "$OUTCOME_COUNT" ]; then
        echo -e "${ERROR_COLOR}ERROR: Invalid outcome index: $outcome_index${RESET}"
        exit 1
    fi
    
    if [ $i -eq 0 ]; then
        WINNING_OUTCOMES_VEC="${WINNING_OUTCOMES_VEC} ${outcome_index}"
    else
        WINNING_OUTCOMES_VEC="${WINNING_OUTCOMES_VEC}; ${outcome_index}"
    fi
done

WINNING_OUTCOMES_VEC="${WINNING_OUTCOMES_VEC} }"

echo -e "${SUCCESS_COLOR}✓ Winning outcomes: $WINNING_OUTCOMES_VEC${RESET}"
echo ""

# Confirmation
section "RESOLUTION CONFIRMATION"
echo -e "${WARNING_COLOR}Resolution Summary:${RESET}"
echo -e "${WARNING_COLOR}  Market ID: $MARKET_ID${RESET}"
echo -e "${WARNING_COLOR}  Resolution Method: $RESOLUTION_TYPE${RESET}"
echo -e "${WARNING_COLOR}  Winning Outcomes: $WINNING_OUTCOMES_VEC${RESET}"
echo -e "${WARNING_COLOR}  Resolver Identity: $ORIGINAL_IDENTITY${RESET}"
echo ""
read -p "Do you want to proceed with this resolution? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${CMD_COLOR}Resolution cancelled by user.${RESET}"
    exit 0
fi

# Perform resolution based on method
section "PERFORMING RESOLUTION"
echo -e "${CMD_COLOR}Resolving market with $RESOLUTION_TYPE method...${RESET}"

case $RESOLUTION_METHOD in
    1)
        # Admin Resolution (New format with ResolutionArgs)
        echo -e "${CMD_COLOR}Calling resolve_via_admin with ResolutionArgs record...${RESET}"
        RESOLUTION_RESULT=$(dfx canister call ${PREDICTION_MARKETS_CANISTER} resolve_via_admin \
            "(record { market_id = $MARKET_ID; winning_outcomes = $WINNING_OUTCOMES_VEC })" --network $DFX_NETWORK 2>&1)
        ;;
    2)
        # Admin Resolution Legacy (old format with individual parameters)
        echo -e "${CMD_COLOR}Calling resolve_via_admin_legacy...${RESET}"
        RESOLUTION_RESULT=$(dfx canister call ${PREDICTION_MARKETS_CANISTER} resolve_via_admin_legacy \
            "($MARKET_ID, $WINNING_OUTCOMES_VEC)" --network $DFX_NETWORK 2>&1)
        ;;
    3)
        # Oracle Resolution - Note: This method has different signature with blob parameter
        echo -e "${CMD_COLOR}Calling resolve_via_oracle...${RESET}"
        echo -e "${WARNING_COLOR}Note: Oracle resolution requires a blob parameter which is not implemented in this script${RESET}"
        RESOLUTION_RESULT="Error: Oracle resolution not fully implemented - requires blob parameter"
        ;;
    4)
        # Dual Resolution - Using propose_resolution which uses ResolutionArgs
        echo -e "${CMD_COLOR}Calling propose_resolution (dual method)...${RESET}"
        RESOLUTION_RESULT=$(dfx canister call ${PREDICTION_MARKETS_CANISTER} propose_resolution \
            "(record { market_id = $MARKET_ID; winning_outcomes = $WINNING_OUTCOMES_VEC })" --network $DFX_NETWORK 2>&1)
        ;;
esac

# Check resolution result
if [ $? -eq 0 ] && ([[ $RESOLUTION_RESULT == *"Success"* ]] || [[ $RESOLUTION_RESULT == *"Ok"* ]] || [[ $RESOLUTION_RESULT == *"AwaitingCreatorApproval"* ]] || [[ $RESOLUTION_RESULT == *"AwaitingAdminApproval"* ]]); then
    if [[ $RESOLUTION_RESULT == *"Success"* ]]; then
    echo -e "${CMD_COLOR}Status: ${RESET}${SUCCESS_COLOR}✓ RESOLUTION SUCCESSFUL${RESET}"
    echo -e "${CMD_COLOR}Result: ${RESET}${RESULT_COLOR}$RESOLUTION_RESULT${RESET}"
    RESOLUTION_SUCCESS=true
    elif [[ $RESOLUTION_RESULT == *"AwaitingCreatorApproval"* ]]; then
        echo -e "${CMD_COLOR}Status: ${RESET}${WARNING_COLOR}⏳ AWAITING CREATOR APPROVAL${RESET}"
        echo -e "${CMD_COLOR}Result: ${RESET}${RESULT_COLOR}$RESOLUTION_RESULT${RESET}"
        echo -e "${WARNING_COLOR}The admin has proposed a resolution. Waiting for the market creator to approve.${RESET}"
        RESOLUTION_SUCCESS=false
    elif [[ $RESOLUTION_RESULT == *"AwaitingAdminApproval"* ]]; then
        echo -e "${CMD_COLOR}Status: ${RESET}${WARNING_COLOR}⏳ AWAITING ADMIN APPROVAL${RESET}"
        echo -e "${CMD_COLOR}Result: ${RESET}${RESULT_COLOR}$RESOLUTION_RESULT${RESET}"
        echo -e "${WARNING_COLOR}The creator has proposed a resolution. Waiting for an admin to approve.${RESET}"
        RESOLUTION_SUCCESS=false
    else
        echo -e "${CMD_COLOR}Status: ${RESET}${SUCCESS_COLOR}✓ RESOLUTION ACCEPTED${RESET}"
        echo -e "${CMD_COLOR}Result: ${RESET}${RESULT_COLOR}$RESOLUTION_RESULT${RESET}"
        RESOLUTION_SUCCESS=true
    fi
else
    echo -e "${CMD_COLOR}Status: ${RESET}${ERROR_COLOR}✗ RESOLUTION FAILED${RESET}"
    echo -e "${CMD_COLOR}Error: ${RESET}${ERROR_COLOR}$RESOLUTION_RESULT${RESET}"
    RESOLUTION_SUCCESS=false
fi
echo ""

# Get updated market status
if [ "$RESOLUTION_SUCCESS" = true ]; then
    section "UPDATED MARKET STATUS"
    echo -e "${CMD_COLOR}Fetching updated market information...${RESET}"
    UPDATED_MARKET_INFO=$(dfx canister call ${PREDICTION_MARKETS_CANISTER} get_market "($MARKET_ID)" --network $DFX_NETWORK 2>/dev/null)
    
    if [[ $UPDATED_MARKET_INFO != "(null)" ]]; then
        # Extract market status
        MARKET_STATUS=$(echo "$UPDATED_MARKET_INFO" | grep -o 'status = variant { [^}]*}' | sed 's/status = variant { \(.*\) }/\1/')
        echo -e "${CMD_COLOR}Market Status: ${RESET}${RESULT_COLOR}$MARKET_STATUS${RESET}"
        
        # Check if it shows as resolved
        if [[ $MARKET_STATUS == *"Closed"* ]]; then
            echo -e "${SUCCESS_COLOR}✓ Market is now resolved (Closed)${RESET}"
        elif [[ $MARKET_STATUS == *"Resolved"* ]]; then
            echo -e "${SUCCESS_COLOR}✓ Market is now resolved${RESET}"
        else
            echo -e "${WARNING_COLOR}⚠ Market status: $MARKET_STATUS${RESET}"
        fi
    else
        echo -e "${ERROR_COLOR}Could not fetch updated market information${RESET}"
    fi
    echo ""
    
    # Suggest checking payouts
    section "NEXT STEPS"
    echo -e "${CMD_COLOR}Market has been resolved successfully!${RESET}"
    echo -e "${CMD_COLOR}You can now check user histories to see payouts:${RESET}"
    echo ""
    echo -e "${CMD_COLOR}To check a user's payout history:${RESET}"
    echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER get_user_history \"(principal \\\"USER_PRINCIPAL\\\")\" --network $DFX_NETWORK${RESET}"
    echo ""
    echo -e "${CMD_COLOR}To get all bets for this market:${RESET}"
    echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER get_market_bets \"($MARKET_ID)\" --network $DFX_NETWORK${RESET}"
fi

section "RESOLUTION SUMMARY"
echo -e "${CMD_COLOR}Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}Resolution Method: ${RESET}${RESULT_COLOR}$RESOLUTION_TYPE${RESET}"
echo -e "${CMD_COLOR}Winning Outcomes: ${RESET}${RESULT_COLOR}$WINNING_OUTCOMES_VEC${RESET}"

if [ "$RESOLUTION_SUCCESS" = true ]; then
    echo -e "${CMD_COLOR}Status: ${RESET}${SUCCESS_COLOR}✓ Resolution completed successfully!${RESET}"
else
    echo -e "${CMD_COLOR}Status: ${RESET}${ERROR_COLOR}✗ Resolution failed. Check the details above.${RESET}"
fi

echo ""
echo -e "${CMD_COLOR}Run this script again to resolve another market.${RESET}" 