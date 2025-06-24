#!/bin/bash

# Void Market Script for Kong Prediction Markets
# This script allows administrators to void markets and refund all participants
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

# Helper function to get current identity
get_current_identity() {
    dfx identity whoami
}

# Helper function to verify market exists and get details
verify_market() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Verifying market $market_id exists...${RESET}"
    
    local market_details=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market \
        "($market_id)" --network $DFX_NETWORK 2>&1)
    
    if [[ $market_details == *"opt record"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market $market_id found${RESET}"
        
        # Extract and display basic market info
        echo -e "${CMD_COLOR}Market Details:${RESET}"
        
        # Try to extract market title (simplified parsing)
        local title=$(echo "$market_details" | grep -o 'title = "[^"]*"' | sed 's/title = "//;s/"//' | head -1)
        if [ -n "$title" ]; then
            echo -e "${CMD_COLOR}  Title: ${RESET}${RESULT_COLOR}$title${RESET}"
        fi
        
        # Try to extract market status
        local status=$(echo "$market_details" | grep -o 'status = variant { [^}]*' | sed 's/status = variant { //' | head -1)
        if [ -n "$status" ]; then
            echo -e "${CMD_COLOR}  Status: ${RESET}${RESULT_COLOR}$status${RESET}"
        fi
        
        # Try to extract total volume
        local volume=$(echo "$market_details" | grep -o 'total_volume = [0-9_]*' | sed 's/total_volume = //;s/_//g' | head -1)
        if [ -n "$volume" ]; then
            echo -e "${CMD_COLOR}  Total Volume: ${RESET}${RESULT_COLOR}$volume base units${RESET}"
        fi
        
        return 0
    elif [[ $market_details == "(null)" ]]; then
        echo -e "${ERROR_COLOR}✗ Market $market_id not found${RESET}"
        return 1
    else
        echo -e "${WARNING_COLOR}⚠ Could not verify market $market_id${RESET}"
        echo -e "${CMD_COLOR}Response: ${RESET}${ERROR_COLOR}$market_details${RESET}"
        return 1
    fi
}

# Helper function to get market bets
get_market_bets() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Checking bets for market $market_id...${RESET}"
    
    local bets=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market_bets \
        "($market_id)" --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Market bets: ${RESET}${RESULT_COLOR}$bets${RESET}"
    
    # Count number of bets (simplified - count "record" occurrences)
    local bet_count=$(echo "$bets" | grep -o "record" | wc -l | tr -d ' ')
    echo -e "${CMD_COLOR}Number of bets found: ${RESET}${RESULT_COLOR}$bet_count${RESET}"
    
    if [ "$bet_count" -gt 0 ]; then
        echo -e "${WARNING_COLOR}⚠ Market has $bet_count bet(s) - voiding will refund all participants${RESET}"
        return 0
    else
        echo -e "${CMD_COLOR}ℹ Market has no bets - safe to void${RESET}"
        return 0
    fi
}

# Helper function to void market
void_market() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Voiding market $market_id...${RESET}"
    echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER void_market \\${RESET}"
    echo -e "${EXEC_COLOR}  \"($market_id)\" --network $DFX_NETWORK${RESET}"
    echo ""
    
    local void_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER void_market \
        "($market_id)" --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Void result: ${RESET}${RESULT_COLOR}$void_result${RESET}"
    
    # Check if void was successful
    if [[ $void_result == *"Ok"* ]] || [[ $void_result == *"Success"* ]] || [[ $void_result == *"variant { Success"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market successfully voided!${RESET}"
        
        # Extract any transaction details if present
        if [[ $void_result == *"transaction_id"* ]]; then
            local tx_ids=$(echo "$void_result" | grep -o 'transaction_id = [0-9_]*' | sed 's/transaction_id = //;s/_//g')
            if [ -n "$tx_ids" ]; then
                echo -e "${CMD_COLOR}Refund transaction IDs:${RESET}"
                echo "$tx_ids" | while read -r tx_id; do
                    echo -e "${CMD_COLOR}  - ${RESET}${RESULT_COLOR}$tx_id${RESET}"
                done
            fi
        fi
        
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Market void failed${RESET}"
        echo -e "${CMD_COLOR}Error details: ${RESET}${ERROR_COLOR}$void_result${RESET}"
        return 1
    fi
}

# Helper function to verify void
verify_void() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Verifying market $market_id is voided...${RESET}"
    
    local market_details=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market \
        "($market_id)" --network $DFX_NETWORK 2>&1)
    
    if [[ $market_details == *"Voided"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market status confirmed as Voided${RESET}"
        return 0
    else
        echo -e "${WARNING_COLOR}⚠ Market status verification failed${RESET}"
        echo -e "${CMD_COLOR}Current status: ${RESET}${RESULT_COLOR}$market_details${RESET}"
        return 1
    fi
}

# Main script
clear
section "VOID MARKET - KONG PREDICTION MARKETS"

# Get current identity
CURRENT_IDENTITY=$(get_current_identity)
echo -e "${CMD_COLOR}Current dfx identity: ${RESET}${RESULT_COLOR}$CURRENT_IDENTITY${RESET}"

# Check if running as admin (you may want to add admin verification here)
echo -e "${WARNING_COLOR}⚠ Market voiding requires admin privileges${RESET}"
echo ""

# Get market ID from user input or command line argument
if [ $# -eq 1 ]; then
    MARKET_ID=$1
    echo -e "${CMD_COLOR}Using market ID from command line: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
else
    echo -e "${CMD_COLOR}Enter the market ID to void:${RESET}"
    read -p "Market ID: " MARKET_ID
fi

# Validate market ID is numeric
if ! [[ "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${ERROR_COLOR}✗ Invalid market ID: $MARKET_ID${RESET}"
    echo -e "${CMD_COLOR}Market ID must be a number${RESET}"
    exit 1
fi

echo -e "${CMD_COLOR}Market ID to void: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"

section "MARKET VERIFICATION"

# Verify market exists and get details
if ! verify_market "$MARKET_ID"; then
    echo -e "${ERROR_COLOR}Cannot proceed - market verification failed${RESET}"
    exit 1
fi

# Get market bets to warn about refunds
get_market_bets "$MARKET_ID"

section "VOID CONFIRMATION"

echo -e "${WARNING_COLOR}⚠ WARNING: MARKET VOIDING IS IRREVERSIBLE ⚠${RESET}"
echo ""
echo -e "${CMD_COLOR}Voiding market $MARKET_ID will:${RESET}"
echo -e "${CMD_COLOR}  • Set market status to Voided${RESET}"
echo -e "${CMD_COLOR}  • Refund all participants their bet amounts${RESET}"
echo -e "${CMD_COLOR}  • Make the market unresolvable${RESET}"
echo -e "${CMD_COLOR}  • This action cannot be undone${RESET}"
echo ""

read -p "Are you sure you want to void market $MARKET_ID? (y/n): " -r CONFIRM

if [[ ! $CONFIRM =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo -e "${WARNING_COLOR}Market void cancelled.${RESET}"
    exit 0
fi

section "VOIDING MARKET"

# Void the market
if void_market "$MARKET_ID"; then
    
    section "VERIFICATION"
    
    # Verify the void was successful
    if verify_void "$MARKET_ID"; then
        
        section "VOID COMPLETE"
        
        echo -e "${SUCCESS_COLOR}✓ Market $MARKET_ID successfully voided!${RESET}"
        echo ""
        echo -e "${CMD_COLOR}Summary:${RESET}"
        echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
        echo -e "${CMD_COLOR}  Status: ${RESET}${RESULT_COLOR}Voided${RESET}"
        echo -e "${CMD_COLOR}  Action: ${RESET}${RESULT_COLOR}All participants refunded${RESET}"
        echo -e "${CMD_COLOR}  Performed by: ${RESET}${RESULT_COLOR}$CURRENT_IDENTITY${RESET}"
        echo ""
        echo -e "${CMD_COLOR}Next steps:${RESET}"
        echo -e "${CMD_COLOR}  • All bet participants have been refunded${RESET}"
        echo -e "${CMD_COLOR}  • Market is now permanently voided${RESET}"
        echo -e "${CMD_COLOR}  • Check transaction logs for refund details${RESET}"
        
    else
        echo -e "${WARNING_COLOR}⚠ Market void may have failed - please verify manually${RESET}"
    fi
    
else
    echo -e "${ERROR_COLOR}✗ Market void operation failed${RESET}"
    exit 1
fi

echo ""
exit 0

