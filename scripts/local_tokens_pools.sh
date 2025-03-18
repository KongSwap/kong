#!/usr/bin/env bash

set -e  # Exit on error

# Colors for pretty output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Set network and prepare environment
NETWORK=${1:-local}
NETWORK_ARG="--network ${NETWORK}"

log_info "Creating tokens and pools on ${NETWORK} network..."

# Get Kong backend canister ID
KONG_CANISTER=$(dfx canister id ${NETWORK_ARG} kong_backend)
log_info "Kong Backend canister ID: ${KONG_CANISTER}"

# 1. Add ksUSDT token
# Only controller (kong) can add token
dfx identity use kong
log_info "Using kong identity to add tokens"

# Get ksUSDT ledger info
KSUSDT_LEDGER=$(dfx canister id ${NETWORK_ARG} ksusdt_ledger)
log_info "ksUSDT ledger canister ID: ${KSUSDT_LEDGER}"

# Add ksUSDT token to Kong DEX
log_info "Adding ksUSDT token to Kong DEX..."
dfx canister call ${NETWORK_ARG} ${KONG_CANISTER} add_token "(record {
  token = \"IC.${KSUSDT_LEDGER}\";
  on_kong = opt true;
})" 

# Get ksICP ledger info
KSICP_LEDGER=$(dfx canister id ${NETWORK_ARG} ksicp_ledger)
log_info "ksICP ledger canister ID: ${KSICP_LEDGER}"

# Add ksICP token to Kong DEX
log_info "Adding ksICP token to Kong DEX..."
dfx canister call ${NETWORK_ARG} ${KONG_CANISTER} add_token "(record {
  token = \"IC.${KSICP_LEDGER}\";
  on_kong = opt true;
})"

# Get ksBTC ledger info
KSBTC_LEDGER=$(dfx canister id ${NETWORK_ARG} ksbtc_ledger)
log_info "ksBTC ledger canister ID: ${KSBTC_LEDGER}"

# Add ksBTC token to Kong DEX
log_info "Adding ksBTC token to Kong DEX..."
dfx canister call ${NETWORK_ARG} ${KONG_CANISTER} add_token "(record {
  token = \"IC.${KSBTC_LEDGER}\";
  on_kong = opt true;
})"

# 2. Add ksICP/ksUSDT pool
dfx identity use kong_user1
log_info "Using kong_user1 identity to create pools"

# ksICP/ksUSDT pool parameters
KSICP_AMOUNT=500000000000    # 5,000 ksICP with 8 decimals
KSUSDT_AMOUNT=37500000000    # 37,500 ksUSDT with 6 decimals
KSICP_FEE=10000              # Standard fee for approval
KSUSDT_FEE=10000             # Standard fee for approval

# Create expiry timestamp (60 seconds from now)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)

log_info "Creating ksICP/ksUSDT pool"
log_info "Parameters: ${KSICP_AMOUNT} ksICP and ${KSUSDT_AMOUNT} ksUSDT"

# Approve ksICP transfer
log_info "Approving ksICP transfer..."
dfx canister call ${NETWORK_ARG} ${KSICP_LEDGER} icrc2_approve "(record {
  amount = $(echo "${KSICP_AMOUNT} + ${KSICP_FEE}" | bc);
  expires_at = opt ${EXPIRES_AT};
  spender = record { owner = principal \"${KONG_CANISTER}\" };
})"

# Approve ksUSDT transfer
log_info "Approving ksUSDT transfer..."
dfx canister call ${NETWORK_ARG} ${KSUSDT_LEDGER} icrc2_approve "(record {
  amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
  expires_at = opt ${EXPIRES_AT};
  spender = record { owner = principal \"${KONG_CANISTER}\" };
})"

# Create ksICP/ksUSDT pool
log_info "Creating ksICP/ksUSDT pool..."
dfx canister call ${NETWORK_ARG} ${KONG_CANISTER} add_pool "(record {
  token_0 = \"IC.${KSICP_LEDGER}\";
  amount_0 = ${KSICP_AMOUNT};
  token_1 = \"IC.${KSUSDT_LEDGER}\";
  amount_1 = ${KSUSDT_AMOUNT};
  on_kong = opt true;
})"

# 3. Add ksBTC/ksUSDT pool
# ksBTC/ksUSDT pool parameters
KSBTC_AMOUNT=100000000       # 1 ksBTC with 8 decimals
KSUSDT_AMOUNT=58000000000    # 58,000 ksUSDT with 6 decimals
KSBTC_FEE=10000              # Standard fee for approval
KSUSDT_FEE=10000             # Standard fee for approval

# Create expiry timestamp (60 seconds from now)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)

log_info "Creating ksBTC/ksUSDT pool"
log_info "Parameters: ${KSBTC_AMOUNT} ksBTC and ${KSUSDT_AMOUNT} ksUSDT"

# Approve ksBTC transfer
log_info "Approving ksBTC transfer..."
dfx canister call ${NETWORK_ARG} ${KSBTC_LEDGER} icrc2_approve "(record {
  amount = $(echo "${KSBTC_AMOUNT} + ${KSBTC_FEE}" | bc);
  expires_at = opt ${EXPIRES_AT};
  spender = record { owner = principal \"${KONG_CANISTER}\" };
})"

# Approve ksUSDT transfer
log_info "Approving ksUSDT transfer..."
dfx canister call ${NETWORK_ARG} ${KSUSDT_LEDGER} icrc2_approve "(record {
  amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
  expires_at = opt ${EXPIRES_AT};
  spender = record { owner = principal \"${KONG_CANISTER}\" };
})"

# Create ksBTC/ksUSDT pool
log_info "Creating ksBTC/ksUSDT pool..."
dfx canister call ${NETWORK_ARG} ${KONG_CANISTER} add_pool "(record {
  token_0 = \"IC.${KSBTC_LEDGER}\";
  amount_0 = ${KSBTC_AMOUNT};
  token_1 = \"IC.${KSUSDT_LEDGER}\";
  amount_1 = ${KSUSDT_AMOUNT};
  on_kong = opt true;
})"

# Switch back to kong identity
dfx identity use kong

log_success "Tokens and pools created successfully!" 