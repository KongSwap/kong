#!/usr/bin/env bash

# Script to remove liquidity from USDC/ksUSDT pool
# This demonstrates removing liquidity with cross-chain tokens (USDC from Solana, ksUSDT from IC)

set -eu

# Configuration
NETWORK="${1:-local}"
NETWORK_FLAG=""
if [ "${NETWORK}" != "local" ]; then
    NETWORK_FLAG="--network ${NETWORK}"
fi
IDENTITY="--identity kong_user1"
KONG_BACKEND=$(dfx canister id ${NETWORK_FLAG} kong_backend)

# Token configurations
TOKEN_0="USDC"
TOKEN_1="ksUSDT"
# LP tokens have 8 decimals
# We'll calculate the amount dynamically based on user balance
REMOVE_LP_TOKEN_AMOUNT=""  # Will be set dynamically

# Colors for output
if [ -t 1 ] && command -v tput >/dev/null && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
    BOLD="$(tput bold)"
    NORMAL="$(tput sgr0)"
    GREEN="$(tput setaf 2)"
    BLUE="$(tput setaf 4)"
    RED="$(tput setaf 1)"
    YELLOW="$(tput setaf 3)"
else
    BOLD=""
    NORMAL=""
    GREEN=""
    BLUE=""
    RED=""
    YELLOW=""
fi

print_header() {
    echo
    echo "${BOLD}========== $1 ==========${NORMAL}"
    echo
}

print_success() {
    echo "${GREEN}✓${NORMAL} $1"
}

print_error() {
    echo "${RED}✗${NORMAL} $1" >&2
}

print_info() {
    echo "${BLUE}ℹ${NORMAL} $1"
}

print_debug() {
    echo "${YELLOW}[DEBUG]${NORMAL} $1"
}

# Get user's addresses
print_header "SETUP"
USER_SOLANA_ADDRESS=$(solana address)
print_success "User Solana address: $USER_SOLANA_ADDRESS"

USER_IC_PRINCIPAL=$(dfx identity get-principal ${IDENTITY})
print_success "User IC principal: $USER_IC_PRINCIPAL"

# Step 1: Check current LP token balance and pool state
print_header "STEP 1: CHECK BALANCES AND POOL STATE"
print_info "Getting user's LP token balance..."
USER_BALANCES=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} user_balances "(\"${USER_IC_PRINCIPAL}\")" --output json)
print_info "Current balances:"
echo "$USER_BALANCES" | jq

# Extract USDC_ksUSDT LP balance
LP_BALANCE_FLOAT=$(echo "$USER_BALANCES" | jq -r '.Ok[] | select(.LP.symbol == "USDC_ksUSDT") | .LP.balance' 2>/dev/null || echo "0")
if [ -z "$LP_BALANCE_FLOAT" ] || [ "$LP_BALANCE_FLOAT" = "null" ] || [ "$LP_BALANCE_FLOAT" = "0" ]; then
    print_error "No USDC_ksUSDT LP tokens found"
    exit 1
fi

# Convert float to base units (8 decimals for LP tokens)
REMOVE_LP_TOKEN_AMOUNT=$(echo "$LP_BALANCE_FLOAT * 100000000" | bc | cut -d. -f1)
print_success "Found LP tokens: $LP_BALANCE_FLOAT (${REMOVE_LP_TOKEN_AMOUNT} base units)"

# Check pool state
print_info "Checking pool state..."
POOL_INFO=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} pools --output json)
USDC_KSUSDT_POOL=$(echo "$POOL_INFO" | jq '.Ok[] | select(.symbol == "USDC_ksUSDT")')
print_info "Current pool reserves:"
echo "$USDC_KSUSDT_POOL" | jq '{balance_0, balance_1, lp_fee_0, lp_fee_1}'

# Step 2: Execute remove liquidity
print_header "STEP 2: EXECUTE REMOVE LIQUIDITY"
print_info "Removing liquidity from USDC/ksUSDT pool..."

# Remove liquidity call with payout address for Solana token
REMOVE_LIQUIDITY_CALL="(record {
    token_0 = \"${TOKEN_0}\";
    token_1 = \"${TOKEN_1}\";
    remove_lp_token_amount = ${REMOVE_LP_TOKEN_AMOUNT};
    payout_address_0 = opt \"${USER_SOLANA_ADDRESS}\";  # Required for USDC (Solana token)
    payout_address_1 = null;  # Not needed for IC token (ksUSDT)
})"

print_debug "Remove liquidity call:"
echo "$REMOVE_LIQUIDITY_CALL"

print_info "Submitting remove liquidity request..."
REMOVE_LIQUIDITY_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} remove_liquidity "$REMOVE_LIQUIDITY_CALL" 2>&1)

# Check result more carefully
if echo "${REMOVE_LIQUIDITY_RESULT}" | grep -q "Ok ="; then
    print_success "Liquidity removed successfully!"
    echo "${REMOVE_LIQUIDITY_RESULT}"
    
    # Extract claim IDs if any
    CLAIM_IDS=$(echo "${REMOVE_LIQUIDITY_RESULT}" | grep -oE 'claim_ids = vec \{[^}]*\}' | grep -oE '[0-9]+' || echo "")
    if [ ! -z "$CLAIM_IDS" ]; then
        print_info "Claim IDs created: $CLAIM_IDS"
        for CLAIM_ID in $CLAIM_IDS; do
            if echo "${REMOVE_LIQUIDITY_RESULT}" | grep -q "job_"; then
                print_success "Solana swap job created for claim $CLAIM_ID"
            else
                print_info "Note: Claim $CLAIM_ID needs to be processed"
            fi
        done
    fi
else
    print_error "Remove liquidity failed:"
    echo "${REMOVE_LIQUIDITY_RESULT}"
    
    # Try to extract more specific error
    if echo "${REMOVE_LIQUIDITY_RESULT}" | grep -q "Err ="; then
        ERROR_MSG=$(echo "${REMOVE_LIQUIDITY_RESULT}" | grep -A5 "Err =" || true)
        print_error "Error details: $ERROR_MSG"
    fi
    exit 1
fi

# Step 3: Verification
print_header "VERIFICATION"

# Check LP token balance
print_info "Checking remaining LP token balance..."
UPDATED_USER_BALANCES=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} user_balances "(\"${USER_IC_PRINCIPAL}\")" --output json)
UPDATED_LP_BALANCE_FLOAT=$(echo "$UPDATED_USER_BALANCES" | jq -r '.Ok[] | select(.LP.symbol == "USDC_ksUSDT") | .LP.balance' 2>/dev/null || echo "0")
if [ -z "$UPDATED_LP_BALANCE_FLOAT" ] || [ "$UPDATED_LP_BALANCE_FLOAT" = "null" ]; then
    print_success "All LP tokens removed successfully"
else
    print_info "Remaining LP tokens: $UPDATED_LP_BALANCE_FLOAT"
fi

# Check ksUSDT balance
print_info "Checking ksUSDT balance..."
KSUSDT_BALANCE=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ksusdt_ledger icrc1_balance_of "(record {
    owner = principal \"${USER_IC_PRINCIPAL}\";
})")
print_success "ksUSDT balance: $KSUSDT_BALANCE"

# Check for any pending claims
print_info "Checking for pending claims..."
CLAIMS=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} claims --output json)
echo "$CLAIMS"

# Check updated pool state
print_info "Checking updated pool state..."
UPDATED_POOL_INFO=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} pools --output json)
UPDATED_USDC_KSUSDT_POOL=$(echo "$UPDATED_POOL_INFO" | jq '.Ok[] | select(.symbol == "USDC_ksUSDT")')
print_success "Updated pool state:"
echo "$UPDATED_USDC_KSUSDT_POOL" | jq