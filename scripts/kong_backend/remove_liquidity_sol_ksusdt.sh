#!/usr/bin/env bash

# Script to remove liquidity from SOL/ksUSDT pool
# This demonstrates removing liquidity with cross-chain tokens (SOL to Solana, ksUSDT to IC)

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
TOKEN_0="SOL"
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

# Extract SOL_ksUSDT LP balance
LP_BALANCE_FLOAT=$(echo "$USER_BALANCES" | jq -r '.Ok[] | select(.LP.symbol == "SOL_ksUSDT") | .LP.balance' 2>/dev/null || echo "0")
if [ -z "$LP_BALANCE_FLOAT" ] || [ "$LP_BALANCE_FLOAT" = "null" ] || [ "$LP_BALANCE_FLOAT" = "0" ]; then
    print_error "No SOL_ksUSDT LP tokens found"
    exit 1
fi

# Convert float to base units (8 decimals for LP tokens)
REMOVE_LP_TOKEN_AMOUNT=$(echo "$LP_BALANCE_FLOAT * 100000000" | bc | cut -d. -f1)
print_success "Found LP tokens: $LP_BALANCE_FLOAT (${REMOVE_LP_TOKEN_AMOUNT} base units)"

# Check pool state
print_info "Checking pool state..."
POOL_INFO=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} pools --output json)
SOL_KSUSDT_POOL=$(echo "$POOL_INFO" | jq '.Ok[] | select(.symbol == "SOL_ksUSDT")')
print_info "Current pool reserves:"
echo "$SOL_KSUSDT_POOL" | jq '{balance_0, balance_1, lp_fee_0, lp_fee_1}'

# Step 2: Execute remove liquidity
print_header "STEP 2: EXECUTE REMOVE LIQUIDITY"
print_info "Removing liquidity from SOL/ksUSDT pool..."

# Remove liquidity call with payout address for Solana token
REMOVE_LIQUIDITY_CALL="(record {
    token_0 = \"${TOKEN_0}\";
    token_1 = \"${TOKEN_1}\";
    remove_lp_token_amount = ${REMOVE_LP_TOKEN_AMOUNT};
    payout_address_0 = opt \"${USER_SOLANA_ADDRESS}\";  # Required for SOL
    payout_address_1 = null;  # Not needed for IC token (ksUSDT)
})"

print_debug "Remove liquidity call:"
echo "$REMOVE_LIQUIDITY_CALL"

print_info "Submitting remove liquidity request..."
REMOVE_LIQUIDITY_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} remove_liquidity --output json "$REMOVE_LIQUIDITY_CALL" 2>&1)

# Check result
if echo "${REMOVE_LIQUIDITY_RESULT}" | grep -q "\"Ok\""; then
    print_success "Liquidity removed successfully!"
    echo "${REMOVE_LIQUIDITY_RESULT}" | jq
    
    # Extract claim IDs if any
    CLAIM_IDS=$(echo "${REMOVE_LIQUIDITY_RESULT}" | jq '.Ok.claim_ids[]' 2>/dev/null || echo "")
    if [ ! -z "$CLAIM_IDS" ]; then
        print_info "Note: Some tokens were sent as claims. Claim IDs: $CLAIM_IDS"
    fi
else
    print_error "Remove liquidity failed:"
    echo "${REMOVE_LIQUIDITY_RESULT}"
    exit 1
fi

# Step 3: Verification
print_header "VERIFICATION"

# Check LP token balance
print_info "Checking remaining LP token balance..."
UPDATED_USER_BALANCES=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} user_balances "(\"${USER_IC_PRINCIPAL}\")" --output json)
UPDATED_LP_BALANCE_FLOAT=$(echo "$UPDATED_USER_BALANCES" | jq -r '.Ok[] | select(.LP.symbol == "SOL_ksUSDT") | .LP.balance' 2>/dev/null || echo "0")
if [ -z "$UPDATED_LP_BALANCE_FLOAT" ] || [ "$UPDATED_LP_BALANCE_FLOAT" = "null" ]; then
    print_success "All LP tokens removed successfully"
else
    print_info "Remaining LP tokens: $UPDATED_LP_BALANCE_FLOAT"
fi

# Check SOL balance
print_info "Checking SOL balance..."
solana balance

# Check ksUSDT balance
print_info "Checking ksUSDT balance..."
KSUSDT_BALANCE=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ksusdt_ledger icrc1_balance_of "(record {
    owner = principal \"${USER_IC_PRINCIPAL}\";
})")
print_success "ksUSDT balance: $KSUSDT_BALANCE"

# Check for any pending claims
print_info "Checking for pending claims..."
CLAIMS=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} claims '()' --output json)
USER_CLAIMS=$(echo "$CLAIMS" | jq '.Ok[] | select(.user_id == "'$USER_IC_PRINCIPAL'")' 2>/dev/null || echo "")
if [ ! -z "$USER_CLAIMS" ] && [ "$USER_CLAIMS" != "null" ]; then
    print_info "Pending claims found:"
    echo "$USER_CLAIMS" | jq
else
    print_success "No pending claims"
fi

# Check updated pool state
print_info "Checking updated pool state..."
UPDATED_POOL_INFO=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} pools '()' --output json)
UPDATED_SOL_KSUSDT_POOL=$(echo "$UPDATED_POOL_INFO" | jq '.Ok[] | select(.symbol == "SOL_ksUSDT")')
print_success "Updated pool state:"
echo "$UPDATED_SOL_KSUSDT_POOL" | jq