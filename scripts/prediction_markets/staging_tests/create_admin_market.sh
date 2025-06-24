#!/bin/bash

# Create Admin Market Script for Kong Prediction Markets
dfx identity use default

# This script creates time-weighted admin markets with KONG or DKP tokens
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
    MARKET_RULES="This market will resolve based on official announcements, verified news sources, or objective data. Resolution will be determined by market administrators."
    
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

# Main script
clear
section "CREATE ADMIN MARKET - KONG PREDICTION MARKETS"

# Get current identity
CURRENT_IDENTITY=$(get_current_identity)
echo -e "${CMD_COLOR}Current dfx identity: ${RESET}${RESULT_COLOR}$CURRENT_IDENTITY${RESET}"
echo ""

# Token selection
echo -e "${CMD_COLOR}Select token for the market:${RESET}"
echo -e "${CMD_COLOR}  1) KONG Token${RESET}"
echo -e "${CMD_COLOR}  2) DKP Token${RESET}"
echo ""
read -p "Select token (1-2): " -n 1 -r TOKEN_CHOICE
echo ""

case $TOKEN_CHOICE in
    1)
        SELECTED_TOKEN="KONG"
        SELECTED_TOKEN_ID=$KONG_LEDGER_ID
        echo -e "${SUCCESS_COLOR}✓ Selected KONG token${RESET}"
        ;;
    2)
        SELECTED_TOKEN="DKP"
        SELECTED_TOKEN_ID=$DKP_LEDGER_ID
        echo -e "${SUCCESS_COLOR}✓ Selected DKP token${RESET}"
        ;;
    *)
        echo -e "${ERROR_COLOR}Invalid choice. Defaulting to KONG.${RESET}"
        SELECTED_TOKEN="KONG"
        SELECTED_TOKEN_ID=$KONG_LEDGER_ID
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
echo -e "${CMD_COLOR}Resolution: ${RESET}${RESULT_COLOR}Admin${RESET}"
echo -e "${CMD_COLOR}Time Weighted: ${RESET}${RESULT_COLOR}Yes (alpha: 0.8)${RESET}"
echo ""

read -p "Proceed with market creation? (y/N): " -n 1 -r CONFIRM
echo ""

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${WARNING_COLOR}Market creation cancelled.${RESET}"
    exit 0
fi

section "CREATING MARKET"

echo -e "${CMD_COLOR}Calling create_market on prediction markets canister...${RESET}"
echo -e "${CMD_COLOR}DEBUG - Selected Token ID: ${RESET}${WARNING_COLOR}$SELECTED_TOKEN_ID${RESET}"
echo -e "${EXEC_COLOR}dfx canister call $PREDICTION_MARKETS_CANISTER create_market \\${RESET}"
echo -e "${EXEC_COLOR}  \"(\\\"$MARKET_QUESTION\\\", $MARKET_CATEGORY, \\\"$MARKET_RULES\\\", $MARKET_OUTCOMES, \\${RESET}"
echo -e "${EXEC_COLOR}   variant { Admin }, variant { Duration = $MARKET_DURATION }, \\${RESET}"
echo -e "${EXEC_COLOR}   opt \\\"$SELECTED_TOKEN_ID\\\", opt true, opt 0.8, null)\" \\${RESET}"
echo -e "${EXEC_COLOR}  --network $DFX_NETWORK${RESET}"
echo ""

# Build the command for debugging (CORRECTED parameter order per .did file)
COMMAND_TO_EXECUTE="(\"$MARKET_QUESTION\", $MARKET_CATEGORY, \"$MARKET_RULES\", $MARKET_OUTCOMES, variant { Admin }, variant { Duration = $MARKET_DURATION }, null, opt true, opt 0.8, opt \"$SELECTED_TOKEN_ID\")"
echo -e "${CMD_COLOR}DEBUG - Full command parameters:${RESET}"
echo -e "${WARNING_COLOR}$COMMAND_TO_EXECUTE${RESET}"
echo ""

# Create the market  
MARKET_CREATION_RESULT=$(dfx canister call $PREDICTION_MARKETS_CANISTER create_market \
    "$COMMAND_TO_EXECUTE" \
    --network $DFX_NETWORK 2>&1)

echo -e "${CMD_COLOR}Result: ${RESET}${RESULT_COLOR}$MARKET_CREATION_RESULT${RESET}"

# Extract market ID from result
if [[ $MARKET_CREATION_RESULT =~ \(variant\ \{\ Ok\ =\ ([0-9]+) ]]; then
    MARKET_ID="${BASH_REMATCH[1]}"
    echo -e "${SUCCESS_COLOR}✓ Market created successfully!${RESET}"
    echo -e "${CMD_COLOR}Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
    
    section "MARKET VERIFICATION"
    
    echo -e "${CMD_COLOR}Fetching created market details...${RESET}"
    MARKET_DETAILS=$(dfx canister call $PREDICTION_MARKETS_CANISTER get_market "($MARKET_ID)" --network $DFX_NETWORK 2>&1)
    
    if [[ $MARKET_DETAILS == *"opt record"* ]]; then
        echo -e "${SUCCESS_COLOR}✓ Market verification successful${RESET}"
        echo -e "${CMD_COLOR}Market Status: ${RESET}${RESULT_COLOR}Active (admin-created)${RESET}"
        
        # Extract and verify the token ID from the created market
        ACTUAL_TOKEN_ID=$(echo "$MARKET_DETAILS" | grep -o 'token_id = "[^"]*"' | sed 's/token_id = "\(.*\)"/\1/')
        echo -e "${CMD_COLOR}Expected Token ID: ${RESET}${WARNING_COLOR}$SELECTED_TOKEN_ID${RESET}"
        echo -e "${CMD_COLOR}Actual Token ID: ${RESET}${WARNING_COLOR}$ACTUAL_TOKEN_ID${RESET}"
        
        if [[ "$ACTUAL_TOKEN_ID" == "$SELECTED_TOKEN_ID" ]]; then
            echo -e "${SUCCESS_COLOR}✓ Token ID matches selection${RESET}"
        else
            echo -e "${ERROR_COLOR}✗ Token ID mismatch! Market created with wrong token.${RESET}"
        fi
        
        # Save market info to file
        MARKET_INFO_FILE="/tmp/created_market_${MARKET_ID}.log"
        cat > "$MARKET_INFO_FILE" << EOF
Market Creation Summary
======================
Market ID: $MARKET_ID
Question: $MARKET_QUESTION
Token: $SELECTED_TOKEN ($SELECTED_TOKEN_ID)
Category: $MARKET_CATEGORY
Duration: $MARKET_DURATION seconds
Resolution Method: Admin
Time Weighted: Yes (alpha: 0.8)
Created By: $CURRENT_IDENTITY
Created At: $(date)

Raw Result: $MARKET_CREATION_RESULT
EOF
        echo -e "${CMD_COLOR}Market info saved to: ${RESET}${RESULT_COLOR}$MARKET_INFO_FILE${RESET}"
        
    else
        echo -e "${WARNING_COLOR}⚠ Market created but verification failed${RESET}"
        echo -e "${CMD_COLOR}Verification result: ${RESET}${ERROR_COLOR}$MARKET_DETAILS${RESET}"
    fi
    
else
    echo -e "${ERROR_COLOR}✗ Market creation failed${RESET}"
    echo -e "${CMD_COLOR}Error details: ${RESET}${ERROR_COLOR}$MARKET_CREATION_RESULT${RESET}"
    exit 1
fi

section "MARKET CREATION COMPLETE"

echo -e "${SUCCESS_COLOR}✓ Admin market successfully created!${RESET}"
echo ""
echo -e "${CMD_COLOR}Summary:${RESET}"
echo -e "${CMD_COLOR}  Market ID: ${RESET}${RESULT_COLOR}$MARKET_ID${RESET}"
echo -e "${CMD_COLOR}  Question: ${RESET}${RESULT_COLOR}$MARKET_QUESTION${RESET}"
echo -e "${CMD_COLOR}  Token: ${RESET}${RESULT_COLOR}$SELECTED_TOKEN${RESET}"
echo -e "${CMD_COLOR}  Time Weighted: ${RESET}${RESULT_COLOR}Yes${RESET}"
echo -e "${CMD_COLOR}  Resolution: ${RESET}${RESULT_COLOR}Admin${RESET}"
echo ""
echo -e "${CMD_COLOR}Next steps:${RESET}"
echo -e "${CMD_COLOR}  • Market is in Active status (admin-created)${RESET}"
echo -e "${CMD_COLOR}  • Users can start placing bets immediately${RESET}"
echo -e "${CMD_COLOR}  • Use resolve_market.sh to resolve when ready${RESET}"
echo ""

exit 0 