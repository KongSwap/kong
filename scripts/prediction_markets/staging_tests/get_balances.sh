#!/bin/bash

# Enhanced balance checker for Kong Prediction Markets
# This script checks KONG token balances for multiple dfx identities
set -e

# Color definitions for better output formatting
if [ -t 1 ]; then
    # Only use colors when outputting to a terminal
    TITLE_COLOR=$(tput bold 2>/dev/null && tput setaf 6 2>/dev/null || echo '')
    CMD_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    EXEC_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    RESULT_COLOR=$(tput setaf 4 2>/dev/null || echo '')
    ERROR_COLOR=$(tput setaf 1 2>/dev/null || echo '')
    SUCCESS_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    RESET=$(tput sgr0 2>/dev/null || echo '')
else
    # No colors when piping to a file
    TITLE_COLOR=''
    CMD_COLOR=''
    EXEC_COLOR=''
    RESULT_COLOR=''
    ERROR_COLOR=''
    SUCCESS_COLOR=''
    RESET=''
fi

# Helper function to print section titles
section() {
    echo -e "${TITLE_COLOR}==== $1 ====${RESET}"
}

# Token configurations (similar to send_tokens.sh)
get_token_config() {
    local token=$1
    local field=$2
    
    case "$token" in
        "KONG")
            case "$field" in
                "CANISTER") echo "o7oak-iyaaa-aaaaq-aadzq-cai" ;;
                "NAME") echo "KONG" ;;
                "DECIMALS") echo "8" ;;
                "SYMBOL") echo "KONG" ;;
                *) echo "" ;;
            esac
            ;;
        "DKP")
            case "$field" in
                "CANISTER") echo "zfcdd-tqaaa-aaaaq-aaaga-cai" ;;
                "NAME") echo "Dragginz Karma Points" ;;
                "DECIMALS") echo "8" ;;
                "SYMBOL") echo "DKP" ;;
                *) echo "" ;;
            esac
            ;;
        *)
            echo ""
            ;;
    esac
}

# Helper function to format token balances
format_token_balance() {
    local balance=$1
    local decimals=$2
    local symbol=$3
    
    # Remove underscores if present
    balance=${balance//_/}
    
    # Convert from smallest units to human readable (based on decimals)
    if [ "$balance" -gt 0 ]; then
        local divisor=$(echo "10^$decimals" | bc)
        # Use bc for precise decimal arithmetic
        local token_amount=$(echo "scale=$decimals; $balance / $divisor" | bc)
        # Remove trailing zeros
        token_amount=$(echo "$token_amount" | sed 's/\.?0*$//')
        echo "$token_amount $symbol ($balance units)"
    else
        echo "0 $symbol (0 units)"
    fi
}

# Helper function to get balance for any token
get_token_balance() {
    local principal_id=$1
    local canister_id=$2
    
    local balance_result=$(dfx canister call "$canister_id" icrc1_balance_of "(
      record {
        owner = principal \"$principal_id\";
        subaccount = null;
      }
    )" --network $DFX_NETWORK 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Extract the balance number from the result
        local balance=$(echo "$balance_result" | grep -o '[0-9_]*' | head -1 | tr -d '_')
        echo "$balance"
    else
        echo "0"
    fi
}

# Configuration
DFX_NETWORK=ic

# Tokens to check - add/remove tokens here
TOKENS_TO_CHECK=("KONG" "DKP")

# List of identities to check
IDENTITIES=("default" "alice" "bob" "carol" "dave")

# Store original identity to restore later
ORIGINAL_IDENTITY=$(dfx identity whoami 2>/dev/null || echo "default")

section "MULTI-TOKEN BALANCE CHECKER"
echo -e "${CMD_COLOR}Network: ${RESET}${RESULT_COLOR}$DFX_NETWORK${RESET}"
echo -e "${CMD_COLOR}Tokens to check: ${RESET}${RESULT_COLOR}${TOKENS_TO_CHECK[*]}${RESET}"
echo -e "${CMD_COLOR}Original Identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"
echo ""

# Display token information
echo -e "${CMD_COLOR}Token Information:${RESET}"
for token in "${TOKENS_TO_CHECK[@]}"; do
    token_name=$(get_token_config "$token" "NAME")
    token_canister=$(get_token_config "$token" "CANISTER")
    token_symbol=$(get_token_config "$token" "SYMBOL")
    echo -e "${CMD_COLOR}  $token_symbol: ${RESET}${RESULT_COLOR}$token_name ($token_canister)${RESET}"
done
echo ""

# Check if we can access the network
echo -e "${CMD_COLOR}Testing network connectivity...${RESET}"
if ! dfx ping $DFX_NETWORK &>/dev/null; then
    echo -e "${ERROR_COLOR}ERROR: Cannot connect to the IC network. Please check your internet connection and dfx configuration.${RESET}"
    exit 1
fi
echo -e "${SUCCESS_COLOR}✓ Network connectivity confirmed${RESET}"
echo ""

section "CHECKING BALANCES FOR ALL IDENTITIES"

# Track totals per token (bash 3.2 compatible - parallel arrays)
TOTAL_BALANCES=()
SUCCESSFUL_CHECKS_PER_TOKEN=()
FAILED_CHECKS_PER_TOKEN=()

# Initialize counters (parallel to TOKENS_TO_CHECK array)
for token in "${TOKENS_TO_CHECK[@]}"; do
    TOTAL_BALANCES+=(0)
    SUCCESSFUL_CHECKS_PER_TOKEN+=(0)
    FAILED_CHECKS_PER_TOKEN+=(0)
done

TOTAL_SUCCESSFUL_CHECKS=0
TOTAL_FAILED_CHECKS=0

# Helper functions to get/set values by token name
get_token_index() {
    local token_name=$1
    local i=0
    for token in "${TOKENS_TO_CHECK[@]}"; do
        if [ "$token" = "$token_name" ]; then
            echo $i
            return
        fi
        ((i++))
    done
    echo -1
}

get_total_balance() {
    local token_name=$1
    local index=$(get_token_index "$token_name")
    if [ $index -ge 0 ]; then
        echo "${TOTAL_BALANCES[$index]}"
    else
        echo "0"
    fi
}

set_total_balance() {
    local token_name=$1
    local value=$2
    local index=$(get_token_index "$token_name")
    if [ $index -ge 0 ]; then
        TOTAL_BALANCES[$index]=$value
    fi
}

get_successful_checks() {
    local token_name=$1
    local index=$(get_token_index "$token_name")
    if [ $index -ge 0 ]; then
        echo "${SUCCESSFUL_CHECKS_PER_TOKEN[$index]}"
    else
        echo "0"
    fi
}

set_successful_checks() {
    local token_name=$1
    local value=$2
    local index=$(get_token_index "$token_name")
    if [ $index -ge 0 ]; then
        SUCCESSFUL_CHECKS_PER_TOKEN[$index]=$value
    fi
}

get_failed_checks() {
    local token_name=$1
    local index=$(get_token_index "$token_name")
    if [ $index -ge 0 ]; then
        echo "${FAILED_CHECKS_PER_TOKEN[$index]}"
    else
        echo "0"
    fi
}

set_failed_checks() {
    local token_name=$1
    local value=$2
    local index=$(get_token_index "$token_name")
    if [ $index -ge 0 ]; then
        FAILED_CHECKS_PER_TOKEN[$index]=$value
    fi
}

for identity in "${IDENTITIES[@]}"; do
    echo -e "${CMD_COLOR}Checking balances for identity: ${RESET}${EXEC_COLOR}$identity${RESET}"
    
    # Switch to the identity
    if dfx identity use "$identity" &>/dev/null; then
        # Get the principal ID
        PRINCIPAL_ID=$(dfx identity get-principal 2>/dev/null)
        
        if [ -n "$PRINCIPAL_ID" ]; then
            echo -e "${CMD_COLOR}  Principal: ${RESET}${RESULT_COLOR}$PRINCIPAL_ID${RESET}"
            
            # Check balance for each token
            for token in "${TOKENS_TO_CHECK[@]}"; do
                token_symbol=$(get_token_config "$token" "SYMBOL")
                token_canister=$(get_token_config "$token" "CANISTER")
                token_decimals=$(get_token_config "$token" "DECIMALS")
                
                echo -e "${CMD_COLOR}  Querying $token_symbol balance...${RESET}"
                
                BALANCE=$(get_token_balance "$PRINCIPAL_ID" "$token_canister")
                
                                 if [ -n "$BALANCE" ] && [ "$BALANCE" != "0" ] || [ "$BALANCE" = "0" ]; then
                     FORMATTED_BALANCE=$(format_token_balance "$BALANCE" "$token_decimals" "$token_symbol")
                     echo -e "${CMD_COLOR}    $token_symbol: ${RESET}${SUCCESS_COLOR}$FORMATTED_BALANCE${RESET}"
                     
                     # Add to total (remove underscores for arithmetic)
                     CLEAN_BALANCE=${BALANCE//_/}
                     current_total=$(get_total_balance "$token")
                     new_total=$((current_total + CLEAN_BALANCE))
                     set_total_balance "$token" "$new_total"
                     
                     current_success=$(get_successful_checks "$token")
                     set_successful_checks "$token" $((current_success + 1))
                     TOTAL_SUCCESSFUL_CHECKS=$((TOTAL_SUCCESSFUL_CHECKS + 1))
                 else
                     echo -e "${CMD_COLOR}    $token_symbol: ${RESET}${ERROR_COLOR}Failed to query balance${RESET}"
                     current_failed=$(get_failed_checks "$token")
                     set_failed_checks "$token" $((current_failed + 1))
                     TOTAL_FAILED_CHECKS=$((TOTAL_FAILED_CHECKS + 1))
                 fi
            done
                 else
             echo -e "${CMD_COLOR}  ${RESET}${ERROR_COLOR}Could not get principal for identity $identity${RESET}"
             for token in "${TOKENS_TO_CHECK[@]}"; do
                 current_failed=$(get_failed_checks "$token")
                 set_failed_checks "$token" $((current_failed + 1))
                 TOTAL_FAILED_CHECKS=$((TOTAL_FAILED_CHECKS + 1))
             done
         fi
     else
         echo -e "${CMD_COLOR}  ${RESET}${ERROR_COLOR}Could not switch to identity $identity (identity may not exist)${RESET}"
         for token in "${TOKENS_TO_CHECK[@]}"; do
             current_failed=$(get_failed_checks "$token")
             set_failed_checks "$token" $((current_failed + 1))
             TOTAL_FAILED_CHECKS=$((TOTAL_FAILED_CHECKS + 1))
         done
     fi
    
    echo "" # Add spacing between identities
done

# Restore original identity
echo -e "${CMD_COLOR}Restoring original identity: ${RESET}${EXEC_COLOR}$ORIGINAL_IDENTITY${RESET}"
dfx identity use "$ORIGINAL_IDENTITY" &>/dev/null

section "SUMMARY"
echo -e "${CMD_COLOR}Total identities checked: ${RESET}${RESULT_COLOR}${#IDENTITIES[@]}${RESET}"
echo -e "${CMD_COLOR}Total tokens checked: ${RESET}${RESULT_COLOR}${#TOKENS_TO_CHECK[@]}${RESET}"
echo -e "${CMD_COLOR}Total successful checks: ${RESET}${SUCCESS_COLOR}$TOTAL_SUCCESSFUL_CHECKS${RESET}"
echo -e "${CMD_COLOR}Total failed checks: ${RESET}${ERROR_COLOR}$TOTAL_FAILED_CHECKS${RESET}"
echo ""

# Show combined balances per token
echo -e "${CMD_COLOR}Combined balances across all identities:${RESET}"
for token in "${TOKENS_TO_CHECK[@]}"; do
    token_symbol=$(get_token_config "$token" "SYMBOL")
    token_decimals=$(get_token_config "$token" "DECIMALS")
    
    successful_checks=$(get_successful_checks "$token")
    failed_checks=$(get_failed_checks "$token")
    total_balance=$(get_total_balance "$token")
    
    if [ $successful_checks -gt 0 ]; then
        total_formatted=$(format_token_balance "$total_balance" "$token_decimals" "$token_symbol")
        echo -e "${CMD_COLOR}  $token_symbol: ${RESET}${SUCCESS_COLOR}$total_formatted${RESET}"
        echo -e "${CMD_COLOR}    Successful checks: ${RESET}${SUCCESS_COLOR}$successful_checks${RESET}"
        echo -e "${CMD_COLOR}    Failed checks: ${RESET}${ERROR_COLOR}$failed_checks${RESET}"
    else
        echo -e "${CMD_COLOR}  $token_symbol: ${RESET}${ERROR_COLOR}No successful balance checks${RESET}"
    fi
    echo ""
done

echo -e "${CMD_COLOR}Note: This script checks balances on the ${RESET}${RESULT_COLOR}$DFX_NETWORK${RESET}${CMD_COLOR} network.${RESET}"
echo -e "${CMD_COLOR}Make sure your identities exist and have been configured properly with dfx.${RESET}"
echo -e "${CMD_COLOR}To add more tokens, modify the TOKENS_TO_CHECK array and add token config to get_token_config().${RESET}"