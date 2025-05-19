#!/bin/bash
# token_balance_check.sh - Token balance reconciliation tool
# This script allows admins to check the balance reconciliation status of all tokens
# in the prediction markets canister.

# Set up colors for better output formatting - with fallbacks if tput fails
if [ -t 1 ]; then
    # Only use colors when outputting to a terminal
    TITLE_COLOR=$(tput bold 2>/dev/null && tput setaf 6 2>/dev/null || echo '')
    CMD_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    EXEC_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    RESULT_COLOR=$(tput setaf 4 2>/dev/null || echo '')
    ERROR_COLOR=$(tput setaf 1 2>/dev/null || echo '')
    RESET=$(tput sgr0 2>/dev/null || echo '')
else
    # No colors when piping to a file
    TITLE_COLOR=''
    CMD_COLOR=''
    EXEC_COLOR=''
    RESULT_COLOR=''
    ERROR_COLOR=''
    RESET=''
fi

# Default settings
REFRESH=false
FORMAT="readable"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --refresh)
            REFRESH=true
            shift
            ;;
        --json)
            FORMAT="json"
            shift
            ;;
        --help)
            echo "Usage: $0 [--refresh] [--json]"
            echo ""
            echo "Options:"
            echo "  --refresh    Calculate new balance reconciliation (slower)"
            echo "               Without this flag, returns the latest cached data"
            echo "  --json       Output in JSON format instead of human-readable"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Function to print section titles
section() {
    echo -e "${TITLE_COLOR}==== $1 ====${RESET}"
}

# Main function
section "TOKEN BALANCE RECONCILIATION"

if [ "$REFRESH" = true ]; then
    echo -e "${CMD_COLOR}Calculating new token balance reconciliation...${RESET}"
    echo -e "${EXEC_COLOR}$ dfx canister call prediction_markets_backend calculate_token_balance_reconciliation${RESET}"
    RESULT=$(dfx canister call prediction_markets_backend calculate_token_balance_reconciliation)
    if [ $? -ne 0 ]; then
        echo -e "${ERROR_COLOR}Error: Failed to calculate token balance reconciliation.${RESET}"
        echo -e "${ERROR_COLOR}Make sure the dfx environment is properly set up and the canister is deployed.${RESET}"
        exit 1
    fi
else
    echo -e "${CMD_COLOR}Getting latest token balance reconciliation...${RESET}"
    echo -e "${EXEC_COLOR}$ dfx canister call prediction_markets_backend get_latest_token_balance_reconciliation${RESET}"
    RESULT=$(dfx canister call prediction_markets_backend get_latest_token_balance_reconciliation)
    if [ $? -ne 0 ]; then
        echo -e "${ERROR_COLOR}Error: Failed to get latest token balance reconciliation.${RESET}"
        echo -e "${ERROR_COLOR}Make sure the dfx environment is properly set up and the canister is deployed.${RESET}"
        exit 1
    fi
fi

# Check if we got a result
if [[ $RESULT == *"(null)"* ]]; then
    echo -e "${ERROR_COLOR}No reconciliation data available. Run with --refresh to calculate.${RESET}"
    exit 0
fi

# Format output
if [ "$FORMAT" = "json" ]; then
    echo -e "${RESULT_COLOR}$RESULT${RESET}"
else
    # Process and format the output for better readability
    echo -e "${RESULT_COLOR}"
    
    # Extract timestamp
    TIMESTAMP=$(echo "$RESULT" | grep -o "timestamp = [0-9_]*" | head -1 | awk '{print $3}' | tr -d '_')
    if [ -n "$TIMESTAMP" ]; then
        # Convert nanoseconds to human-readable time
        TIMESTAMP_SEC=$((TIMESTAMP / 1000000000))
        # Try different date command formats (macOS vs Linux compatibility)
        if date -r $TIMESTAMP_SEC &>/dev/null; then
            # macOS style
            HUMAN_TIME=$(date -r $TIMESTAMP_SEC)
        elif date -d @$TIMESTAMP_SEC &>/dev/null; then
            # Linux style
            HUMAN_TIME=$(date -d @$TIMESTAMP_SEC)
        else
            # Fallback
            HUMAN_TIME="$TIMESTAMP_SEC seconds since epoch ($(date))"
        fi
        section "SUMMARY"
        echo "Reconciliation Time: $HUMAN_TIME"
        echo "Timestamp: $TIMESTAMP"
        echo ""
    fi
    
    # Extract token details
    section "TOKEN BALANCES"
    
    # Simplified output for readability
    if [[ "$RESULT" == *"token_summaries"* ]]; then
        # Iterate through each token summary
        TOKEN_COUNT=$(echo "$RESULT" | grep -o 'token_id = "[^"]*"' | wc -l)
        
        if [ "$TOKEN_COUNT" -eq 0 ]; then
            echo -e "${ERROR_COLOR}No token data found in the response.${RESET}"
            echo -e "${ERROR_COLOR}Try running with --refresh to get updated data.${RESET}"
            exit 1
        fi
        
        echo -e "${CMD_COLOR}Found data for $TOKEN_COUNT token(s)${RESET}\n"
        
        # Extract each token section
        echo "$RESULT" | grep -A 50 'record {' | while read -r line; do
            if [[ $line == *"token_symbol"* ]]; then
                TOKEN=$(echo "$line" | grep -o '"[^"]*"' | head -1 | tr -d '"')
                echo -e "\n${TITLE_COLOR}Token: $TOKEN${RESET}"
            elif [[ $line == *"actual_balance"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                ACTUAL=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                echo -e "  ${CMD_COLOR}Actual Balance:   ${RESULT_COLOR}$ACTUAL${RESET}"
            elif [[ $line == *"expected_balance"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                EXPECTED=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                echo -e "  ${CMD_COLOR}Expected Balance: ${RESULT_COLOR}$EXPECTED${RESET}"
            elif [[ $line == *"difference"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                DIFF=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                echo -e "  ${CMD_COLOR}Difference:       ${RESULT_COLOR}$DIFF${RESET}"
            elif [[ $line == *"is_sufficient"* ]]; then
                if [[ $line == *"true"* ]]; then
                    echo -e "  ${CMD_COLOR}Balance Status:   ${EXEC_COLOR}✓ SUFFICIENT${RESET}"
                else
                    echo -e "  ${CMD_COLOR}Balance Status:   ${ERROR_COLOR}✗ INSUFFICIENT${RESET}"
                fi
            elif [[ $line == *"breakdown"* ]]; then
                echo -e "  ${CMD_COLOR}Breakdown:${RESET}"
            elif [[ $line == *"active_markets"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                VAL=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                [[ -n "$VAL" ]] && echo -e "    ${RESULT_COLOR}• Active Markets:           $VAL${RESET}"
            elif [[ $line == *"pending_markets"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                VAL=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                [[ -n "$VAL" ]] && echo -e "    ${RESULT_COLOR}• Pending Markets:          $VAL${RESET}"
            elif [[ $line == *"resolved_markets_unclaimed"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                VAL=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                [[ -n "$VAL" ]] && echo -e "    ${RESULT_COLOR}• Unclaimed (Resolved):     $VAL${RESET}"
            elif [[ $line == *"voided_markets_unclaimed"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                VAL=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                [[ -n "$VAL" ]] && echo -e "    ${RESULT_COLOR}• Unclaimed (Voided):       $VAL${RESET}"
            elif [[ $line == *"pending_claims"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                VAL=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                [[ -n "$VAL" ]] && echo -e "    ${RESULT_COLOR}• Pending Claims:           $VAL${RESET}"
            elif [[ $line == *"platform_fees"* ]]; then
                # Extract value between "=" and ";" to get the full formatted number
                VAL=$(echo "$line" | sed -n 's/.*= \(.*\);.*/\1/p' | sed 's/^ *//;s/ *$//')
                [[ -n "$VAL" ]] && echo -e "    ${RESULT_COLOR}• Platform Fees:            $VAL${RESET}\n"
            fi
        done
    else
        echo -e "${ERROR_COLOR}Unexpected response format. Try running with --json to see raw output.${RESET}"
        exit 1
    fi
    
    echo "================================="
    echo "Run with --json for detailed breakdown"
fi
