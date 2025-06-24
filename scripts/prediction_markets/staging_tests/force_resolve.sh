#!/bin/bash

# Force Resolve Market Script for Kong Prediction Markets
# This script allows administrators to force resolve markets when normal resolution fails
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

# Ensure we start with default identity
dfx identity use default > /dev/null 2>&1

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
        
        # Store market details for later parsing
        MARKET_DETAILS="$market_details"
        
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
            
            # Check if market can be force resolved
            if [[ $status == *"Active"* ]] || [[ $status == *"Closed"* ]]; then
                echo -e "${SUCCESS_COLOR}✓ Market can be force resolved${RESET}"
            elif [[ $status == *"Resolved"* ]]; then
                echo -e "${WARNING_COLOR}⚠ Market is already resolved${RESET}"
                return 2
            elif [[ $status == *"Voided"* ]]; then
                echo -e "${ERROR_COLOR}✗ Market is voided and cannot be resolved${RESET}"
                return 1
            else
                echo -e "${WARNING_COLOR}⚠ Market status may not allow resolution${RESET}"
            fi
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

# Helper function to extract and display market outcomes
get_market_outcomes() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Extracting market outcomes...${RESET}"
    
    # Debug: Show the raw market details to understand the format
    echo -e "${CMD_COLOR}Debug - Raw market details:${RESET}"
    echo "$MARKET_DETAILS" | head -20
    echo ""
    
    # Parse outcomes from market details - try multiple patterns
    OUTCOMES_ARRAY=()
    local outcome_count=0
    
    # Method 1: Look for outcomes = vec pattern
    local outcomes_section=$(echo "$MARKET_DETAILS" | grep -A 50 "outcomes = vec")
    
    if [ -n "$outcomes_section" ]; then
        echo -e "${CMD_COLOR}Found outcomes section:${RESET}"
        echo "$outcomes_section" | head -10
        echo ""
        
        # Extract quoted strings as outcomes from the outcomes section
        while IFS= read -r line; do
            if [[ $line =~ \"([^\"]+)\" ]]; then
                OUTCOMES_ARRAY+=("${BASH_REMATCH[1]}")
                echo -e "${CMD_COLOR}  $outcome_count: ${RESET}${RESULT_COLOR}${BASH_REMATCH[1]}${RESET}"
                outcome_count=$((outcome_count + 1))
            fi
        done <<< "$outcomes_section"
    fi
    
    # Method 2: If Method 1 failed, try extracting all quoted strings from the entire market data
    if [ ${#OUTCOMES_ARRAY[@]} -eq 0 ]; then
        echo -e "${CMD_COLOR}Method 1 failed, trying Method 2: Extract all quoted strings...${RESET}"
        
        # Extract all quoted strings and filter for likely outcomes
        local all_quotes=$(echo "$MARKET_DETAILS" | grep -o '"[^"]*"' | sed 's/"//g')
        
        echo -e "${CMD_COLOR}All quoted strings found:${RESET}"
        echo "$all_quotes"
        echo ""
        
        # Common outcome patterns - add "Yes" and "No" as they're most common
        if echo "$all_quotes" | grep -q "Yes"; then
            OUTCOMES_ARRAY+=("Yes")
            echo -e "${CMD_COLOR}  $outcome_count: ${RESET}${RESULT_COLOR}Yes${RESET}"
            outcome_count=$((outcome_count + 1))
        fi
        
        if echo "$all_quotes" | grep -q "No"; then
            OUTCOMES_ARRAY+=("No")
            echo -e "${CMD_COLOR}  $outcome_count: ${RESET}${RESULT_COLOR}No${RESET}"
            outcome_count=$((outcome_count + 1))
        fi
        
        # Add any other outcomes that aren't the title or rules
        while IFS= read -r quote; do
            if [ -n "$quote" ] && [ "$quote" != "Yes" ] && [ "$quote" != "No" ]; then
                # Skip if it looks like a title (contains question marks or is very long)
                if [[ ! "$quote" =~ \? ]] && [ ${#quote} -lt 50 ]; then
                    # Check if it's not already in the array
                    local already_added=false
                    local i=0
                    while [ $i -lt ${#OUTCOMES_ARRAY[@]} ]; do
                        if [ "${OUTCOMES_ARRAY[i]}" = "$quote" ]; then
                            already_added=true
                            break
                        fi
                        i=$((i + 1))
                    done
                    
                    if [ "$already_added" = false ]; then
                        OUTCOMES_ARRAY+=("$quote")
                        echo -e "${CMD_COLOR}  $outcome_count: ${RESET}${RESULT_COLOR}$quote${RESET}"
                        outcome_count=$((outcome_count + 1))
                    fi
                fi
            fi
        done <<< "$all_quotes"
    fi
    
    # Method 3: If still no outcomes, provide default Yes/No
    if [ ${#OUTCOMES_ARRAY[@]} -eq 0 ]; then
        echo -e "${WARNING_COLOR}⚠ Could not extract outcomes from market data, using default Yes/No${RESET}"
        OUTCOMES_ARRAY=("Yes" "No")
        echo -e "${CMD_COLOR}  0: ${RESET}${RESULT_COLOR}Yes${RESET}"
        echo -e "${CMD_COLOR}  1: ${RESET}${RESULT_COLOR}No${RESET}"
    fi
    
    if [ ${#OUTCOMES_ARRAY[@]} -gt 0 ]; then
        echo -e "${SUCCESS_COLOR}✓ Found ${#OUTCOMES_ARRAY[@]} outcome(s)${RESET}"
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Could not extract outcomes${RESET}"
        return 1
    fi
}

# Helper function to get market bets for context
get_market_bets() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Checking bets for market $market_id...${RESET}"
    
    local bets=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market_bets \
        "($market_id)" --network $DFX_NETWORK 2>&1)
    
    # Count number of bets (simplified - count "record" occurrences)
    local bet_count=$(echo "$bets" | grep -o "record" | wc -l | tr -d ' ')
    echo -e "${CMD_COLOR}Number of bets: ${RESET}${RESULT_COLOR}$bet_count${RESET}"
    
    if [ "$bet_count" -gt 0 ]; then
        echo -e "${CMD_COLOR}ℹ Market has $bet_count bet(s) - resolution will distribute winnings${RESET}"
        
        # Show bet distribution by outcome (simplified)
        local i=0
        while [ $i -lt ${#OUTCOMES_ARRAY[@]} ]; do
            local outcome_bets=$(echo "$bets" | grep -c "outcome_index = $i" || echo "0")
            echo -e "${CMD_COLOR}  ${OUTCOMES_ARRAY[i]}: ${RESET}${RESULT_COLOR}$outcome_bets bet(s)${RESET}"
            i=$((i + 1))
        done
        
        return 0
    else
        echo -e "${WARNING_COLOR}⚠ Market has no bets - resolution will have no effect${RESET}"
        return 0
    fi
}

# Helper function to select winning outcomes
select_winning_outcomes() {
    echo -e "${CMD_COLOR}Select the winning outcome(s):${RESET}"
    echo ""
    
    # Display available outcomes
    local i=0
    while [ $i -lt ${#OUTCOMES_ARRAY[@]} ]; do
        echo -e "${CMD_COLOR}  $i) ${RESET}${RESULT_COLOR}${OUTCOMES_ARRAY[i]}${RESET}"
        i=$((i + 1))
    done
    echo ""
    
    # Get winning outcome selection
    local max_index=$((${#OUTCOMES_ARRAY[@]} - 1))
    echo -e "${CMD_COLOR}Enter winning outcome index (0-$max_index):${RESET}"
    read -p "Winning outcome: " WINNING_OUTCOME
    
    # Validate selection
    if ! [[ "$WINNING_OUTCOME" =~ ^[0-9]+$ ]]; then
        echo -e "${ERROR_COLOR}✗ Invalid selection: $WINNING_OUTCOME${RESET}"
        return 1
    fi
    
    if [ "$WINNING_OUTCOME" -ge ${#OUTCOMES_ARRAY[@]} ] || [ "$WINNING_OUTCOME" -lt 0 ]; then
        echo -e "${ERROR_COLOR}✗ Outcome index out of range: $WINNING_OUTCOME${RESET}"
        return 1
    fi
    
    echo -e "${SUCCESS_COLOR}✓ Selected winning outcome: ${OUTCOMES_ARRAY[WINNING_OUTCOME]}${RESET}"
    return 0
}

# Helper function to force resolve market
force_resolve_market() {
    local market_id=$1
    local winning_outcome=$2
    
    echo -e "${CMD_COLOR}Force resolving market $market_id...${RESET}"
    echo -e "${CMD_COLOR}Winning outcome: ${RESET}${RESULT_COLOR}${OUTCOMES_ARRAY[winning_outcome]}${RESET}"
    echo ""
    
    echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER force_resolve_market \\${RESET}"
    echo -e "${EXEC_COLOR}  '(record { market_id = $market_id; winning_outcomes = vec {$winning_outcome}; })' \\${RESET}"
    echo -e "${EXEC_COLOR}  --network $DFX_NETWORK${RESET}"
    echo ""
    
    local resolve_result=$(dfx canister call $PREDICTION_MARKETS_CANISTER force_resolve_market \
        "(record { market_id = $market_id; winning_outcomes = vec {$winning_outcome}; })" \
        --network $DFX_NETWORK 2>&1)
    
    echo -e "${CMD_COLOR}Force resolve result: ${RESET}${RESULT_COLOR}$resolve_result${RESET}"
    
    # Check if resolution was successful
    if [[ $resolve_result == *"Ok"* ]] || [[ $resolve_result == *"Success"* ]] || [[ $resolve_result == *"variant { Success"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market successfully force resolved!${RESET}"
        
        # Extract any transaction details if present
        if [[ $resolve_result == *"transaction_id"* ]]; then
            local tx_ids=$(echo "$resolve_result" | grep -o 'transaction_id = [0-9_]*' | sed 's/transaction_id = //;s/_//g')
            if [ -n "$tx_ids" ]; then
                echo -e "${CMD_COLOR}Payout transaction IDs:${RESET}"
                echo "$tx_ids" | while read -r tx_id; do
                    echo -e "${CMD_COLOR}  - ${RESET}${RESULT_COLOR}$tx_id${RESET}"
                done
            fi
        fi
        
        return 0
    else
        echo -e "${ERROR_COLOR}✗ Market force resolution failed${RESET}"
        echo -e "${CMD_COLOR}Error details: ${RESET}${ERROR_COLOR}$resolve_result${RESET}"
        return 1
    fi
}

# Helper function to verify resolution
verify_resolution() {
    local market_id=$1
    
    echo -e "${CMD_COLOR}Verifying market $market_id is resolved...${RESET}"
    
    local market_details=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market \
        "($market_id)" --network $DFX_NETWORK 2>&1)
    
    if [[ $market_details == *"Resolved"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market status confirmed as Resolved${RESET}"
        
        # Try to extract winning outcome
        local winning_outcome=$(echo "$market_details" | grep -o 'winning_outcome = opt [0-9]*' | sed 's/winning_outcome = opt //' | head -1)
        if [ -n "$winning_outcome" ]; then
            echo -e "${CMD_COLOR}Winning outcome: ${RESET}${RESULT_COLOR}$winning_outcome (${OUTCOMES_ARRAY[winning_outcome]})${RESET}"
        fi
        
        return 0
    else
        echo -e "${WARNING_COLOR}⚠ Market resolution verification failed${RESET}"
        echo -e "${CMD_COLOR}Current status: ${RESET}${RESULT_COLOR}$market_details${RESET}"
        return 1
    fi
}

# Main script
clear
section "FORCE RESOLVE MARKET - KONG PREDICTION MARKETS"

# Get current identity
CURRENT_IDENTITY=$(get_current_identity)
echo -e "${CMD_COLOR}Current dfx identity: ${RESET}${RESULT_COLOR}$CURRENT_IDENTITY${RESET}"

# Check if running as admin
echo -e "${WARNING_COLOR}⚠ Force resolution requires admin privileges${RESET}"
echo ""

# Get market ID from user input or command line argument
if [ $# -ge 1 ]; then
    MARKET_ID=$1
    echo -e "${CMD_COLOR}Using market ID from command line: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
    
    # If outcome provided as second argument
    if [ $# -ge 2 ]; then
        OUTCOME_ARG=$2
        echo -e "${CMD_COLOR}Using outcome from command line: ${RESET}${RESULT_COLOR}$OUTCOME_ARG${RESET}"
    fi
else
    echo -e "${CMD_COLOR}Enter the market ID to force resolve:${RESET}"
    read -p "Market ID: " MARKET_ID
fi

# Validate market ID is numeric
if ! [[ "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${ERROR_COLOR}✗ Invalid market ID: $MARKET_ID${RESET}"
    echo -e "${CMD_COLOR}Market ID must be a number${RESET}"
    exit 1
fi

echo -e "${CMD_COLOR}Market ID to force resolve: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"

section "MARKET VERIFICATION"

# Verify market exists and get details
VERIFY_RESULT=$(verify_market "$MARKET_ID")
VERIFY_EXIT_CODE=$?

if [ $VERIFY_EXIT_CODE -eq 1 ]; then
    echo -e "${ERROR_COLOR}Cannot proceed - market verification failed${RESET}"
    exit 1
elif [ $VERIFY_EXIT_CODE -eq 2 ]; then
    echo -e "${WARNING_COLOR}Market is already resolved${RESET}"
    read -p "Do you want to force resolve it anyway? (y/N): " -n 1 -r FORCE_ANYWAY
    echo ""
    if [[ ! $FORCE_ANYWAY =~ ^[Yy]$ ]]; then
        echo -e "${WARNING_COLOR}Force resolution cancelled.${RESET}"
        exit 0
    fi
fi

# Extract market outcomes
if ! get_market_outcomes "$MARKET_ID"; then
    echo -e "${ERROR_COLOR}Cannot proceed - could not extract market outcomes${RESET}"
    exit 1
fi

# Get market bets for context
get_market_bets "$MARKET_ID"

section "OUTCOME SELECTION"

# Select winning outcome
if [ -n "$OUTCOME_ARG" ]; then
    # Validate command line outcome
    if ! [[ "$OUTCOME_ARG" =~ ^[0-9]+$ ]] || [ "$OUTCOME_ARG" -ge ${#OUTCOMES_ARRAY[@]} ] || [ "$OUTCOME_ARG" -lt 0 ]; then
        echo -e "${ERROR_COLOR}✗ Invalid outcome from command line: $OUTCOME_ARG${RESET}"
        exit 1
    fi
    WINNING_OUTCOME=$OUTCOME_ARG
    echo -e "${CMD_COLOR}Using outcome from command line: ${RESET}${RESULT_COLOR}${OUTCOMES_ARRAY[WINNING_OUTCOME]}${RESET}"
else
    # Interactive outcome selection
    if ! select_winning_outcomes; then
        echo -e "${ERROR_COLOR}Invalid outcome selection${RESET}"
        exit 1
    fi
fi

section "RESOLUTION CONFIRMATION"

echo -e "${WARNING_COLOR}⚠ WARNING: FORCE RESOLUTION IS IRREVERSIBLE ⚠${RESET}"
echo ""
echo -e "${CMD_COLOR}Force resolving market $MARKET_ID will:${RESET}"
echo -e "${CMD_COLOR}  • Set market status to Resolved${RESET}"
echo -e "${CMD_COLOR}  • Set '${OUTCOMES_ARRAY[WINNING_OUTCOME]}' as the winning outcome${RESET}"
echo -e "${CMD_COLOR}  • Distribute winnings to correct outcome bettors${RESET}"
echo -e "${CMD_COLOR}  • This action cannot be undone${RESET}"
echo ""

read -p "Are you sure you want to force resolve market $MARKET_ID? (y/n): " -r CONFIRM

if [[ ! $CONFIRM =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo -e "${WARNING_COLOR}Force resolution cancelled.${RESET}"
    exit 0
fi

section "FORCE RESOLVING MARKET"

# Force resolve the market
if force_resolve_market "$MARKET_ID" "$WINNING_OUTCOME"; then
    
    section "VERIFICATION"
    
    # Verify the resolution was successful
    if verify_resolution "$MARKET_ID"; then
        
        section "RESOLUTION COMPLETE"
        
        echo -e "${SUCCESS_COLOR}✓ Market $MARKET_ID successfully force resolved!${RESET}"
        echo ""
        echo -e "${CMD_COLOR}Summary:${RESET}"
        echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
        echo -e "${CMD_COLOR}  Status: ${RESET}${RESULT_COLOR}Resolved${RESET}"
        echo -e "${CMD_COLOR}  Winning Outcome: ${RESET}${RESULT_COLOR}${OUTCOMES_ARRAY[WINNING_OUTCOME]}${RESET}"
        echo -e "${CMD_COLOR}  Resolved by: ${RESET}${RESULT_COLOR}$CURRENT_IDENTITY (force)${RESET}"
        echo ""
        echo -e "${CMD_COLOR}Next steps:${RESET}"
        echo -e "${CMD_COLOR}  • Winners have been paid out automatically${RESET}"
        echo -e "${CMD_COLOR}  • Market is now permanently resolved${RESET}"
        echo -e "${CMD_COLOR}  • Check transaction logs for payout details${RESET}"
        
    else
        echo -e "${WARNING_COLOR}⚠ Market resolution may have failed - please verify manually${RESET}"
    fi
    
else
    echo -e "${ERROR_COLOR}✗ Market force resolution operation failed${RESET}"
    exit 1
fi

echo ""
exit 0