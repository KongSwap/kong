#!/bin/bash

# Market Resolution Details Script for Kong Prediction Markets
# This script fetches detailed resolution information for a specific market
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
    INFO_COLOR=$(tput setaf 5 2>/dev/null || echo '')
    RESET=$(tput sgr0 2>/dev/null || echo '')
else
    TITLE_COLOR=''
    CMD_COLOR=''
    EXEC_COLOR=''
    RESULT_COLOR=''
    ERROR_COLOR=''
    SUCCESS_COLOR=''
    WARNING_COLOR=''
    INFO_COLOR=''
    RESET=''
fi

# Helper function to print section titles
section() {
    echo -e "${TITLE_COLOR}==== $1 ====${RESET}"
}

# Ensure we start with default identity
dfx identity use default > /dev/null 2>&1

# Configuration
PREDICTION_MARKETS_CANISTER="qqoq7-zaaaa-aaaan-qzzvq-cai"
DFX_NETWORK=ic

# Store original identity (should be default now)
ORIGINAL_IDENTITY=$(dfx identity whoami 2>/dev/null || echo "default")

section "MARKET RESOLUTION DETAILS"
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
read -p "Enter the Market ID to get resolution details for: " MARKET_ID

# Validate market ID
if ! [[ "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${ERROR_COLOR}ERROR: Invalid market ID. Please enter a valid number.${RESET}"
    exit 1
fi

# First check if market exists
echo -e "${CMD_COLOR}Checking if market exists...${RESET}"
MARKET_INFO=$(dfx canister call ${PREDICTION_MARKETS_CANISTER} get_market "($MARKET_ID)" --network $DFX_NETWORK 2>/dev/null)

if [[ $MARKET_INFO == "(null)" ]]; then
    echo -e "${ERROR_COLOR}ERROR: Market with ID $MARKET_ID not found.${RESET}"
    exit 1
fi

echo -e "${SUCCESS_COLOR}✓ Market found${RESET}"

# Extract basic market information
MARKET_TITLE=$(echo "$MARKET_INFO" | grep -o 'question = "[^"]*"' | head -1 | sed 's/question = "\(.*\)"/\1/')
MARKET_STATUS=$(echo "$MARKET_INFO" | grep -o 'status = variant { [^}]*}' | sed 's/status = variant { \(.*\) }/\1/')

echo -e "${CMD_COLOR}Market Title: ${RESET}${RESULT_COLOR}$MARKET_TITLE${RESET}"
echo -e "${CMD_COLOR}Market Status: ${RESET}${RESULT_COLOR}$MARKET_STATUS${RESET}"
echo ""

# Check if market is resolved before getting resolution details
if [[ $MARKET_STATUS != *"Closed"* ]]; then
    echo -e "${WARNING_COLOR}WARNING: Market is not resolved (Closed). Status: $MARKET_STATUS${RESET}"
    echo -e "${WARNING_COLOR}Resolution details are only available for resolved markets.${RESET}"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${CMD_COLOR}Operation cancelled by user.${RESET}"
        exit 0
    fi
    echo ""
fi

# Get market resolution details
section "FETCHING RESOLUTION DETAILS"
echo -e "${CMD_COLOR}Calling get_market_resolution_details...${RESET}"

RESOLUTION_DETAILS=$(dfx canister call ${PREDICTION_MARKETS_CANISTER} get_market_resolution_details "($MARKET_ID)" --network $DFX_NETWORK 2>&1)

# Check if the call was successful
if [ $? -ne 0 ]; then
    echo -e "${ERROR_COLOR}ERROR: Failed to fetch resolution details${RESET}"
    echo -e "${ERROR_COLOR}$RESOLUTION_DETAILS${RESET}"
    exit 1
fi

# Check if the result is an error variant
if [[ $RESOLUTION_DETAILS == *"Err"* ]]; then
    echo -e "${ERROR_COLOR}ERROR: ${RESET}${RESULT_COLOR}$RESOLUTION_DETAILS${RESET}"
    exit 1
fi

# Check if the result is None (market not resolved)
if [[ $RESOLUTION_DETAILS == *"null"* ]]; then
    echo -e "${WARNING_COLOR}No resolution details available for market $MARKET_ID${RESET}"
    echo -e "${WARNING_COLOR}This usually means the market has not been resolved yet.${RESET}"
    exit 0
fi

# Parse and display the resolution details
section "RESOLUTION DETAILS FOR MARKET $MARKET_ID"

# Extract key information from the resolution details
TOKEN_ID=$(echo "$RESOLUTION_DETAILS" | grep -o 'token_id = "[^"]*"' | sed 's/token_id = "\(.*\)"/\1/')
TOKEN_SYMBOL=$(echo "$RESOLUTION_DETAILS" | grep -o 'token_symbol = "[^"]*"' | sed 's/token_symbol = "\(.*\)"/\1/')
TOTAL_MARKET_POOL=$(echo "$RESOLUTION_DETAILS" | grep -o 'total_market_pool = [0-9_]* :' | sed 's/total_market_pool = \([0-9_]*\) :/\1/' | tr -d '_')
TOTAL_WINNING_POOL=$(echo "$RESOLUTION_DETAILS" | grep -o 'total_winning_pool = [0-9_]* :' | sed 's/total_winning_pool = \([0-9_]*\) :/\1/' | tr -d '_')
PLATFORM_FEE_AMOUNT=$(echo "$RESOLUTION_DETAILS" | grep -o 'platform_fee_amount = [0-9_]* :' | sed 's/platform_fee_amount = \([0-9_]*\) :/\1/' | tr -d '_')
PLATFORM_FEE_PERCENTAGE=$(echo "$RESOLUTION_DETAILS" | grep -o 'platform_fee_percentage = [0-9]* :' | sed 's/platform_fee_percentage = \([0-9]*\) :/\1/')
WINNING_BET_COUNT=$(echo "$RESOLUTION_DETAILS" | grep -o 'winning_bet_count = [0-9]* :' | sed 's/winning_bet_count = \([0-9]*\) :/\1/')
USED_TIME_WEIGHTING=$(echo "$RESOLUTION_DETAILS" | grep -o 'used_time_weighting = [a-z]*' | sed 's/used_time_weighting = \([a-z]*\)/\1/')

# Extract winning outcomes
WINNING_OUTCOMES=$(echo "$RESOLUTION_DETAILS" | grep -o 'winning_outcomes = vec { [^}]*}' | sed 's/winning_outcomes = vec { \(.*\) }/\1/' | sed 's/ : nat//g')

# Display basic resolution information
echo -e "${CMD_COLOR}Token: ${RESET}${RESULT_COLOR}$TOKEN_SYMBOL ($TOKEN_ID)${RESET}"
echo -e "${CMD_COLOR}Winning Outcomes: ${RESET}${RESULT_COLOR}[$WINNING_OUTCOMES]${RESET}"
echo -e "${CMD_COLOR}Time Weighting Used: ${RESET}${RESULT_COLOR}$USED_TIME_WEIGHTING${RESET}"
echo ""

# Display financial summary
section "FINANCIAL SUMMARY"
echo -e "${CMD_COLOR}Total Market Pool: ${RESET}${RESULT_COLOR}$TOTAL_MARKET_POOL${RESET}"
echo -e "${CMD_COLOR}Total Winning Pool: ${RESET}${RESULT_COLOR}$TOTAL_WINNING_POOL${RESET}"
echo -e "${CMD_COLOR}Platform Fee: ${RESET}${RESULT_COLOR}$PLATFORM_FEE_AMOUNT ($PLATFORM_FEE_PERCENTAGE basis points)${RESET}"
echo -e "${CMD_COLOR}Winning Bet Count: ${RESET}${RESULT_COLOR}$WINNING_BET_COUNT${RESET}"
echo ""

# Extract and display distribution details
section "WINNER DISTRIBUTION DETAILS"
echo -e "${CMD_COLOR}Extracting individual winner details...${RESET}"

# Count the number of distribution records
DISTRIBUTION_COUNT=$(echo "$RESOLUTION_DETAILS" | grep -o 'user = principal' | wc -l | tr -d ' ')
echo -e "${CMD_COLOR}Number of winning distributions: ${RESET}${RESULT_COLOR}$DISTRIBUTION_COUNT${RESET}"
echo ""

if [ "$DISTRIBUTION_COUNT" -gt 0 ]; then
    echo -e "${CMD_COLOR}Individual Winner Payouts:${RESET}"
    echo -e "${CMD_COLOR}----------------------------------------${RESET}"
    
    # Extract distribution details (this is complex due to the nested structure)
    # We'll extract key fields for each winner
    DISTRIBUTION_SECTION=$(echo "$RESOLUTION_DETAILS" | sed -n '/distribution_details = vec {/,/};/p')
    
    # Extract each record individually (simplified approach)
    record_count=1
    while IFS= read -r line; do
        if [[ $line == *"user = principal"* ]]; then
            USER=$(echo "$line" | grep -o 'principal "[^"]*"' | sed 's/principal "\(.*\)"/\1/')
            echo -e "${CMD_COLOR}Winner $record_count:${RESET}"
            echo -e "${CMD_COLOR}  User: ${RESET}${RESULT_COLOR}$USER${RESET}"
            record_count=$((record_count + 1))
        elif [[ $line == *"bet_amount = "* ]]; then
            BET_AMOUNT=$(echo "$line" | grep -o '[0-9_]*' | tr -d '_')
            echo -e "${CMD_COLOR}  Bet Amount: ${RESET}${RESULT_COLOR}$BET_AMOUNT${RESET}"
        elif [[ $line == *"total_payout = "* ]]; then
            TOTAL_PAYOUT=$(echo "$line" | grep -o '[0-9_]*' | tr -d '_')
            echo -e "${CMD_COLOR}  Total Payout: ${RESET}${RESULT_COLOR}$TOTAL_PAYOUT${RESET}"
        elif [[ $line == *"bonus_amount = "* ]]; then
            BONUS_AMOUNT=$(echo "$line" | grep -o '[0-9_]*' | tr -d '_')
            echo -e "${CMD_COLOR}  Bonus Amount: ${RESET}${RESULT_COLOR}$BONUS_AMOUNT${RESET}"
        elif [[ $line == *"time_weight = opt ("* ]]; then
            TIME_WEIGHT=$(echo "$line" | grep -o '[0-9.]*' | head -1)
            echo -e "${CMD_COLOR}  Time Weight: ${RESET}${RESULT_COLOR}$TIME_WEIGHT${RESET}"
        elif [[ $line == *"claim_id = opt ("* ]]; then
            CLAIM_ID=$(echo "$line" | grep -o '[0-9]*' | head -1)
            echo -e "${CMD_COLOR}  Claim ID: ${RESET}${RESULT_COLOR}$CLAIM_ID${RESET}"
            echo ""
        fi
    done <<< "$DISTRIBUTION_SECTION"
fi

# Check for failed transactions
section "TRANSACTION STATUS"
FAILED_TRANSACTIONS=$(echo "$RESOLUTION_DETAILS" | grep -o 'failed_transactions = vec {[^}]*}')
if [[ $FAILED_TRANSACTIONS == *"vec {}"* ]]; then
    echo -e "${SUCCESS_COLOR}✓ No failed transactions${RESET}"
else
    echo -e "${WARNING_COLOR}⚠ There are failed transactions in this resolution${RESET}"
    echo -e "${WARNING_COLOR}$FAILED_TRANSACTIONS${RESET}"
fi

# Extract resolution timestamp
RESOLUTION_TIMESTAMP=$(echo "$RESOLUTION_DETAILS" | grep -o 'resolution_timestamp = [0-9_]* :' | sed 's/resolution_timestamp = \([0-9_]*\) :/\1/' | tr -d '_')
if [ -n "$RESOLUTION_TIMESTAMP" ]; then
    echo -e "${CMD_COLOR}Resolution Timestamp: ${RESET}${RESULT_COLOR}$RESOLUTION_TIMESTAMP${RESET}"
fi

# Extract fee transaction ID
FEE_TRANSACTION_ID=$(echo "$RESOLUTION_DETAILS" | grep -o 'fee_transaction_id = opt ([0-9_]* :' | sed 's/fee_transaction_id = opt (\([0-9_]*\) :/\1/' | tr -d '_')
if [ -n "$FEE_TRANSACTION_ID" ]; then
    echo -e "${CMD_COLOR}Fee Transaction ID: ${RESET}${RESULT_COLOR}$FEE_TRANSACTION_ID${RESET}"
fi

echo ""

# Display raw output option
section "DETAILED OUTPUT"
echo -e "${CMD_COLOR}Would you like to see the raw resolution details?${RESET}"
read -p "Show raw output? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    section "RAW RESOLUTION DETAILS"
    echo -e "${RESULT_COLOR}$RESOLUTION_DETAILS${RESET}"
fi

echo ""
section "SUMMARY"
echo -e "${SUCCESS_COLOR}✓ Successfully retrieved resolution details for market $MARKET_ID${RESET}"
echo -e "${CMD_COLOR}Market: ${RESET}${RESULT_COLOR}$MARKET_TITLE${RESET}"
echo -e "${CMD_COLOR}Token: ${RESET}${RESULT_COLOR}$TOKEN_SYMBOL${RESET}"
echo -e "${CMD_COLOR}Winners: ${RESET}${RESULT_COLOR}$WINNING_BET_COUNT${RESET}"
echo -e "${CMD_COLOR}Total Distributed: ${RESET}${RESULT_COLOR}$TOTAL_WINNING_POOL${RESET}"

echo ""
echo -e "${CMD_COLOR}Run this script again to check another market's resolution details.${RESET}" 