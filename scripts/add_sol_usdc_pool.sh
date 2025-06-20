#!/usr/bin/env bash

# Script to create a SOL/USDC pool on Kong
# This creates a pool with native SOL and Solana USDC tokens

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
# SOL
SOL_AMOUNT=100_000_000  # 0.1 SOL (9 decimals)
SOL_AMOUNT=${SOL_AMOUNT//_/}  # remove underscore
SOL_CHAIN="SOL"
SOL_ADDRESS="11111111111111111111111111111111"  # Native SOL

# USDC (Solana)
USDC_SYMBOL="USDC"
USDC_CHAIN="SOL"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC mint address on Solana
USDC_AMOUNT=100_000_000  # 100 USDC (6 decimals)
USDC_AMOUNT=${USDC_AMOUNT//_/}

# Pool configuration
LP_FEE_BPS=30  # 0.3% fee

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

# Get Kong's Solana address
print_header "SETUP"
KONG_SOLANA_ADDRESS=$(dfx canister call kong_backend get_solana_address ${NETWORK_FLAG} --output json | jq -r '.Ok // .Err')
if [ -z "$KONG_SOLANA_ADDRESS" ] || [ "$KONG_SOLANA_ADDRESS" = "null" ] || echo "$KONG_SOLANA_ADDRESS" | grep -q "Error"; then
    print_error "Failed to get Kong Solana address"
    exit 1
fi
print_success "Kong Solana address: $KONG_SOLANA_ADDRESS"

# Get user's Solana address
USER_SOLANA_ADDRESS=$(solana address)
print_success "User Solana address: $USER_SOLANA_ADDRESS"

# Get user's IC principal (using kong_user1)
USER_IC_PRINCIPAL=$(dfx identity get-principal ${IDENTITY})
print_success "User IC principal (kong_user1): $USER_IC_PRINCIPAL"

# Step 1: Check if tokens exist
print_header "STEP 1: CHECK TOKENS"
print_info "Checking if SOL and USDC tokens are registered..."

TOKEN_CHECK=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} tokens)
if ! echo "$TOKEN_CHECK" | grep -q "SOL"; then
    print_error "SOL token not found. Please add SOL token first."
    exit 1
fi
if ! echo "$TOKEN_CHECK" | grep -q "USDC"; then
    print_error "USDC token not found. Please add USDC token first."
    exit 1
fi
print_success "Both SOL and USDC tokens are registered"

# Step 2: Transfer SOL to Kong's address
print_header "STEP 2: TRANSFER SOL"
print_info "Transferring $(echo "scale=9; $SOL_AMOUNT / 1000000000" | bc) SOL to Kong..."

# Transfer SOL
TRANSFER_OUTPUT=$(solana transfer --allow-unfunded-recipient "$KONG_SOLANA_ADDRESS" $(echo "scale=9; $SOL_AMOUNT / 1000000000" | bc) 2>&1)
SOL_TX_SIG=$(echo "$TRANSFER_OUTPUT" | grep "Signature" | awk '{print $2}' | tr -d '[]"')

if [ -z "$SOL_TX_SIG" ]; then
    print_error "SOL transfer failed"
    echo "$TRANSFER_OUTPUT"
    exit 1
fi

print_success "SOL transferred!"
print_info "Transaction: $SOL_TX_SIG"

# Step 3: Transfer USDC to Kong's address
print_header "STEP 3: TRANSFER USDC"
print_info "Transferring $(echo "scale=6; $USDC_AMOUNT / 1000000" | bc) USDC to Kong..."

# Get Kong's USDC token account
KONG_USDC_ACCOUNT=$(spl-token address --token "$USDC_MINT" --owner "$KONG_SOLANA_ADDRESS" --verbose | grep -A1 "Wallet address:" | tail -1 | awk '{print $3}')

if [ -z "$KONG_USDC_ACCOUNT" ]; then
    print_info "Kong's USDC account doesn't exist, it will be created during transfer"
fi

# Transfer USDC (this will create the account if needed)
USDC_TRANSFER_OUTPUT=$(spl-token transfer "$USDC_MINT" $(echo "scale=6; $USDC_AMOUNT / 1000000" | bc) "$KONG_SOLANA_ADDRESS" --allow-unfunded-recipient --fund-recipient 2>&1)
USDC_TX_SIG=$(echo "$USDC_TRANSFER_OUTPUT" | grep "Signature" | awk '{print $2}' | tr -d '[]"')

if [ -z "$USDC_TX_SIG" ]; then
    print_error "USDC transfer failed"
    echo "$USDC_TRANSFER_OUTPUT"
    exit 1
fi

print_success "USDC transferred!"
print_info "Transaction: $USDC_TX_SIG"

# Step 4: Wait for transaction confirmation
print_header "STEP 4: WAIT FOR CONFIRMATION"
print_info "Waiting for transaction confirmation and kong_rpc processing..."
print_info "This may take 30-45 seconds..."
sleep 45

# Step 5: Create canonical pool message and sign it
print_header "STEP 5: CREATE SIGNATURES"

# Create timestamp (milliseconds)
TIMESTAMP=$(echo "$(date +%s) * 1000" | bc)

# Create canonical pool message for SOL
SOL_MESSAGE_JSON=$(cat <<EOF
{
  "token_0": "${SOL_CHAIN}.${SOL_ADDRESS}",
  "amount_0": $SOL_AMOUNT,
  "token_1": "${USDC_CHAIN}.${USDC_MINT}",
  "amount_1": $USDC_AMOUNT,
  "lp_fee_bps": $LP_FEE_BPS,
  "timestamp": $TIMESTAMP
}
EOF
)

SOL_MESSAGE_COMPACT=$(echo "$SOL_MESSAGE_JSON" | jq -c .)
print_info "Signing SOL pool message..."
print_debug "SOL Message: $SOL_MESSAGE_COMPACT"

SOL_SIGNATURE=$(solana sign-offchain-message "$SOL_MESSAGE_COMPACT" 2>&1)
if [ -z "$SOL_SIGNATURE" ] || echo "$SOL_SIGNATURE" | grep -q "Error"; then
    print_error "Failed to sign SOL message"
    echo "Signature output: $SOL_SIGNATURE"
    exit 1
fi

print_success "SOL message signed"

# Create canonical pool message for USDC
USDC_MESSAGE_JSON=$(cat <<EOF
{
  "token_0": "${SOL_CHAIN}.${SOL_ADDRESS}",
  "amount_0": $SOL_AMOUNT,
  "token_1": "${USDC_CHAIN}.${USDC_MINT}",
  "amount_1": $USDC_AMOUNT,
  "lp_fee_bps": $LP_FEE_BPS,
  "timestamp": $TIMESTAMP
}
EOF
)

USDC_MESSAGE_COMPACT=$(echo "$USDC_MESSAGE_JSON" | jq -c .)
print_info "Signing USDC pool message..."
print_debug "USDC Message: $USDC_MESSAGE_COMPACT"

USDC_SIGNATURE=$(solana sign-offchain-message "$USDC_MESSAGE_COMPACT" 2>&1)
if [ -z "$USDC_SIGNATURE" ] || echo "$USDC_SIGNATURE" | grep -q "Error"; then
    print_error "Failed to sign USDC message"
    echo "Signature output: $USDC_SIGNATURE"
    exit 1
fi

print_success "USDC message signed"

# Step 6: Create the pool
print_header "STEP 6: CREATE POOL"
print_info "Creating SOL/USDC pool..."

POOL_CALL="(record {
    token_0 = \"${SOL_CHAIN}.${SOL_ADDRESS}\";
    amount_0 = ${SOL_AMOUNT};
    tx_id_0 = opt variant { TransactionId = \"${SOL_TX_SIG}\" };
    token_1 = \"${USDC_CHAIN}.${USDC_MINT}\";
    amount_1 = ${USDC_AMOUNT};
    tx_id_1 = opt variant { TransactionId = \"${USDC_TX_SIG}\" };
    lp_fee_bps = opt ${LP_FEE_BPS};
    signature_0 = opt \"${SOL_SIGNATURE}\";
    signature_1 = opt \"${USDC_SIGNATURE}\";
    timestamp = opt ${TIMESTAMP};
})"

print_debug "Pool call:"
echo "$POOL_CALL"

print_info "Submitting pool creation..."
POOL_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} add_pool --output json "$POOL_CALL" 2>&1)

# Check result
if echo "${POOL_RESULT}" | grep -q "\"Ok\""; then
    print_success "Pool created successfully!"
    echo "${POOL_RESULT}" | jq
else
    print_error "Pool creation failed:"
    echo "${POOL_RESULT}"
fi

print_header "VERIFICATION"
print_info "Checking if SOL/USDC pool exists..."
dfx canister call ${NETWORK_FLAG} kong_backend pools | grep -A10 -B10 "SOL_USDC" || print_info "SOL/USDC pool not found in initial check"

# Also check swap amounts
print_info "Testing swap amounts for SOL -> USDC..."
dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} swap_amounts "(\"SOL\", 10_000_000, \"USDC\")"