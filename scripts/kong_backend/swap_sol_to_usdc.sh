#!/usr/bin/env bash

# Script to swap SOL to USDC
# This demonstrates swapping from native SOL to SPL token (USDC)

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
PAY_TOKEN="SOL"
PAY_AMOUNT=10_000_000  # 0.01 SOL (9 decimals)
PAY_AMOUNT=${PAY_AMOUNT//_/}  # remove underscore
SOL_CHAIN="SOL"
SOL_ADDRESS="11111111111111111111111111111111"  # Native SOL

RECEIVE_TOKEN="USDC"
RECEIVE_CHAIN="SOL"
RECEIVE_TOKEN_ADDRESS="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"  # Devnet USDC
RECEIVE_AMOUNT=0  # Let the system calculate optimal amount
MAX_SLIPPAGE=95.0  # 95% - high slippage for testing with small liquidity pools

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

# Get user's IC principal
USER_IC_PRINCIPAL=$(dfx identity get-principal ${IDENTITY})
print_success "User IC principal: $USER_IC_PRINCIPAL"

# Step 1: Get swap amounts quote
print_header "STEP 1: GET SWAP QUOTE"
print_info "Getting swap quote for ${PAY_TOKEN} -> ${RECEIVE_TOKEN}..."
SWAP_QUOTE=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} swap_amounts "(\"${PAY_TOKEN}\", ${PAY_AMOUNT}, \"${RECEIVE_TOKEN}\")")
print_success "Swap quote: ${SWAP_QUOTE}"

# Step 2: Transfer SOL to Kong's address
print_header "STEP 2: TRANSFER SOL TO KONG"
print_info "Transferring $(echo "scale=9; $PAY_AMOUNT / 1000000000" | bc) SOL to Kong..."

# Transfer SOL
TRANSFER_OUTPUT=$(solana transfer --allow-unfunded-recipient "$KONG_SOLANA_ADDRESS" $(echo "scale=9; $PAY_AMOUNT / 1000000000" | bc) 2>&1)
SOL_TX_SIG=$(echo "$TRANSFER_OUTPUT" | grep "Signature" | awk '{print $2}' | tr -d '[]"')

if [ -z "$SOL_TX_SIG" ]; then
    print_error "SOL transfer failed"
    echo "$TRANSFER_OUTPUT"
    exit 1
fi

print_success "SOL transferred!"
print_info "Transaction signature: $SOL_TX_SIG"

# Step 3: Wait for transaction confirmation
print_header "STEP 3: WAIT FOR CONFIRMATION"
print_info "Waiting for transaction confirmation and kong_rpc processing..."
print_info "This takes about 10-15 seconds..."
sleep 15

# Step 4: Create and sign canonical swap message
print_header "STEP 4: CREATE SIGNATURE"

# Create timestamp (milliseconds)
TIMESTAMP=$(echo "$(date +%s) * 1000" | bc)

# Create canonical swap message
MESSAGE_JSON=$(cat <<EOF
{
  "pay_token": "${PAY_TOKEN}",
  "pay_amount": $PAY_AMOUNT,
  "pay_address": "${USER_SOLANA_ADDRESS}",
  "receive_token": "${RECEIVE_TOKEN}",
  "receive_amount": $RECEIVE_AMOUNT,
  "receive_address": "${USER_SOLANA_ADDRESS}",
  "max_slippage": $MAX_SLIPPAGE,
  "timestamp": $TIMESTAMP,
  "referred_by": null
}
EOF
)

MESSAGE_COMPACT=$(echo "$MESSAGE_JSON" | jq -c .)
print_info "Signing canonical swap message..."
print_debug "Message: $MESSAGE_COMPACT"

SIGNATURE=$(solana sign-offchain-message "$MESSAGE_COMPACT" 2>&1)
if [ -z "$SIGNATURE" ] || echo "$SIGNATURE" | grep -q "Error"; then
    print_error "Failed to sign message"
    echo "Signature output: $SIGNATURE"
    exit 1
fi

print_success "Message signed"
print_debug "Signature: $SIGNATURE"

# Step 5: Execute the swap
print_header "STEP 5: EXECUTE SWAP"
print_info "Executing swap from SOL to USDC..."

SWAP_CALL="(record {
    pay_token = \"${PAY_TOKEN}\";
    pay_amount = ${PAY_AMOUNT};
    pay_tx_id = opt variant { TransactionId = \"${SOL_TX_SIG}\" };
    receive_token = \"${RECEIVE_TOKEN}\";
    receive_amount = opt ${RECEIVE_AMOUNT};
    max_slippage = opt ${MAX_SLIPPAGE};
    receive_address = opt \"${USER_SOLANA_ADDRESS}\";
    signature = opt \"${SIGNATURE}\";
    timestamp = opt ${TIMESTAMP};
})"

print_debug "Swap call:"
echo "$SWAP_CALL"

print_info "Submitting swap..."
SWAP_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} swap --output json "$SWAP_CALL" 2>&1)

# Check result
if echo "${SWAP_RESULT}" | grep -q "\"Ok\""; then
    print_success "Swap executed successfully!"
    echo "${SWAP_RESULT}" | jq
else
    print_error "Swap failed:"
    echo "${SWAP_RESULT}"
    exit 1
fi

# Step 6: Check balances
print_header "VERIFICATION"
print_info "Checking SOL balance..."
solana balance

print_info "Checking USDC balance..."
spl-token balance ${RECEIVE_TOKEN_ADDRESS} || print_info "No USDC balance found (might need to create ATA)"