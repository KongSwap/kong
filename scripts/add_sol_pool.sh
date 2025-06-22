#!/usr/bin/env bash

# Fixed version of SOL pool creation script with proper canonical pool message
# Signs the correct message format expected by PoolPaymentVerifier

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
SOL_AMOUNT=10_000_000  # 0.01 SOL (9 decimals)
SOL_AMOUNT=${SOL_AMOUNT//_/}  # remove underscore
SOL_CHAIN="SOL"
SOL_ADDRESS="11111111111111111111111111111111"  # Native SOL

# ksUSDT configuration
KSUSDT_SYMBOL="ksUSDT"
KSUSDT_CHAIN="IC"
KSUSDT_LEDGER=$(dfx canister id ${NETWORK_FLAG} $(echo ${KSUSDT_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSUSDT_AMOUNT=10_000_000  # 10 ksUSDT (6 decimals)
KSUSDT_AMOUNT=${KSUSDT_AMOUNT//_/}
KSUSDT_FEE=10000  # Standard fee

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

# Step 1: Add SOL token (if needed)
print_header "STEP 1: ADD SOL TOKEN"
TOKEN_EXISTS=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} tokens | grep -c "SOL" || true)
if [ "$TOKEN_EXISTS" -gt 0 ]; then
    print_info "SOL token already exists, skipping..."
else
    print_info "Adding SOL token..."
    SOL_TOKEN_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KONG_BACKEND} add_token --output json "(record {
        token = \"${SOL_CHAIN}.${SOL_ADDRESS}\";
        on_kong = opt true;
    })" 2>&1)
    
    if echo "${SOL_TOKEN_RESULT}" | grep -q "Ok"; then
        print_success "SOL token added successfully!"
    else
        print_error "Failed to add SOL token: ${SOL_TOKEN_RESULT}"
        exit 1
    fi
fi

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

# Step 3: Wait for transaction confirmation
print_header "STEP 3: WAIT FOR CONFIRMATION"
print_info "Waiting for transaction confirmation..."

echo "sleeping for 5 seconds"
sleep 5

# Step 4: Approve ksUSDT spending
print_header "STEP 4: APPROVE KSUSDT"
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 300000000000" | bc)  # 5 minutes from now
APPROVE_AMOUNT=$((KSUSDT_AMOUNT + KSUSDT_FEE))

print_info "Approving $APPROVE_AMOUNT ksUSDT..."
APPROVE_RESULT=$(dfx canister call ${NETWORK_FLAG} ${IDENTITY} ${KSUSDT_LEDGER} icrc2_approve "(record {
    amount = ${APPROVE_AMOUNT};
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_BACKEND}\";
    };
})" 2>&1)

if echo "$APPROVE_RESULT" | grep -q "Err"; then
    print_error "ksUSDT approval failed: $APPROVE_RESULT"
    exit 1
fi
print_success "ksUSDT approved!"

# Step 5: Create canonical pool message and sign it
print_header "STEP 5: CREATE SIGNATURE"

# Create timestamp (milliseconds)
TIMESTAMP=$(echo "$(date +%s) * 1000" | bc)

# Create canonical pool message
MESSAGE_JSON=$(cat <<EOF
{
  "token_0": "${SOL_CHAIN}.${SOL_ADDRESS}",
  "amount_0": $SOL_AMOUNT,
  "token_1": "${KSUSDT_CHAIN}.${KSUSDT_LEDGER}",
  "amount_1": $KSUSDT_AMOUNT,
  "lp_fee_bps": 30,
  "timestamp": $TIMESTAMP
}
EOF
)

MESSAGE_COMPACT=$(echo "$MESSAGE_JSON" | jq -c .)
print_info "Signing canonical pool message..."
print_debug "Message: $MESSAGE_COMPACT"

SIGNATURE=$(solana sign-offchain-message "$MESSAGE_COMPACT" 2>&1)
if [ -z "$SIGNATURE" ] || echo "$SIGNATURE" | grep -q "Error"; then
    print_error "Failed to sign message"
    echo "Signature output: $SIGNATURE"
    exit 1
fi

print_success "Message signed"

# Step 6: Create the pool with proper cross-chain data
print_header "STEP 6: CREATE POOL"
print_info "Creating SOL/ksUSDT pool..."

POOL_CALL="(record {
    token_0 = \"${SOL_CHAIN}.${SOL_ADDRESS}\";
    amount_0 = ${SOL_AMOUNT};
    tx_id_0 = opt variant { TransactionId = \"${SOL_TX_SIG}\" };
    token_1 = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    amount_1 = ${KSUSDT_AMOUNT};
    tx_id_1 = null;
    lp_fee_bps = opt 30;
    signature_0 = opt \"${SIGNATURE}\";
    signature_1 = null;
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
print_info "Checking if SOL pool exists..."
dfx canister call ${NETWORK_FLAG} kong_backend pools | grep -A10 -B10 "SOL" || print_info "SOL pool not found"