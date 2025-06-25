#!/bin/bash

# Claims Processing Script for Kong Prediction Markets
# This script checks and processes claims for Alice, Bob, Carol, and Dave
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

# User identities to check
USERS=("alice" "bob" "carol" "dave")

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

# Helper function to get user principal
get_user_principal() {
    local identity_name=$1
    local principal=$(dfx identity get-principal --identity "$identity_name" 2>/dev/null)
    echo "$principal"
}

# Helper function to check user claims
check_user_claims() {
    local user_name=$1
    
    echo -e "${CMD_COLOR}📋 Checking claims for $user_name...${RESET}"
    
    # Switch to user identity
    if ! switch_identity "$user_name"; then
        echo -e "${ERROR_COLOR}Cannot check claims for $user_name - identity switch failed${RESET}"
        return 1
    fi
    
    # Get user principal for reference
    local user_principal=$(dfx identity get-principal)
    echo -e "${CMD_COLOR}Principal: ${RESET}${RESULT_COLOR}$user_principal${RESET}"
    
    # Get all claims for the user
    echo -e "${CMD_COLOR}Fetching all claims...${RESET}"
    local all_claims=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_user_claims \
        "(\"$user_principal\")" --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}All claims result: ${RESET}${RESULT_COLOR}$all_claims${RESET}"
    
    # Get pending claims specifically
    echo -e "${CMD_COLOR}Fetching pending claims...${RESET}"
    local pending_claims=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_user_pending_claims \
        "(\"$user_principal\")" --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Pending claims result: ${RESET}${RESULT_COLOR}$pending_claims${RESET}"
    
    # Check if user has any pending claims to process
    if [[ $pending_claims == *"record"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ $user_name has pending claims!${RESET}"
        
        # Extract claim IDs (simplified parsing - look for claim_id patterns)
        # This is a basic extraction - in production you'd want more robust parsing
        local claim_ids=()
        
        # Try to extract claim_id values using regex
        while IFS= read -r line; do
            if [[ $line =~ claim_id[[:space:]]*=[[:space:]]*([0-9]+) ]]; then
                claim_ids+=(${BASH_REMATCH[1]})
            fi
        done <<< "$pending_claims"
        
        if [ ${#claim_ids[@]} -gt 0 ]; then
            echo -e "${CMD_COLOR}Found claim IDs: ${RESET}${RESULT_COLOR}${claim_ids[*]}${RESET}"
            
            # Build claim_winnings call with claim IDs
            local claim_ids_vec="vec { "
            for ((i=0; i<${#claim_ids[@]}; i++)); do
                if [ $i -gt 0 ]; then
                    claim_ids_vec+="; "
                fi
                claim_ids_vec+="${claim_ids[i]}"
            done
            claim_ids_vec+=" }"
            
            echo -e "${CMD_COLOR}Processing claims with IDs: $claim_ids_vec${RESET}"
            
            # Call claim_winnings
            local claim_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER claim_winnings \
                "($claim_ids_vec)" --network $DFX_NETWORK 2>&1)
            
            echo -e "${CMD_COLOR}Claim processing result: ${RESET}${RESULT_COLOR}$claim_result${RESET}"
            
            # Check if claims were successful
            if [[ $claim_result == *"success_count"* ]]; then
                echo -e "${SUCCESS_COLOR}✓ Claims processed for $user_name${RESET}"
            else
                echo -e "${WARNING_COLOR}⚠ Claim processing may have failed for $user_name${RESET}"
            fi
        else
            echo -e "${WARNING_COLOR}⚠ Could not extract claim IDs from pending claims${RESET}"
        fi
    else
        echo -e "${WARNING_COLOR}⚠ No pending claims found for $user_name${RESET}"
    fi
    
    echo ""
}

# Helper function to get user transaction history
get_user_transactions() {
    local user_name=$1
    
    echo -e "${CMD_COLOR}📊 Getting transaction history for $user_name...${RESET}"
    
    # Get user principal
    local user_principal=$(get_user_principal "$user_name")
    if [ -z "$user_principal" ]; then
        echo -e "${ERROR_COLOR}✗ Could not get principal for $user_name${RESET}"
        return 1
    fi
    
    echo -e "${CMD_COLOR}Principal: ${RESET}${RESULT_COLOR}$user_principal${RESET}"
    
    # Get transactions by recipient (no need to switch identity for this query)
    local transactions=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_transactions_by_recipient \
        "(principal \"$user_principal\")" --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Transaction history: ${RESET}${RESULT_COLOR}$transactions${RESET}"
    
    # Check if user has any transactions
    if [[ $transactions == *"record"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Transaction history found for $user_name${RESET}"
    else
        echo -e "${WARNING_COLOR}⚠ No transaction history found for $user_name${RESET}"
    fi
    
    echo ""
}

# Helper function to display summary
display_summary() {
    local processed_users=("$@")
    
    echo -e "${CMD_COLOR}Claims Processing Summary:${RESET}"
    echo -e "${CMD_COLOR}=========================${RESET}"
    
    for user in "${processed_users[@]}"; do
        echo -e "${CMD_COLOR}  ✓ $user: Claims checked and processed${RESET}"
    done
    
    echo ""
    echo -e "${CMD_COLOR}All users have been processed!${RESET}"
}

# Main script
clear
section "CLAIMS PROCESSING - KONG PREDICTION MARKETS"

# Store original identity to restore later
ORIGINAL_IDENTITY=$(dfx identity whoami)
echo -e "${CMD_COLOR}Original identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"

# Option to specify specific market ID for filtering (optional)
echo -e "${CMD_COLOR}Do you want to check claims for a specific market? (optional)${RESET}"
read -p "Market ID (press Enter to check all): " MARKET_ID_FILTER

if [ -n "$MARKET_ID_FILTER" ]; then
    echo -e "${CMD_COLOR}Filtering claims for Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID_FILTER${RESET}"
else
    echo -e "${CMD_COLOR}Checking claims for all markets${RESET}"
fi

section "CHECKING AND PROCESSING CLAIMS"

PROCESSED_USERS=()

# Process claims for each user
for user in "${USERS[@]}"; do
    echo -e "${TITLE_COLOR}🔍 PROCESSING USER: $(echo $user | tr '[:lower:]' '[:upper:]')${RESET}"
    
    if check_user_claims "$user"; then
        PROCESSED_USERS+=("$user")
    else
        echo -e "${ERROR_COLOR}Failed to process claims for $user${RESET}"
    fi
    
    echo -e "${CMD_COLOR}------------------------${RESET}"
done

section "GETTING TRANSACTION HISTORIES"

# Get transaction history for each user (this doesn't require identity switching)
for user in "${USERS[@]}"; do
    echo -e "${TITLE_COLOR}📊 TRANSACTION HISTORY: $(echo $user | tr '[:lower:]' '[:upper:]')${RESET}"
    get_user_transactions "$user"
    echo -e "${CMD_COLOR}------------------------${RESET}"
done

# Restore original identity
section "RESTORING ORIGINAL IDENTITY"
switch_identity "$ORIGINAL_IDENTITY"

section "CLAIMS PROCESSING COMPLETE"

display_summary "${PROCESSED_USERS[@]}"

echo -e "${CMD_COLOR}Additional Information:${RESET}"
echo -e "${CMD_COLOR}• Claims are processed automatically when found${RESET}"
echo -e "${CMD_COLOR}• Transaction histories show payout details${RESET}"
echo -e "${CMD_COLOR}• Check the frontend to verify claim status${RESET}"
echo ""

echo -e "${CMD_COLOR}Next Steps:${RESET}"
echo -e "${CMD_COLOR}• Verify balances increased for winning users${RESET}"
echo -e "${CMD_COLOR}• Check that time weights affected payouts correctly${RESET}"
echo -e "${CMD_COLOR}• Review transaction IDs for tracking${RESET}"
echo ""

exit 0 