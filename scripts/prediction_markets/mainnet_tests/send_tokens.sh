#!/bin/bash

# Enhanced token sender for Kong Prediction Markets
# This script sends tokens from the current identity to multiple recipients
#
# USAGE: 
#   bash send_tokens.sh
# or
#   chmod +x send_tokens.sh && ./send_tokens.sh
#
# REQUIREMENTS:
#   - bash version 3.2+ (compatible with macOS default)
#   - dfx CLI configured for IC network
#   - Sufficient token balance in sender account
set -e

# Check if running with bash
if [ -z "$BASH_VERSION" ]; then
    echo "Error: This script requires bash. Please run with 'bash $0' or make sure bash is your default shell."
    exit 1
fi

# Note: This script is compatible with bash 3.2+ (macOS default)

# Color definitions for better output formatting
if [ -t 1 ]; then
    # Only use colors when outputting to a terminal
    TITLE_COLOR=$(tput bold 2>/dev/null && tput setaf 6 2>/dev/null || echo '')
    CMD_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    EXEC_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    RESULT_COLOR=$(tput setaf 4 2>/dev/null || echo '')
    ERROR_COLOR=$(tput setaf 1 2>/dev/null || echo '')
    SUCCESS_COLOR=$(tput setaf 2 2>/dev/null || echo '')
    WARNING_COLOR=$(tput setaf 3 2>/dev/null || echo '')
    RESET=$(tput sgr0 2>/dev/null || echo '')
else
    # No colors when piping to a file
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

# Token configurations (bash 3.2 compatible)
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

# Configuration - CHANGE THESE TO SWITCH TOKENS
SELECTED_TOKEN="KONG"  # Change to "DKP" to send DKP tokens instead
SEND_AMOUNT=5          # Amount to send to each recipient (in human-readable units)

# Derived configuration
TOKEN_CANISTER=$(get_token_config "$SELECTED_TOKEN" "CANISTER")
TOKEN_NAME=$(get_token_config "$SELECTED_TOKEN" "NAME")
TOKEN_DECIMALS=$(get_token_config "$SELECTED_TOKEN" "DECIMALS")
TOKEN_SYMBOL=$(get_token_config "$SELECTED_TOKEN" "SYMBOL")

# Calculate amount in base units (multiply by 10^decimals)
BASE_UNIT_MULTIPLIER=$((10**TOKEN_DECIMALS))
SEND_AMOUNT_BASE_UNITS=$((SEND_AMOUNT * BASE_UNIT_MULTIPLIER))

# Network configuration
DFX_NETWORK=ic

# Recipients
RECIPIENTS=("alice" "bob" "carol" "dave")

# Helper function to format token amounts
format_token_balance() {
    local balance=$1
    local decimals=$2
    local symbol=$3
    
    # Remove underscores if present
    balance=${balance//_/}
    
    # Convert from smallest units to token units
    if [ "$balance" -gt 0 ]; then
        # Use bc for precise decimal arithmetic
        local divisor=$((10**decimals))
        local token_amount=$(echo "scale=$decimals; $balance / $divisor" | bc)
        # Remove trailing zeros
        token_amount=$(echo "$token_amount" | sed 's/\.?0*$//')
        echo "$token_amount $symbol ($balance units)"
    else
        echo "0 $symbol (0 units)"
    fi
}

# Function to get balance for a principal
get_balance() {
    local principal=$1
    local canister=$2
    
    local balance_result=$(dfx canister call $canister icrc1_balance_of "(
      record {
        owner = principal \"$principal\";
        subaccount = null;
      }
    )" --network $DFX_NETWORK 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Extract the balance number from the result
        echo "$balance_result" | grep -o '[0-9_]*' | head -1 | tr -d '_'
    else
        echo "0"
    fi
}

# Function to send tokens
send_tokens() {
    local recipient_principal=$1
    local amount=$2
    local canister=$3
    
    dfx canister call $canister icrc1_transfer "(
      record {
        to = record {
          owner = principal \"$recipient_principal\";
          subaccount = null;
        };
        amount = $amount : nat;
        fee = null;
        memo = null;
        from_subaccount = null;
        created_at_time = null;
      }
    )" --network $DFX_NETWORK 2>/dev/null
}

# Store original identity to restore later
ORIGINAL_IDENTITY=$(dfx identity whoami 2>/dev/null || echo "default")
SENDER_PRINCIPAL=$(dfx identity get-principal)

section "TOKEN SENDER"
echo -e "${CMD_COLOR}Network: ${RESET}${RESULT_COLOR}$DFX_NETWORK${RESET}"
echo -e "${CMD_COLOR}Selected Token: ${RESET}${RESULT_COLOR}$TOKEN_NAME ($TOKEN_SYMBOL)${RESET}"
echo -e "${CMD_COLOR}Token Canister: ${RESET}${RESULT_COLOR}$TOKEN_CANISTER${RESET}"
echo -e "${CMD_COLOR}Sender Identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"
echo -e "${CMD_COLOR}Sender Principal: ${RESET}${RESULT_COLOR}$SENDER_PRINCIPAL${RESET}"
echo -e "${CMD_COLOR}Amount per recipient: ${RESET}${RESULT_COLOR}$SEND_AMOUNT $TOKEN_SYMBOL${RESET}"
echo -e "${CMD_COLOR}Amount in base units: ${RESET}${RESULT_COLOR}$SEND_AMOUNT_BASE_UNITS${RESET}"
echo ""

# Check if we can access the network
echo -e "${CMD_COLOR}Testing network connectivity...${RESET}"
if ! dfx ping $DFX_NETWORK &>/dev/null; then
    echo -e "${ERROR_COLOR}ERROR: Cannot connect to the IC network. Please check your internet connection and dfx configuration.${RESET}"
    exit 1
fi
echo -e "${SUCCESS_COLOR}✓ Network connectivity confirmed${RESET}"
echo ""

# Get recipient principals (bash 3.2 compatible)
section "COLLECTING RECIPIENT INFORMATION"

# Arrays to store recipient data (parallel arrays)
RECIPIENT_NAMES=()
RECIPIENT_PRINCIPALS_ARRAY=()

for recipient in "${RECIPIENTS[@]}"; do
    echo -e "${CMD_COLOR}Getting principal for identity: ${RESET}${EXEC_COLOR}$recipient${RESET}"
    
    if dfx identity use "$recipient" &>/dev/null; then
        RECIPIENT_PRINCIPAL=$(dfx identity get-principal 2>/dev/null)
        if [ -n "$RECIPIENT_PRINCIPAL" ]; then
            RECIPIENT_NAMES+=("$recipient")
            RECIPIENT_PRINCIPALS_ARRAY+=("$RECIPIENT_PRINCIPAL")
            echo -e "${CMD_COLOR}  Principal: ${RESET}${RESULT_COLOR}$RECIPIENT_PRINCIPAL${RESET}"
        else
            echo -e "${CMD_COLOR}  ${RESET}${ERROR_COLOR}Could not get principal for $recipient${RESET}"
            exit 1
        fi
    else
        echo -e "${CMD_COLOR}  ${RESET}${ERROR_COLOR}Identity $recipient does not exist${RESET}"
        exit 1
    fi
done

# Helper function to get principal by recipient name
get_recipient_principal() {
    local recipient_name=$1
    local i=0
    for name in "${RECIPIENT_NAMES[@]}"; do
        if [ "$name" = "$recipient_name" ]; then
            echo "${RECIPIENT_PRINCIPALS_ARRAY[$i]}"
            return
        fi
        ((i++))
    done
    echo ""
}

# Restore sender identity
dfx identity use "$ORIGINAL_IDENTITY" &>/dev/null
echo ""

# Check sender balance
section "CHECKING SENDER BALANCE"
echo -e "${CMD_COLOR}Checking $TOKEN_SYMBOL balance for sender...${RESET}"
SENDER_BALANCE=$(get_balance "$SENDER_PRINCIPAL" "$TOKEN_CANISTER")
SENDER_BALANCE_FORMATTED=$(format_token_balance "$SENDER_BALANCE" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
echo -e "${CMD_COLOR}Current balance: ${RESET}${RESULT_COLOR}$SENDER_BALANCE_FORMATTED${RESET}"

# Calculate total needed
TOTAL_NEEDED=$((SEND_AMOUNT_BASE_UNITS * ${#RECIPIENTS[@]}))
TOTAL_NEEDED_FORMATTED=$(format_token_balance "$TOTAL_NEEDED" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")

echo -e "${CMD_COLOR}Total needed for transfers: ${RESET}${RESULT_COLOR}$TOTAL_NEEDED_FORMATTED${RESET}"

if [ "$SENDER_BALANCE" -lt "$TOTAL_NEEDED" ]; then
    echo -e "${ERROR_COLOR}ERROR: Insufficient balance! Need $TOTAL_NEEDED_FORMATTED but only have $SENDER_BALANCE_FORMATTED${RESET}"
    exit 1
fi
echo -e "${SUCCESS_COLOR}✓ Sufficient balance confirmed${RESET}"
echo ""

# Show recipient current balances
section "RECIPIENT CURRENT BALANCES"

# Arrays for initial balances (parallel to RECIPIENT_NAMES)
INITIAL_BALANCES=()

for recipient in "${RECIPIENTS[@]}"; do
    recipient_principal=$(get_recipient_principal "$recipient")
    echo -e "${CMD_COLOR}Checking $TOKEN_SYMBOL balance for $recipient...${RESET}"
    balance=$(get_balance "$recipient_principal" "$TOKEN_CANISTER")
    INITIAL_BALANCES+=("$balance")
    balance_formatted=$(format_token_balance "$balance" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
    echo -e "${CMD_COLOR}  $recipient: ${RESET}${RESULT_COLOR}$balance_formatted${RESET}"
done

# Helper function to get initial balance by recipient name
get_initial_balance() {
    local recipient_name=$1
    local i=0
    for name in "${RECIPIENT_NAMES[@]}"; do
        if [ "$name" = "$recipient_name" ]; then
            echo "${INITIAL_BALANCES[$i]}"
            return
        fi
        ((i++))
    done
    echo "0"
}
echo ""

# Confirmation prompt
section "TRANSFER CONFIRMATION"
echo -e "${WARNING_COLOR}You are about to send $SEND_AMOUNT $TOKEN_SYMBOL to each of the following recipients:${RESET}"
for recipient in "${RECIPIENTS[@]}"; do
    recipient_principal=$(get_recipient_principal "$recipient")
    echo -e "${WARNING_COLOR}  • $recipient ($recipient_principal)${RESET}"
done
echo ""
echo -e "${WARNING_COLOR}Total transfer: $TOTAL_NEEDED_FORMATTED${RESET}"
echo ""
read -p "Do you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${CMD_COLOR}Transfer cancelled by user.${RESET}"
    exit 0
fi

# Perform transfers
section "PERFORMING TRANSFERS"
SUCCESSFUL_TRANSFERS=0
FAILED_TRANSFERS=0

for recipient in "${RECIPIENTS[@]}"; do
    recipient_principal=$(get_recipient_principal "$recipient")
    echo -e "${CMD_COLOR}Sending $SEND_AMOUNT $TOKEN_SYMBOL to $recipient...${RESET}"
    echo -e "${CMD_COLOR}  Principal: ${RESET}${RESULT_COLOR}$recipient_principal${RESET}"
    
    transfer_result=$(send_tokens "$recipient_principal" "$SEND_AMOUNT_BASE_UNITS" "$TOKEN_CANISTER")
    
    if [ $? -eq 0 ]; then
        # Check if transfer was successful (look for success indicators)
        if [[ $transfer_result == *"Ok"* ]] || [[ $transfer_result =~ [0-9] ]]; then
            echo -e "${CMD_COLOR}  Status: ${RESET}${SUCCESS_COLOR}✓ SUCCESS${RESET}"
            SUCCESSFUL_TRANSFERS=$((SUCCESSFUL_TRANSFERS + 1))
            
            # Extract block index if available
            block_index=$(echo "$transfer_result" | grep -o '[0-9_]*' | head -1 | tr -d '_')
            if [ -n "$block_index" ]; then
                echo -e "${CMD_COLOR}  Block Index: ${RESET}${RESULT_COLOR}$block_index${RESET}"
            fi
        else
            echo -e "${CMD_COLOR}  Status: ${RESET}${ERROR_COLOR}✗ FAILED${RESET}"
            echo -e "${CMD_COLOR}  Error: ${RESET}${ERROR_COLOR}$transfer_result${RESET}"
            FAILED_TRANSFERS=$((FAILED_TRANSFERS + 1))
        fi
    else
        echo -e "${CMD_COLOR}  Status: ${RESET}${ERROR_COLOR}✗ FAILED${RESET}"
        echo -e "${CMD_COLOR}  Error: ${RESET}${ERROR_COLOR}Network or command error${RESET}"
        FAILED_TRANSFERS=$((FAILED_TRANSFERS + 1))
    fi
    echo ""
done

# Check final balances
section "FINAL BALANCES"
echo -e "${CMD_COLOR}Checking updated balances...${RESET}"
echo ""

# Sender final balance
echo -e "${CMD_COLOR}Sender ($ORIGINAL_IDENTITY):${RESET}"
sender_final_balance=$(get_balance "$SENDER_PRINCIPAL" "$TOKEN_CANISTER")
sender_final_formatted=$(format_token_balance "$sender_final_balance" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
echo -e "${CMD_COLOR}  Final balance: ${RESET}${RESULT_COLOR}$sender_final_formatted${RESET}"

# Calculate amount sent
amount_sent=$((SENDER_BALANCE - sender_final_balance))
amount_sent_formatted=$(format_token_balance "$amount_sent" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
echo -e "${CMD_COLOR}  Amount sent: ${RESET}${RESULT_COLOR}$amount_sent_formatted${RESET}"
echo ""

# Recipients final balances
for recipient in "${RECIPIENTS[@]}"; do
    recipient_principal=$(get_recipient_principal "$recipient")
    echo -e "${CMD_COLOR}$recipient:${RESET}"
    
    final_balance=$(get_balance "$recipient_principal" "$TOKEN_CANISTER")
    final_balance_formatted=$(format_token_balance "$final_balance" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
    echo -e "${CMD_COLOR}  Final balance: ${RESET}${RESULT_COLOR}$final_balance_formatted${RESET}"
    
    # Calculate amount received
    initial_balance=$(get_initial_balance "$recipient")
    amount_received=$((final_balance - initial_balance))
    amount_received_formatted=$(format_token_balance "$amount_received" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
    echo -e "${CMD_COLOR}  Amount received: ${RESET}${RESULT_COLOR}$amount_received_formatted${RESET}"
    echo ""
done

# Summary
section "TRANSFER SUMMARY"
echo -e "${CMD_COLOR}Total recipients: ${RESET}${RESULT_COLOR}${#RECIPIENTS[@]}${RESET}"
echo -e "${CMD_COLOR}Successful transfers: ${RESET}${SUCCESS_COLOR}$SUCCESSFUL_TRANSFERS${RESET}"
echo -e "${CMD_COLOR}Failed transfers: ${RESET}${ERROR_COLOR}$FAILED_TRANSFERS${RESET}"
echo -e "${CMD_COLOR}Token: ${RESET}${RESULT_COLOR}$TOKEN_NAME ($TOKEN_SYMBOL)${RESET}"
echo -e "${CMD_COLOR}Amount per transfer: ${RESET}${RESULT_COLOR}$SEND_AMOUNT $TOKEN_SYMBOL${RESET}"

if [ $SUCCESSFUL_TRANSFERS -eq ${#RECIPIENTS[@]} ]; then
    echo -e "${SUCCESS_COLOR}✓ All transfers completed successfully!${RESET}"
elif [ $SUCCESSFUL_TRANSFERS -gt 0 ]; then
    echo -e "${WARNING_COLOR}⚠ Some transfers failed. Check the details above.${RESET}"
else
    echo -e "${ERROR_COLOR}✗ All transfers failed. Check your balance and network connection.${RESET}"
fi

echo ""
echo -e "${CMD_COLOR}To switch tokens, modify the SELECTED_TOKEN variable at the top of this script.${RESET}"
echo -e "${CMD_COLOR}Supported tokens: KONG, DKP${RESET}"
