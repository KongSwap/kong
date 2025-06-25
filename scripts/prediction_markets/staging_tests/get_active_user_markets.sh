#!/bin/bash

# Get Active User Markets Script for Kong Prediction Markets
# This script fetches active markets for a specific user
set -e

# Ensure we start with default identity
dfx identity use default > /dev/null 2>&1

# Color definitions for better output formatting
if [ -t 1 ]; then
    TITLE_COLOR=$(tput bold 2>/dev/null && tput setaf 6 2>/dev/null || echo '')
    CMD_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    EXEC_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    RESULT_COLOR=$(tput setaf 4 2>/dev/null || echo '')
    ERROR_COLOR=$(tput setaf 1 2>/dev/null || echo '')
    SUCCESS_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    WARNING_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    INFO_COLOR=$(tput setaf 5 2>/dev/null || echo '')
    RESET=$(tput sgr0 2>/dev/null || echo '')
else
    TITLE_COLOR=""
    CMD_COLOR=""
    EXEC_COLOR=""
    RESULT_COLOR=""
    ERROR_COLOR=""
    SUCCESS_COLOR=""
    WARNING_COLOR=""
    INFO_COLOR=""
    RESET=""
fi

# Configuration
PREDICTION_MARKETS_CANISTER="qqoq7-zaaaa-aaaan-qzzvq-cai"
DFX_NETWORK=ic

# Helper function to print section headers
section() {
    echo ""
    echo -e "${TITLE_COLOR}═══ $1 ═══${RESET}"
    echo ""
}

# Function to get user input for principal
get_user_principal() {
    echo -e "${CMD_COLOR}Enter the user principal to query:${RESET}"
    echo -e "${INFO_COLOR}(Example: 4jxje-hbmra-4otqc-6hor3-cpwlh-sqymk-6h4ef-42sqn-o3ip5-s3mxk-uae)${RESET}"
    read -r USER_PRINCIPAL
    
    if [ -z "$USER_PRINCIPAL" ]; then
        echo -e "${ERROR_COLOR}Error: Principal cannot be empty${RESET}"
        exit 1
    fi
}

# Function to get pagination parameters
get_pagination_params() {
    echo -e "${CMD_COLOR}Enter start index (default: 0):${RESET}"
    read -r START_INDEX
    START_INDEX=${START_INDEX:-0}
    
    echo -e "${CMD_COLOR}Enter number of markets to fetch (default: 10):${RESET}"
    read -r LIMIT
    LIMIT=${LIMIT:-10}
}

# Function to get sort option
get_sort_option() {
    echo -e "${CMD_COLOR}Select sort option:${RESET}"
    echo -e "${INFO_COLOR}1) Creation time (newest first) - Default${RESET}"
    echo -e "${INFO_COLOR}2) Creation time (oldest first)${RESET}"
    echo -e "${INFO_COLOR}3) Total pool (largest first)${RESET}"
    echo -e "${INFO_COLOR}4) Total pool (smallest first)${RESET}"
    echo -e "${INFO_COLOR}5) End time (ending soonest first)${RESET}"
    echo -e "${INFO_COLOR}6) End time (ending latest first)${RESET}"
    echo -e "${CMD_COLOR}Enter your choice (1-6, or press Enter for default):${RESET}"
    
    read -r SORT_CHOICE
    
    case $SORT_CHOICE in
        1|"")
            SORT_OPTION='opt variant { CreatedAt = variant { Descending } }'
            SORT_DESC="Creation time (newest first)"
            ;;
        2)
            SORT_OPTION='opt variant { CreatedAt = variant { Ascending } }'
            SORT_DESC="Creation time (oldest first)"
            ;;
        3)
            SORT_OPTION='opt variant { TotalPool = variant { Descending } }'
            SORT_DESC="Total pool (largest first)"
            ;;
        4)
            SORT_OPTION='opt variant { TotalPool = variant { Ascending } }'
            SORT_DESC="Total pool (smallest first)"
            ;;
        5)
            SORT_OPTION='opt variant { EndTime = variant { Ascending } }'
            SORT_DESC="End time (ending soonest first)"
            ;;
        6)
            SORT_OPTION='opt variant { EndTime = variant { Descending } }'
            SORT_DESC="End time (ending latest first)"
            ;;
        *)
            echo -e "${WARNING_COLOR}Invalid choice. Using default (newest first).${RESET}"
            SORT_OPTION='opt variant { CreatedAt = variant { Descending } }'
            SORT_DESC="Creation time (newest first)"
            ;;
    esac
}

# Main execution
section "GET ACTIVE USER MARKETS - KONG PREDICTION MARKETS"

echo -e "${INFO_COLOR}This script fetches active markets for a specific user${RESET}"
echo -e "${INFO_COLOR}Markets are filtered to only show Active status${RESET}"
echo -e "${INFO_COLOR}Results include markets where the user is creator or has placed bets${RESET}"
echo ""

get_user_principal
get_pagination_params
get_sort_option

echo ""
echo -e "${CMD_COLOR}Configuration Summary:${RESET}"
echo -e "${CMD_COLOR}User Principal: ${RESET}${WARNING_COLOR}$USER_PRINCIPAL${RESET}"
echo -e "${CMD_COLOR}Start Index: ${RESET}${WARNING_COLOR}$START_INDEX${RESET}"
echo -e "${CMD_COLOR}Limit: ${RESET}${WARNING_COLOR}$LIMIT${RESET}"
echo -e "${CMD_COLOR}Sort Option: ${RESET}${WARNING_COLOR}$SORT_DESC${RESET}"
echo -e "${CMD_COLOR}Network: ${RESET}${WARNING_COLOR}$DFX_NETWORK${RESET}"
echo ""

# Confirm execution
echo -e "${CMD_COLOR}Proceed with query? (y/n):${RESET}"
read -r CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo -e "${WARNING_COLOR}Query cancelled.${RESET}"
    exit 0
fi

section "EXECUTING QUERY"

echo -e "${CMD_COLOR}Calling get_active_user_markets on prediction markets canister...${RESET}"
echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER get_active_user_markets \\\\${RESET}"
echo -e "${EXEC_COLOR}  \"(record { user = principal \\\"$USER_PRINCIPAL\\\"; start = $START_INDEX; length = $LIMIT; sort_option = $SORT_OPTION })\" \\\\${RESET}"
echo -e "${EXEC_COLOR}  --network $DFX_NETWORK${RESET}"
echo ""

# Execute the call
USER_MARKETS_RESULT=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_active_user_markets \
    "(record { user = principal \"$USER_PRINCIPAL\"; start = $START_INDEX; length = $LIMIT; sort_option = $SORT_OPTION })" \
    --network $DFX_NETWORK 2>&1)

# Check if the call was successful
if [ $? -eq 0 ]; then
    echo -e "${SUCCESS_COLOR}✓ Query successful${RESET}"
    echo ""
    
    # Extract total count from the result
    TOTAL_COUNT=$(echo "$USER_MARKETS_RESULT" | grep -o 'total_count = [0-9]*' | grep -o '[0-9]*' || echo "0")
    
    # Extract market count from the result
    MARKET_COUNT=$(echo "$USER_MARKETS_RESULT" | grep -o 'markets = vec {' -A 1000 | grep -o 'record {' | wc -l | tr -d ' ')
    
    echo -e "${CMD_COLOR}Results Summary:${RESET}"
    echo -e "${CMD_COLOR}Total Active Markets for User: ${RESET}${SUCCESS_COLOR}$TOTAL_COUNT${RESET}"
    echo -e "${CMD_COLOR}Markets Returned (page): ${RESET}${SUCCESS_COLOR}$MARKET_COUNT${RESET}"
    echo ""
    
    if [ "$MARKET_COUNT" -gt 0 ]; then
        echo -e "${CMD_COLOR}Raw Response:${RESET}"
        echo -e "${RESULT_COLOR}$USER_MARKETS_RESULT${RESET}"
    else
        echo -e "${WARNING_COLOR}No active markets found for this user.${RESET}"
        echo -e "${INFO_COLOR}This could mean:${RESET}"
        echo -e "${INFO_COLOR}• User has not created any active markets${RESET}"
        echo -e "${INFO_COLOR}• User has not placed bets on any active markets${RESET}"
        echo -e "${INFO_COLOR}• All user's markets have expired or been resolved${RESET}"
    fi
else
    echo -e "${ERROR_COLOR}✗ Query failed${RESET}"
    echo -e "${ERROR_COLOR}Error: $USER_MARKETS_RESULT${RESET}"
    exit 1
fi

section "QUERY COMPLETED"
echo -e "${SUCCESS_COLOR}Active user markets query completed successfully!${RESET}" 