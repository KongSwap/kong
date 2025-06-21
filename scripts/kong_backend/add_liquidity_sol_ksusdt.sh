#!/usr/bin/env bash

# Script to add liquidity to SOL/ksUSDT pool
# This demonstrates adding liquidity with cross-chain tokens (SOL from Solana, ksUSDT from IC)

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
TOKEN_0_AMOUNT=1_000_000  # 0.001 SOL (9 decimals)
TOKEN_0_AMOUNT=${TOKEN_0_AMOUNT//_/}  # remove underscore

TOKEN_1="ksUSDT"
TOKEN_1_AMOUNT=250_000  # 0.25 ksUSDT (6 decimals) - roughly matching SOL value
TOKEN_1_AMOUNT=${TOKEN_1_AMOUNT//_/}  # remove underscore
TOKEN_1_LEDGER=$(dfx canister id ${NETWORK_FLAG} ksusdt_ledger)

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

# Get Kong's addresses
print_header "SETUP"
KONG_SOLANA_ADDRESS=$(dfx canister call kong_backend get_solana_address ${NETWORK_FLAG} --output json | jq -r '.Ok // .Err')
if [ -z "$KONG_SOLANA_ADDRESS" ] || [ "$KONG_SOLANA_ADDRESS" = "null" ] || echo "$KONG_SOLANA_ADDRESS" | grep -q "Error"; then
    print_error "Failed to get Kong Solana address"
    exit 1
fi
print_success "Kong Solana address: $KONG_SOLANA_ADDRESS"

# Get user's addresses
USER_SOLANA_ADDRESS=$(solana address)
print_success "User Solana address: $USER_SOLANA_ADDRESS"

USER_IC_PRINCIPAL=$(dfx identity get-principal ${IDENTITY})
print_success "User IC principal: $USER_IC_PRINCIPAL"

# Get Kong backend principal for IC transfers
KONG_BACKEND_PRINCIPAL=$(dfx canister id kong_backend)
print_success "Kong backend principal: $KONG_BACKEND_PRINCIPAL"

# Step 1: Check current pool state
print_header "STEP 1: CHECK POOL STATE"
print_info "Getting current pool information..."
POOL_INFO=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} pools --output json)
SOL_KSUSDT_POOL=$(echo "$POOL_INFO" | jq '.Ok[] | select(.symbol == "SOL_ksUSDT")')
print_success "Current pool state:"
echo "$SOL_KSUSDT_POOL" | jq

# Step 2: Get add liquidity quote
print_header "STEP 2: GET ADD LIQUIDITY QUOTE"
print_info "Getting quote for adding liquidity..."
ADD_LIQUIDITY_QUOTE=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} add_liquidity_amounts "(\"${TOKEN_0}\", ${TOKEN_0_AMOUNT}, \"${TOKEN_1}\")")
print_success "Add liquidity quote: ${ADD_LIQUIDITY_QUOTE}"

# Step 3: Transfer SOL to Kong's address
print_header "STEP 3: TRANSFER SOL TO KONG"
print_info "Transferring $(echo "scale=9; $TOKEN_0_AMOUNT / 1000000000" | bc) SOL to Kong..."

# Transfer SOL
TRANSFER_OUTPUT=$(solana transfer --allow-unfunded-recipient "$KONG_SOLANA_ADDRESS" $(echo "scale=9; $TOKEN_0_AMOUNT / 1000000000" | bc) 2>&1)
SOL_TX_SIG=$(echo "$TRANSFER_OUTPUT" | grep "Signature" | awk '{print $2}' | tr -d '[]"')

if [ -z "$SOL_TX_SIG" ]; then
    print_error "SOL transfer failed"
    echo "$TRANSFER_OUTPUT"
    exit 1
fi

print_success "SOL transferred!"
print_info "Transaction signature: $SOL_TX_SIG"

# Step 4: Set ksUSDT allowance
print_header "STEP 4: SET ksUSDT ALLOWANCE"

# Always reset and set fresh allowance to avoid issues
print_info "Resetting allowance to 0..."
RESET_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${TOKEN_1_LEDGER} icrc2_approve "(record {
    amount = 0;
    spender = record {
        owner = principal \"${KONG_BACKEND_PRINCIPAL}\";
    };
})" 2>&1)
print_debug "Reset result: $RESET_RESULT"

# Get the fee
KSUSDT_FEE=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${TOKEN_1_LEDGER} icrc1_fee | grep -oE '[0-9_]+' | head -1)
KSUSDT_FEE=${KSUSDT_FEE//_/}
print_info "ksUSDT fee: $KSUSDT_FEE"

# Now set the new allowance including fee
APPROVE_AMOUNT=$((TOKEN_1_AMOUNT + KSUSDT_FEE))
print_info "Approving Kong backend to spend $APPROVE_AMOUNT ksUSDT (amount: $TOKEN_1_AMOUNT + fee: $KSUSDT_FEE)..."
APPROVE_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${TOKEN_1_LEDGER} icrc2_approve "(record {
    amount = ${APPROVE_AMOUNT};
    spender = record {
        owner = principal \"${KONG_BACKEND_PRINCIPAL}\";
    };
})" --output json)
print_success "Approval result: $APPROVE_RESULT"

# Step 5: Wait for SOL transaction confirmation
print_header "STEP 5: WAIT FOR CONFIRMATION"
print_info "Waiting for SOL transaction confirmation and kong_rpc processing..."
print_info "This takes about 10-15 seconds..."
sleep 15

# Step 6: Create and sign canonical add liquidity message
print_header "STEP 6: CREATE SIGNATURE"

# Create timestamp (milliseconds)
TIMESTAMP=$(echo "$(date +%s) * 1000" | bc)

# Create canonical add liquidity message
# Note: The message format must match CanonicalAddLiquidityMessage in the backend
MESSAGE_JSON=$(cat <<EOF
{
  "token_0": "${TOKEN_0}",
  "amount_0": $TOKEN_0_AMOUNT,
  "token_1": "${TOKEN_1}",
  "amount_1": $TOKEN_1_AMOUNT,
  "timestamp": $TIMESTAMP
}
EOF
)

MESSAGE_COMPACT=$(echo "$MESSAGE_JSON" | jq -c .)
print_info "Signing canonical add liquidity message..."
print_debug "Message: $MESSAGE_COMPACT"

SIGNATURE=$(solana sign-offchain-message "$MESSAGE_COMPACT" 2>&1)
if [ -z "$SIGNATURE" ] || echo "$SIGNATURE" | grep -q "Error"; then
    print_error "Failed to sign message"
    echo "Signature output: $SIGNATURE"
    exit 1
fi

print_success "Message signed"
print_debug "Signature: $SIGNATURE"

# Step 7: Execute add liquidity
print_header "STEP 7: EXECUTE ADD LIQUIDITY"
print_info "Adding liquidity to SOL/ksUSDT pool..."

ADD_LIQUIDITY_CALL="(record {
    token_0 = \"${TOKEN_0}\";
    amount_0 = ${TOKEN_0_AMOUNT};
    tx_id_0 = opt variant { TransactionId = \"${SOL_TX_SIG}\" };
    token_1 = \"${TOKEN_1}\";
    amount_1 = ${TOKEN_1_AMOUNT};
    tx_id_1 = null;
    signature_0 = opt \"${SIGNATURE}\";
    signature_1 = null;
    timestamp = opt ${TIMESTAMP};
})"

print_debug "Add liquidity call:"
echo "$ADD_LIQUIDITY_CALL"

print_info "Submitting add liquidity request..."
ADD_LIQUIDITY_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} add_liquidity "$ADD_LIQUIDITY_CALL" 2>&1)

# Check result more carefully
if echo "${ADD_LIQUIDITY_RESULT}" | grep -q "Ok ="; then
    print_success "Liquidity added successfully!"
    echo "${ADD_LIQUIDITY_RESULT}"
    
    # Extract LP token amount
    LP_AMOUNT=$(echo "${ADD_LIQUIDITY_RESULT}" | grep -oE 'add_lp_token_amount = [0-9_]+' | awk '{print $3}')
    print_success "Received LP tokens: $LP_AMOUNT"
else
    print_error "Add liquidity failed:"
    echo "${ADD_LIQUIDITY_RESULT}"
    
    # Try to extract more specific error
    if echo "${ADD_LIQUIDITY_RESULT}" | grep -q "Err ="; then
        ERROR_MSG=$(echo "${ADD_LIQUIDITY_RESULT}" | grep -A5 "Err =" || true)
        print_error "Error details: $ERROR_MSG"
    fi
    exit 1
fi

# Step 8: Verification
print_header "VERIFICATION"

# Check SOL balance
print_info "Checking SOL balance..."
solana balance

# Check ksUSDT balance
print_info "Checking ksUSDT balance..."
dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${TOKEN_1_LEDGER} icrc1_balance_of "(record {
    owner = principal \"${USER_IC_PRINCIPAL}\";
})"

# Check LP token balance
print_info "Checking LP token balance..."
dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} user_balances --output json | jq '.Ok[] | select(.symbol == "SOL_ksUSDT")' || print_info "No LP token balance found yet"

# Check updated pool state
print_info "Checking updated pool state..."
UPDATED_POOL_INFO=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} pools --output json)
UPDATED_SOL_KSUSDT_POOL=$(echo "$UPDATED_POOL_INFO" | jq '.Ok[] | select(.symbol == "SOL_ksUSDT")')
print_success "Updated pool state:"
echo "$UPDATED_SOL_KSUSDT_POOL" | jq