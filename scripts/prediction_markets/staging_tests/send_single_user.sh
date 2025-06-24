#!/bin/bash

# Single User Token Sender for Kong Prediction Markets
# This script sends tokens from the current identity to one recipient
#
# USAGE: 
#   bash send_single_user.sh
# or
#   chmod +x send_single_user.sh && ./send_single_user.sh
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

# Network configuration
DFX_NETWORK=ic

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

# Function to validate if identity exists
identity_exists() {
    local identity_name=$1
    dfx identity list 2>/dev/null | grep -q "^$identity_name\$"
}

# Store original identity to restore later
ORIGINAL_IDENTITY=$(dfx identity whoami 2>/dev/null || echo "default")
SENDER_PRINCIPAL=$(dfx identity get-principal)

section "SINGLE USER TOKEN SENDER"
echo -e "${CMD_COLOR}Network: ${RESET}${RESULT_COLOR}$DFX_NETWORK${RESET}"
echo -e "${CMD_COLOR}Sender Identity: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"
echo -e "${CMD_COLOR}Sender Principal: ${RESET}${RESULT_COLOR}$SENDER_PRINCIPAL${RESET}"
echo ""

# Check if we can access the network
echo -e "${CMD_COLOR}Testing network connectivity...${RESET}"
if ! dfx ping $DFX_NETWORK &>/dev/null; then
    echo -e "${ERROR_COLOR}ERROR: Cannot connect to the IC network. Please check your internet connection and dfx configuration.${RESET}"
    exit 1
fi
echo -e "${SUCCESS_COLOR}✓ Network connectivity confirmed${RESET}"
echo ""

# Interactive token selection
section "TOKEN SELECTION"
echo -e "${CMD_COLOR}Available tokens:${RESET}"
echo -e "${CMD_COLOR}  1) KONG${RESET}"
echo -e "${CMD_COLOR}  2) DKP (Dragginz Karma Points)${RESET}"
echo ""
read -p "Select token (1 or 2): " -n 1 -r TOKEN_CHOICE
echo ""

case $TOKEN_CHOICE in
    1)
        SELECTED_TOKEN="KONG"
        ;;
    2)
        SELECTED_TOKEN="DKP"
        ;;
    *)
        echo -e "${ERROR_COLOR}Invalid choice. Please select 1 or 2.${RESET}"
        exit 1
        ;;
esac

# Get token configuration
TOKEN_CANISTER=$(get_token_config "$SELECTED_TOKEN" "CANISTER")
TOKEN_NAME=$(get_token_config "$SELECTED_TOKEN" "NAME")
TOKEN_DECIMALS=$(get_token_config "$SELECTED_TOKEN" "DECIMALS")
TOKEN_SYMBOL=$(get_token_config "$SELECTED_TOKEN" "SYMBOL")

echo -e "${SUCCESS_COLOR}✓ Selected token: $TOKEN_NAME ($TOKEN_SYMBOL)${RESET}"
echo -e "${CMD_COLOR}Token Canister: ${RESET}${RESULT_COLOR}$TOKEN_CANISTER${RESET}"
echo ""

# Interactive recipient selection
section "RECIPIENT SELECTION"
echo -e "${CMD_COLOR}Available identities:${RESET}"
dfx identity list | grep -v "^$ORIGINAL_IDENTITY$" | sed 's/^/  /' || echo "  No other identities found"
echo ""
read -p "Enter recipient identity name: " RECIPIENT_IDENTITY

# Validate recipient identity
if [ -z "$RECIPIENT_IDENTITY" ]; then
    echo -e "${ERROR_COLOR}ERROR: Recipient identity cannot be empty.${RESET}"
    exit 1
fi

if [ "$RECIPIENT_IDENTITY" = "$ORIGINAL_IDENTITY" ]; then
    echo -e "${ERROR_COLOR}ERROR: Cannot send tokens to yourself.${RESET}"
    exit 1
fi

if ! identity_exists "$RECIPIENT_IDENTITY"; then
    echo -e "${ERROR_COLOR}ERROR: Identity '$RECIPIENT_IDENTITY' does not exist.${RESET}"
    echo -e "${CMD_COLOR}Available identities:${RESET}"
    dfx identity list | sed 's/^/  /'
    exit 1
fi

# Get recipient principal
echo -e "${CMD_COLOR}Getting principal for identity: ${RESET}${EXEC_COLOR}$RECIPIENT_IDENTITY${RESET}"
if dfx identity use "$RECIPIENT_IDENTITY" &>/dev/null; then
    RECIPIENT_PRINCIPAL=$(dfx identity get-principal 2>/dev/null)
    if [ -n "$RECIPIENT_PRINCIPAL" ]; then
        echo -e "${CMD_COLOR}  Principal: ${RESET}${RESULT_COLOR}$RECIPIENT_PRINCIPAL${RESET}"
    else
        echo -e "${ERROR_COLOR}Could not get principal for $RECIPIENT_IDENTITY${RESET}"
        exit 1
    fi
else
    echo -e "${ERROR_COLOR}Could not switch to identity $RECIPIENT_IDENTITY${RESET}"
    exit 1
fi

# Restore sender identity
dfx identity use "$ORIGINAL_IDENTITY" &>/dev/null
echo ""

# Interactive amount selection
section "AMOUNT SELECTION"
echo -e "${CMD_COLOR}Enter amount to send (in $TOKEN_SYMBOL):${RESET}"
read -p "Amount: " SEND_AMOUNT

# Validate amount
if ! [[ "$SEND_AMOUNT" =~ ^[0-9]+\.?[0-9]*$ ]]; then
    echo -e "${ERROR_COLOR}ERROR: Invalid amount. Please enter a valid number.${RESET}"
    exit 1
fi

if [ "$(echo "$SEND_AMOUNT <= 0" | bc)" = "1" ]; then
    echo -e "${ERROR_COLOR}ERROR: Amount must be greater than 0.${RESET}"
    exit 1
fi

# Calculate amount in base units
BASE_UNIT_MULTIPLIER=$((10**TOKEN_DECIMALS))
SEND_AMOUNT_BASE_UNITS=$(echo "$SEND_AMOUNT * $BASE_UNIT_MULTIPLIER" | bc | cut -d'.' -f1)

echo -e "${SUCCESS_COLOR}✓ Amount to send: $SEND_AMOUNT $TOKEN_SYMBOL${RESET}"
echo -e "${CMD_COLOR}Amount in base units: ${RESET}${RESULT_COLOR}$SEND_AMOUNT_BASE_UNITS${RESET}"
echo ""

# Check sender balance
section "CHECKING SENDER BALANCE"
echo -e "${CMD_COLOR}Checking $TOKEN_SYMBOL balance for sender...${RESET}"
SENDER_BALANCE=$(get_balance "$SENDER_PRINCIPAL" "$TOKEN_CANISTER")
SENDER_BALANCE_FORMATTED=$(format_token_balance "$SENDER_BALANCE" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
echo -e "${CMD_COLOR}Current balance: ${RESET}${RESULT_COLOR}$SENDER_BALANCE_FORMATTED${RESET}"

if [ "$SENDER_BALANCE" -lt "$SEND_AMOUNT_BASE_UNITS" ]; then
    SEND_AMOUNT_FORMATTED=$(format_token_balance "$SEND_AMOUNT_BASE_UNITS" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
    echo -e "${ERROR_COLOR}ERROR: Insufficient balance! Need $SEND_AMOUNT_FORMATTED but only have $SENDER_BALANCE_FORMATTED${RESET}"
    exit 1
fi
echo -e "${SUCCESS_COLOR}✓ Sufficient balance confirmed${RESET}"
echo ""

# Show recipient current balance
section "RECIPIENT CURRENT BALANCE"
echo -e "${CMD_COLOR}Checking $TOKEN_SYMBOL balance for $RECIPIENT_IDENTITY...${RESET}"
RECIPIENT_INITIAL_BALANCE=$(get_balance "$RECIPIENT_PRINCIPAL" "$TOKEN_CANISTER")
RECIPIENT_INITIAL_FORMATTED=$(format_token_balance "$RECIPIENT_INITIAL_BALANCE" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
echo -e "${CMD_COLOR}  $RECIPIENT_IDENTITY: ${RESET}${RESULT_COLOR}$RECIPIENT_INITIAL_FORMATTED${RESET}"
echo ""

# Confirmation prompt
section "TRANSFER CONFIRMATION"
echo -e "${WARNING_COLOR}Transfer Summary:${RESET}"
echo -e "${WARNING_COLOR}  From: $ORIGINAL_IDENTITY ($SENDER_PRINCIPAL)${RESET}"
echo -e "${WARNING_COLOR}  To: $RECIPIENT_IDENTITY ($RECIPIENT_PRINCIPAL)${RESET}"
echo -e "${WARNING_COLOR}  Token: $TOKEN_NAME ($TOKEN_SYMBOL)${RESET}"
echo -e "${WARNING_COLOR}  Amount: $SEND_AMOUNT $TOKEN_SYMBOL${RESET}"
echo ""
read -p "Do you want to proceed with this transfer? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${CMD_COLOR}Transfer cancelled by user.${RESET}"
    exit 0
fi

# Perform transfer
section "PERFORMING TRANSFER"
echo -e "${CMD_COLOR}Sending $SEND_AMOUNT $TOKEN_SYMBOL to $RECIPIENT_IDENTITY...${RESET}"
echo -e "${CMD_COLOR}  Principal: ${RESET}${RESULT_COLOR}$RECIPIENT_PRINCIPAL${RESET}"

transfer_result=$(send_tokens "$RECIPIENT_PRINCIPAL" "$SEND_AMOUNT_BASE_UNITS" "$TOKEN_CANISTER")

if [ $? -eq 0 ]; then
    # Check if transfer was successful (look for success indicators)
    if [[ $transfer_result == *"Ok"* ]] || [[ $transfer_result =~ [0-9] ]]; then
        echo -e "${CMD_COLOR}  Status: ${RESET}${SUCCESS_COLOR}✓ SUCCESS${RESET}"
        
        # Extract block index if available
        block_index=$(echo "$transfer_result" | grep -o '[0-9_]*' | head -1 | tr -d '_')
        if [ -n "$block_index" ]; then
            echo -e "${CMD_COLOR}  Block Index: ${RESET}${RESULT_COLOR}$block_index${RESET}"
        fi
        TRANSFER_SUCCESS=true
    else
        echo -e "${CMD_COLOR}  Status: ${RESET}${ERROR_COLOR}✗ FAILED${RESET}"
        echo -e "${CMD_COLOR}  Error: ${RESET}${ERROR_COLOR}$transfer_result${RESET}"
        TRANSFER_SUCCESS=false
    fi
else
    echo -e "${CMD_COLOR}  Status: ${RESET}${ERROR_COLOR}✗ FAILED${RESET}"
    echo -e "${CMD_COLOR}  Error: ${RESET}${ERROR_COLOR}Network or command error${RESET}"
    TRANSFER_SUCCESS=false
fi
echo ""

# Check final balances
section "FINAL BALANCES"
echo -e "${CMD_COLOR}Checking updated balances...${RESET}"
echo ""

# Sender final balance
echo -e "${CMD_COLOR}Sender ($ORIGINAL_IDENTITY):${RESET}"
sender_final_balance=$(get_balance "$SENDER_PRINCIPAL" "$TOKEN_CANISTER")
sender_final_formatted=$(format_token_balance "$sender_final_balance" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
echo -e "${CMD_COLOR}  Final balance: ${RESET}${RESULT_COLOR}$sender_final_formatted${RESET}"

if [ "$TRANSFER_SUCCESS" = true ]; then
    # Calculate amount sent
    amount_sent=$((SENDER_BALANCE - sender_final_balance))
    amount_sent_formatted=$(format_token_balance "$amount_sent" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
    echo -e "${CMD_COLOR}  Amount sent: ${RESET}${SUCCESS_COLOR}$amount_sent_formatted${RESET}"
fi
echo ""

# Recipient final balance
echo -e "${CMD_COLOR}Recipient ($RECIPIENT_IDENTITY):${RESET}"
recipient_final_balance=$(get_balance "$RECIPIENT_PRINCIPAL" "$TOKEN_CANISTER")
recipient_final_formatted=$(format_token_balance "$recipient_final_balance" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
echo -e "${CMD_COLOR}  Final balance: ${RESET}${RESULT_COLOR}$recipient_final_formatted${RESET}"

if [ "$TRANSFER_SUCCESS" = true ]; then
    # Calculate amount received
    amount_received=$((recipient_final_balance - RECIPIENT_INITIAL_BALANCE))
    amount_received_formatted=$(format_token_balance "$amount_received" "$TOKEN_DECIMALS" "$TOKEN_SYMBOL")
    echo -e "${CMD_COLOR}  Amount received: ${RESET}${SUCCESS_COLOR}$amount_received_formatted${RESET}"
fi
echo ""

# Summary
section "TRANSFER SUMMARY"
echo -e "${CMD_COLOR}From: ${RESET}${RESULT_COLOR}$ORIGINAL_IDENTITY${RESET}"
echo -e "${CMD_COLOR}To: ${RESET}${RESULT_COLOR}$RECIPIENT_IDENTITY${RESET}"
echo -e "${CMD_COLOR}Token: ${RESET}${RESULT_COLOR}$TOKEN_NAME ($TOKEN_SYMBOL)${RESET}"
echo -e "${CMD_COLOR}Requested amount: ${RESET}${RESULT_COLOR}$SEND_AMOUNT $TOKEN_SYMBOL${RESET}"

if [ "$TRANSFER_SUCCESS" = true ]; then
    echo -e "${CMD_COLOR}Status: ${RESET}${SUCCESS_COLOR}✓ Transfer completed successfully!${RESET}"
else
    echo -e "${CMD_COLOR}Status: ${RESET}${ERROR_COLOR}✗ Transfer failed. Check the details above.${RESET}"
fi

echo ""
echo -e "${CMD_COLOR}Supported tokens: KONG, DKP${RESET}"
echo -e "${CMD_COLOR}Run this script again to perform another transfer.${RESET}"
