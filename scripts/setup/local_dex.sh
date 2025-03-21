#!/bin/bash

echo "Please start Docker"

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

# Set variables
NETWORK="local"
IDENTITY="--identity kong"
KONG_BACKEND="kong_backend"
POSTGRES_CONTAINER="kong_api_postgres"
REDIS_CONTAINER="kong_api_redis"
API_PORT=8080
DFX_PORT=4943
API_DIR="apis"
PROJECT_ROOT=$(pwd)

# Export the project root for all scripts to use
export CANISTER_IDS_ROOT="${PROJECT_ROOT}"

# Ensure we're in the project root
if [ ! -f "dfx.json" ]; then
  log_error "This script must be run from the project root directory"
  exit 1
fi

# Check if dfx is installed
if ! command -v dfx &> /dev/null; then
  log_error "dfx is not installed. Please install it with 'sh -ci \"$(curl -fsSL https://internetcomputer.org/install.sh)\"'"
  exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  log_error "Docker is not running or not installed"
  exit 1
fi

# Function to start dfx if not already running
start_dfx() {
  log_info "Starting the Internet Computer replica..."
  
  # Stop any running dfx instances first
  dfx stop || true
  
  log_info "Starting a fresh dfx replica..."
  dfx start --clean --background
  
  # Wait for dfx to be ready
  local retry_count=0
  local max_retries=30
  
  while ! dfx ping &> /dev/null && [ $retry_count -lt $max_retries ]; do
    log_info "Waiting for dfx to start (${retry_count}/${max_retries})..."
    sleep 2
    retry_count=$((retry_count+1))
  done
  
  if [ $retry_count -eq $max_retries ]; then
    log_error "dfx failed to start after ${max_retries} attempts"
    exit 1
  fi
  
  log_success "dfx started successfully"
}

# Function to create user identities exactly as in the documentation
create_identities() {
  log_info "Creating user identities..."
  
  # Create 'kong' identity if it doesn't exist
  if ! dfx identity list | grep -q "kong"; then
    log_info "Creating 'kong' identity..."
    dfx identity new --storage-mode plaintext kong
    log_success "Created 'kong' identity"
  else
    log_info "'kong' identity already exists"
  fi
  
  # Create 'kong_token_minter' identity if it doesn't exist
  if ! dfx identity list | grep -q "kong_token_minter"; then
    log_info "Creating 'kong_token_minter' identity..."
    dfx identity new --storage-mode plaintext kong_token_minter
    log_success "Created 'kong_token_minter' identity"
  else
    log_info "'kong_token_minter' identity already exists"
  fi
  
  # Create 'kong_user1' identity if it doesn't exist
  if ! dfx identity list | grep -q "kong_user1"; then
    log_info "Creating 'kong_user1' identity..."
    dfx identity new --storage-mode plaintext kong_user1
    log_success "Created 'kong_user1' identity"
  else
    log_info "'kong_user1' identity already exists"
  fi
  
  # Create 'kong_user2' identity if it doesn't exist
  if ! dfx identity list | grep -q "kong_user2"; then
    log_info "Creating 'kong_user2' identity..."
    dfx identity new --storage-mode plaintext kong_user2
    log_success "Created 'kong_user2' identity"
  else
    log_info "'kong_user2' identity already exists"
  fi
  
  log_success "User identities created"
}

# Function to prepare canisters
prepare_canisters() {
  log_info "Preparing canisters..."
  
  # Create canister IDs
  if [ -f "scripts/create_canister_id.sh" ]; then
    log_info "Creating canister IDs..."
    # Use the environment variable to point to the correct directory
    CANISTER_IDS_ROOT="${PROJECT_ROOT}" bash scripts/create_canister_id.sh ${NETWORK}
  fi
  
  log_success "Canisters prepared"
}

# Function to deploy the Kong backend directly
deploy_kong_backend() {
  log_info "Deploying Kong backend..."
  
  # Ensure we're using the kong identity for deployment
  dfx identity use kong
  
  # Deploy kong_backend canister
  log_info "Deploying kong_backend canister..."
  CANISTER_IDS_ROOT="${PROJECT_ROOT}" KONG_BUILDENV="${NETWORK}" dfx deploy kong_backend --network ${NETWORK}
  
  # Get the Kong canister ID
  KONG_CANISTER=$(dfx canister id --network ${NETWORK} ${KONG_BACKEND})
  log_success "Kong backend deployed with canister ID: ${KONG_CANISTER}"
  
  # Ensure identity is still kong before we proceed
  current_identity=$(dfx identity whoami)
  if [ "$current_identity" != "kong" ]; then
    log_info "Switching back to kong identity..."
    dfx identity use kong
  fi
}

# Function to deploy Kong Data canister
deploy_kong_data() {
  log_info "Deploying Kong Data canister..."
  
  # Ensure we're using the kong identity for deployment
  dfx identity use kong
  
  # Deploy kong_data canister
  log_info "Deploying kong_data canister..."
  CANISTER_IDS_ROOT="${PROJECT_ROOT}" KONG_BUILDENV="${NETWORK}" dfx deploy kong_data --network ${NETWORK}
  
  # Get the Kong Data canister ID
  KONG_DATA_CANISTER=$(dfx canister id --network ${NETWORK} kong_data)
  log_success "Kong Data deployed with canister ID: ${KONG_DATA_CANISTER}"
  
  # Ensure identity is still kong before we proceed
  current_identity=$(dfx identity whoami)
  if [ "$current_identity" != "kong" ]; then
    log_info "Switching back to kong identity..."
    dfx identity use kong
  fi
}

# Function to enable archiving between kong_backend and kong_data
enable_archiving_to_kong_data() {
  log_info "Enabling archiving to kong_data..."
  
  # Get canister IDs
  KONG_CANISTER=$(dfx canister id --network ${NETWORK} kong_backend)
  KONG_DATA_CANISTER=$(dfx canister id --network ${NETWORK} kong_data)
  
  log_info "Kong backend canister ID: ${KONG_CANISTER}"
  log_info "Kong data canister ID: ${KONG_DATA_CANISTER}"
  
  # Call the set_kong_settings function to enable archiving
  log_info "Updating Kong settings to enable archiving..."
  dfx canister call ${KONG_CANISTER} set_kong_settings "(
    \"{\\\"archive_to_kong_data\\\": true, \\\"kong_data\\\": \\\"${KONG_DATA_CANISTER}\\\"}\"
  )" || log_warning "Failed to enable archiving to kong_data"
  
  log_success "Archiving to kong_data enabled"
}

# Function to deploy token ledgers
deploy_token_ledgers() {
  log_info "Deploying token ledgers..."
  
  # Make sure we're using the kong identity for deployment
  dfx identity use kong
  
  # Deploy ksICP ledger 
  if [ -f "scripts/deploy_ksicp_ledger.sh" ]; then
    log_info "Deploying ksICP ledger..."
    CANISTER_IDS_ROOT="${PROJECT_ROOT}" bash scripts/deploy_ksicp_ledger.sh ${NETWORK}
  fi
  
  # Deploy ksUSDT ledger
  if [ -f "scripts/deploy_ksusdt_ledger.sh" ]; then
    log_info "Deploying ksUSDT ledger..."
    CANISTER_IDS_ROOT="${PROJECT_ROOT}" bash scripts/deploy_ksusdt_ledger.sh ${NETWORK}
  fi
  
  # Deploy ksBTC ledger
  if [ -f "scripts/deploy_ksbtc_ledger.sh" ]; then
    log_info "Deploying ksBTC ledger..."
    CANISTER_IDS_ROOT="${PROJECT_ROOT}" bash scripts/deploy_ksbtc_ledger.sh ${NETWORK}
  fi
  
  # Initialize token_minter with appropriate role
  log_info "Initializing token ledgers complete. Note: ICRC ledgers don't use set_minter..."
  TOKEN_MINTER_PRINCIPAL=$(dfx identity get-principal --identity kong_token_minter)
  log_info "kong_token_minter principal is: ${TOKEN_MINTER_PRINCIPAL}"
  log_info "This principal should be the default minter for the token ledgers."
  
  log_success "Token ledgers deployed and initialized"
}

# Function to deploy Kong Faucet canister
deploy_kong_faucet() {
  log_info "Deploying Kong Faucet canister..."
  
  # Make sure we're using the kong identity for deployment
  dfx identity use kong
  
  # Deploy kong_faucet canister
  log_info "Deploying kong_faucet canister..."
  KONG_BUILDENV="${NETWORK}" dfx deploy kong_faucet --network ${NETWORK}
  
  # Log the canister ID
  FAUCET_CANISTER_ID=$(dfx canister id --network ${NETWORK} kong_faucet)
  log_success "Kong Faucet deployed with canister ID: ${FAUCET_CANISTER_ID}"
}

# Function to mint tokens to the faucet
mint_tokens_to_faucet() {
  log_info "Minting tokens to the faucet canister..."
  
  # Ensure we're using the kong_token_minter identity
  dfx identity use kong_token_minter
  
  # Get the faucet canister ID
  FAUCET_CANISTER_ID=$(dfx canister id --network ${NETWORK} kong_faucet)
  
  if [ -z "$FAUCET_CANISTER_ID" ]; then
    log_error "Could not get kong_faucet canister ID"
    return 1
  fi
  
  log_info "Kong faucet ID: ${FAUCET_CANISTER_ID}"
  
  # Mint tokens to the faucet
  if dfx canister id --network ${NETWORK} ksusdt_ledger &> /dev/null; then
    KSUSDT_LEDGER=$(dfx canister id --network ${NETWORK} ksusdt_ledger)
    log_info "Minting ksUSDT tokens to faucet (100,000,000 with 6 decimals)..."
    dfx canister call --network ${NETWORK} ${KSUSDT_LEDGER} icrc1_transfer "(record {
      to = record { owner = principal \"${FAUCET_CANISTER_ID}\" };
      amount = 100000000000000;
    })" || log_warning "Failed to mint ksUSDT to faucet"
  fi
  
  if dfx canister id --network ${NETWORK} ksicp_ledger &> /dev/null; then
    KSICP_LEDGER=$(dfx canister id --network ${NETWORK} ksicp_ledger)
    log_info "Minting ksICP tokens to faucet (10,000,000 with 8 decimals)..."
    dfx canister call --network ${NETWORK} ${KSICP_LEDGER} icrc1_transfer "(record {
      to = record { owner = principal \"${FAUCET_CANISTER_ID}\" };
      amount = 1000000000000000;
    })" || log_warning "Failed to mint ksICP to faucet"
  fi
  
  if dfx canister id --network ${NETWORK} ksbtc_ledger &> /dev/null; then
    KSBTC_LEDGER=$(dfx canister id --network ${NETWORK} ksbtc_ledger)
    log_info "Minting ksBTC tokens to faucet (1,500 with 8 decimals)..."
    dfx canister call --network ${NETWORK} ${KSBTC_LEDGER} icrc1_transfer "(record {
      to = record { owner = principal \"${FAUCET_CANISTER_ID}\" };
      amount = 150000000000;
    })" || log_warning "Failed to mint ksBTC to faucet"
  fi
  
  # Switch back to kong identity
  dfx identity use kong
  
  log_success "Tokens minted to faucet canister"
}

# Function to deploy Internet Identity canister
deploy_internet_identity() {
  log_info "Deploying Internet Identity canister..."
  
  # Make sure we're using the kong identity for deployment
  dfx identity use kong
  
  # Deploy internet_identity canister
  log_info "Deploying internet_identity canister..."
  dfx deploy internet_identity --network ${NETWORK}
  
  # Log the canister ID
  II_CANISTER_ID=$(dfx canister id --network ${NETWORK} internet_identity)
  log_success "Internet Identity deployed with canister ID: ${II_CANISTER_ID}"
}

# Function to mint initial tokens to identities
mint_initial_tokens() {
  log_info "Minting initial tokens to user identities..."
  
  # Ensure we're using the kong_token_minter identity for minting
  dfx identity use kong_token_minter
  
  # Get principal ID for kong identity
  KONG_PRINCIPAL=$(dfx identity get-principal --identity kong)
  
  # Get principal ID for kong_user1
  KONG_USER1_PRINCIPAL=$(dfx identity get-principal --identity kong_user1)
  
  # Mint to kong if principal is valid
  if [ -n "$KONG_PRINCIPAL" ]; then
    log_info "Minting tokens to kong (${KONG_PRINCIPAL})..."
    
    # Mint ksICP to kong (100,000 ksICP)
    if dfx canister id --network ${NETWORK} ksicp_ledger &> /dev/null; then
      KSICP_LEDGER=$(dfx canister id --network ${NETWORK} ksicp_ledger)
      log_info "Minting ksICP tokens to kong (100,000 with 8 decimals)..."
      dfx canister call --network ${NETWORK} ${KSICP_LEDGER} icrc1_transfer "(record {
        to = record { owner = principal \"${KONG_PRINCIPAL}\" };
        amount = 10000000000000;
      })" || log_warning "Failed to mint ksICP to kong"
    fi
    
    # Mint ksUSDT to kong (1,000,000 ksUSDT)
    if dfx canister id --network ${NETWORK} ksusdt_ledger &> /dev/null; then
      KSUSDT_LEDGER=$(dfx canister id --network ${NETWORK} ksusdt_ledger)
      log_info "Minting ksUSDT tokens to kong (1,000,000 with 6 decimals)..."
      dfx canister call --network ${NETWORK} ${KSUSDT_LEDGER} icrc1_transfer "(record {
        to = record { owner = principal \"${KONG_PRINCIPAL}\" };
        amount = 1000000000000;
      })" || log_warning "Failed to mint ksUSDT to kong"
    fi
    
    # Mint ksBTC to kong (5 ksBTC)
    if dfx canister id --network ${NETWORK} ksbtc_ledger &> /dev/null; then
      KSBTC_LEDGER=$(dfx canister id --network ${NETWORK} ksbtc_ledger)
      log_info "Minting ksBTC tokens to kong (5 with 8 decimals)..."
      dfx canister call --network ${NETWORK} ${KSBTC_LEDGER} icrc1_transfer "(record {
        to = record { owner = principal \"${KONG_PRINCIPAL}\" };
        amount = 500000000;
      })" || log_warning "Failed to mint ksBTC to kong"
    fi
  else
    log_warning "Could not get principal ID for kong"
  fi
  
  # Mint to kong_user1 if principal is valid
  if [ -n "$KONG_USER1_PRINCIPAL" ]; then
    log_info "Minting tokens to kong_user1 (${KONG_USER1_PRINCIPAL})..."
    
    # Mint ksICP to kong_user1 (100,000 ksICP)
    if dfx canister id --network ${NETWORK} ksicp_ledger &> /dev/null; then
      KSICP_LEDGER=$(dfx canister id --network ${NETWORK} ksicp_ledger)
      log_info "Minting ksICP tokens to kong_user1 (100,000 with 8 decimals)..."
      dfx canister call --network ${NETWORK} ${KSICP_LEDGER} icrc1_transfer "(record {
        to = record { owner = principal \"${KONG_USER1_PRINCIPAL}\" };
        amount = 10000000000000;
      })" || log_warning "Failed to mint ksICP to kong_user1"
    fi
    
    # Mint ksUSDT to kong_user1 (1,000,000 ksUSDT)
    if dfx canister id --network ${NETWORK} ksusdt_ledger &> /dev/null; then
      KSUSDT_LEDGER=$(dfx canister id --network ${NETWORK} ksusdt_ledger)
      log_info "Minting ksUSDT tokens to kong_user1 (1,000,000 with 6 decimals)..."
      dfx canister call --network ${NETWORK} ${KSUSDT_LEDGER} icrc1_transfer "(record {
        to = record { owner = principal \"${KONG_USER1_PRINCIPAL}\" };
        amount = 1000000000000;
      })" || log_warning "Failed to mint ksUSDT to kong_user1"
    fi
    
    # Mint ksBTC to kong_user1 (5 ksBTC)
    if dfx canister id --network ${NETWORK} ksbtc_ledger &> /dev/null; then
      KSBTC_LEDGER=$(dfx canister id --network ${NETWORK} ksbtc_ledger)
      log_info "Minting ksBTC tokens to kong_user1 (5 with 8 decimals)..."
      dfx canister call --network ${NETWORK} ${KSBTC_LEDGER} icrc1_transfer "(record {
        to = record { owner = principal \"${KONG_USER1_PRINCIPAL}\" };
        amount = 500000000;
      })" || log_warning "Failed to mint ksBTC to kong_user1"
    fi
  else
    log_warning "Could not get principal ID for kong_user1"
  fi
  
  # Switch back to kong identity
  dfx identity use kong
  
  log_success "Initial tokens minted"
}

# Function to create tokens and pools
create_tokens_and_pools() {
  log_info "Creating tokens and pools..."
  
  # Try our custom tokens_pools script first
  if [ -f "scripts/local_tokens_pools.sh" ]; then
    log_info "Running local_tokens_pools.sh (custom script)..."
    bash scripts/local_tokens_pools.sh ${NETWORK} && {
      log_success "Custom tokens and pools script ran successfully"
      return 0
    } || {
      log_warning "Custom tokens_pools script failed, trying alternatives..."
    }
  fi
  
  # Next try the standard deploy_tokens_pools.sh
  if [ -f "scripts/deploy_tokens_pools.sh" ]; then
    log_info "Running deploy_tokens_pools.sh..."
    
    # Try the deploy_tokens_pools.sh script, but if it fails, use our fallback
    bash scripts/deploy_tokens_pools.sh ${NETWORK} || {
      log_warning "deploy_tokens_pools.sh failed or had errors, using fallback method..."
      create_tokens_and_pools_fallback
    }
  else
    log_warning "deploy_tokens_pools.sh not found, using fallback method..."
    create_tokens_and_pools_fallback
  fi
  
  log_success "Tokens and pools created"
}

# Fallback method to create tokens and pools directly
create_tokens_and_pools_fallback() {
  log_info "Creating tokens and pools using fallback method..."
  
  # Ensure we're using the kong identity for adding tokens
  dfx identity use kong
  
  # Get Kong Backend canister ID
  KONG_CANISTER=$(dfx canister id --network ${NETWORK} kong_backend)
  log_info "Kong Backend canister ID: ${KONG_CANISTER}"
  
  # Add ksUSDT token if it exists
  if dfx canister id --network ${NETWORK} ksusdt_ledger &> /dev/null; then
    KSUSDT_LEDGER=$(dfx canister id --network ${NETWORK} ksusdt_ledger)
    log_info "Adding ksUSDT token to Kong DEX..."
    dfx canister call --network ${NETWORK} ${KONG_CANISTER} add_token "(record {
      token = \"IC.${KSUSDT_LEDGER}\";
      on_kong = opt true;
    })" || log_warning "Failed to add ksUSDT token"
  fi
  
  # Add ksICP token if it exists
  if dfx canister id --network ${NETWORK} ksicp_ledger &> /dev/null; then
    KSICP_LEDGER=$(dfx canister id --network ${NETWORK} ksicp_ledger)
    log_info "Adding ksICP token to Kong DEX..."
    dfx canister call --network ${NETWORK} ${KONG_CANISTER} add_token "(record {
      token = \"IC.${KSICP_LEDGER}\";
      on_kong = opt true;
    })" || log_warning "Failed to add ksICP token"
  fi
  
  # Add ksBTC token if it exists
  if dfx canister id --network ${NETWORK} ksbtc_ledger &> /dev/null; then
    KSBTC_LEDGER=$(dfx canister id --network ${NETWORK} ksbtc_ledger)
    log_info "Adding ksBTC token to Kong DEX..."
    dfx canister call --network ${NETWORK} ${KONG_CANISTER} add_token "(record {
      token = \"IC.${KSBTC_LEDGER}\";
      on_kong = opt true;
    })" || log_warning "Failed to add ksBTC token"
  fi
  
  # Switch to kong_user1 for creating pools
  dfx identity use kong_user1
  
  # Create ksICP/ksUSDT pool if both tokens exist
  if dfx canister id --network ${NETWORK} ksicp_ledger &> /dev/null && \
     dfx canister id --network ${NETWORK} ksusdt_ledger &> /dev/null; then
    KSICP_LEDGER=$(dfx canister id --network ${NETWORK} ksicp_ledger)
    KSUSDT_LEDGER=$(dfx canister id --network ${NETWORK} ksusdt_ledger)
    
    # Set explicit amounts for the pool
    KSICP_AMOUNT=500000000000   # 5,000 ksICP with 8 decimals
    KSUSDT_AMOUNT=37500000000   # 37,500 ksUSDT with 6 decimals (price ~7.5 USDT per ICP)
    KSICP_FEE=10000             # Standard fee amount for ksICP
    KSUSDT_FEE=10000            # Standard fee amount for ksUSDT
    
    log_info "Creating ksICP/ksUSDT pool (5,000 ksICP with 8 decimals, 37,500 ksUSDT with 6 decimals)..."
    
    # Calculate expires timestamp (60 seconds from now)
    EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)
    
    # Approve with explicit amounts (including fees)
    log_info "Approving ksICP transfer..."
    dfx canister call --network ${NETWORK} ${KSICP_LEDGER} icrc2_approve "(record {
      amount = $(echo "${KSICP_AMOUNT} + ${KSICP_FEE}" | bc);
      expires_at = opt ${EXPIRES_AT};
      spender = record { owner = principal \"${KONG_CANISTER}\" };
    })" || log_warning "Failed to approve ksICP"
    
    log_info "Approving ksUSDT transfer..."
    dfx canister call --network ${NETWORK} ${KSUSDT_LEDGER} icrc2_approve "(record {
      amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
      expires_at = opt ${EXPIRES_AT};
      spender = record { owner = principal \"${KONG_CANISTER}\" };
    })" || log_warning "Failed to approve ksUSDT"
    
    # Create pool
    log_info "Creating pool..."
    dfx canister call --network ${NETWORK} ${KONG_CANISTER} add_pool "(record {
      token_0 = \"IC.${KSICP_LEDGER}\";
      amount_0 = ${KSICP_AMOUNT};
      token_1 = \"IC.${KSUSDT_LEDGER}\";
      amount_1 = ${KSUSDT_AMOUNT};
      on_kong = opt true;
    })" || log_warning "Failed to create ksICP/ksUSDT pool"
  fi
  
  # Create ksBTC/ksUSDT pool if both tokens exist
  if dfx canister id --network ${NETWORK} ksbtc_ledger &> /dev/null && \
     dfx canister id --network ${NETWORK} ksusdt_ledger &> /dev/null; then
    KSBTC_LEDGER=$(dfx canister id --network ${NETWORK} ksbtc_ledger)
    KSUSDT_LEDGER=$(dfx canister id --network ${NETWORK} ksusdt_ledger)
    
    # Set explicit amounts for the pool
    KSBTC_AMOUNT=100000000      # 1 ksBTC with 8 decimals
    KSUSDT_AMOUNT=58000000000   # 58,000 ksUSDT with 6 decimals
    KSBTC_FEE=10000             # Standard fee amount for ksBTC
    KSUSDT_FEE=10000            # Standard fee amount for ksUSDT
    
    log_info "Creating ksBTC/ksUSDT pool (1 ksBTC with 8 decimals, 58,000 ksUSDT with 6 decimals)..."
    
    # Calculate expires timestamp (60 seconds from now)
    EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)
    
    # Approve with explicit amounts (including fees)
    log_info "Approving ksBTC transfer..."
    dfx canister call --network ${NETWORK} ${KSBTC_LEDGER} icrc2_approve "(record {
      amount = $(echo "${KSBTC_AMOUNT} + ${KSBTC_FEE}" | bc);
      expires_at = opt ${EXPIRES_AT};
      spender = record { owner = principal \"${KONG_CANISTER}\" };
    })" || log_warning "Failed to approve ksBTC"
    
    log_info "Approving ksUSDT transfer..."
    dfx canister call --network ${NETWORK} ${KSUSDT_LEDGER} icrc2_approve "(record {
      amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
      expires_at = opt ${EXPIRES_AT};
      spender = record { owner = principal \"${KONG_CANISTER}\" };
    })" || log_warning "Failed to approve ksUSDT"
    
    # Create pool
    log_info "Creating pool..."
    dfx canister call --network ${NETWORK} ${KONG_CANISTER} add_pool "(record {
      token_0 = \"IC.${KSBTC_LEDGER}\";
      amount_0 = ${KSBTC_AMOUNT};
      token_1 = \"IC.${KSUSDT_LEDGER}\";
      amount_1 = ${KSUSDT_AMOUNT};
      on_kong = opt true;
    })" || log_warning "Failed to create ksBTC/ksUSDT pool"
  fi
  
  # Switch back to kong identity
  dfx identity use kong
  
  log_success "Fallback pool creation completed"
}

# Function to set up environment files
setup_env_files() {
  log_info "Setting up environment files..."
  
  # Check if .env exists in project root, if not copy from .env_local
  if [ ! -f ".env" ] && [ -f ".env_local" ]; then
    log_info "Copying .env_local to .env for dfx deployment..."
    cp .env_local .env
    log_success "Created .env file from .env_local"
  elif [ -f ".env" ]; then
    log_info ".env file already exists, keeping existing file"
  else
    log_warning "No .env_local file found, environment variables may not be properly set"
  fi
  
  # Check if .env.vars exists, create it if not
  if [ ! -f ".env.vars" ]; then
    log_info "Creating .env.vars file for Internet Computer environment..."
    echo 'CANISTER_MODE="local"' > .env.vars
    echo 'IC_ENV="local"' >> .env.vars
    log_success "Created .env.vars file"
  else
    log_info ".env.vars file already exists, keeping existing file"
  fi
  
  # Create a proper canister_ids.all.json file if it doesn't exist or is empty
  if [ ! -s "canister_ids.all.json" ]; then
    log_info "Creating canister_ids.all.json file..."
    echo '{}' > canister_ids.all.json
  fi
}

# Function to start PostgreSQL
start_postgres() {
  log_info "Setting up PostgreSQL..."
  
  if ! docker ps | grep -q ${POSTGRES_CONTAINER}; then
    # Check if container exists but is stopped
    if docker ps -a | grep -q ${POSTGRES_CONTAINER}; then
      log_info "Starting existing PostgreSQL container..."
      docker start ${POSTGRES_CONTAINER}
    else
      log_info "Creating and starting PostgreSQL container..."
      docker run --name ${POSTGRES_CONTAINER} -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=localapi -p 5432:5432 -d postgres:14
    fi
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    sleep 5
  else
    log_info "PostgreSQL container is already running"
  fi
}

# Function to start Redis
start_redis() {
  log_info "Setting up Redis..."
  
  if ! docker ps | grep -q ${REDIS_CONTAINER}; then
    # Check if container exists but is stopped
    if docker ps -a | grep -q ${REDIS_CONTAINER}; then
      log_info "Starting existing Redis container..."
      docker start ${REDIS_CONTAINER}
    else
      log_info "Creating and starting Redis container..."
      docker run --name ${REDIS_CONTAINER} -p 6379:6379 -d redis:6
    fi
  else
    log_info "Redis container is already running"
  fi
}

# Function to initialize API database
initialize_api_database() {
  log_info "Initializing API database..."
  
  # Check if tables already exist
  TABLE_COUNT=$(docker exec -i ${POSTGRES_CONTAINER} psql -U postgres -d localapi -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" | tr -d ' ')
  
  if [ "$TABLE_COUNT" -eq "0" ]; then
    log_info "Database is empty, initializing with schema..."
    # Check if init_sql.sql exists
    if [ -f "${API_DIR}/migration/init_sql.sql" ]; then
      # Execute the SQL file to initialize the database
      docker exec -i ${POSTGRES_CONTAINER} psql -U postgres -d localapi < ${API_DIR}/migration/init_sql.sql
      log_success "Database initialized with schema"
    else
      log_warning "migration/init_sql.sql not found, skipping database initialization"
    fi
  else
    log_info "Database already has tables, skipping initialization"
  fi
}

# Function to run API migrations
run_api_migrations() {
  log_info "Running API migrations..."
  
  # Check if we're in the API directory
  cd ${API_DIR}
  
  # Check if .env file exists, create it from example if not
  if [ ! -f .env ]; then
    log_info "Creating .env file from .env.example..."
    if [ -f .env.example ]; then
      cp .env.example .env
      
      # Get the Kong backend canister ID
      KONG_CANISTER=$(dfx canister id --network ${NETWORK} ${KONG_BACKEND})
      
      # Get the Kong data canister ID
      KONG_DATA_CANISTER=$(dfx canister id --network ${NETWORK} kong_data)
      
      # Set appropriate local development values
      sed -i.bak 's|APP__DATABASE__URL=.*|APP__DATABASE__URL=postgresql://postgres:postgres@localhost:5432/localapi|g' .env
      sed -i.bak 's|APP__REDIS__URL=.*|APP__REDIS__URL=redis://localhost:6379|g' .env
      sed -i.bak 's|APP__REDIS__USE_TLS=.*|APP__REDIS__USE_TLS=false|g' .env
      sed -i.bak 's|APP__SERVER__HOST=.*|APP__SERVER__HOST=0.0.0.0|g' .env
      sed -i.bak 's|APP__SERVER__PORT=.*|APP__SERVER__PORT=8080|g' .env
      sed -i.bak "s|APP__IC__KONG_CANISTER_ID=.*|APP__IC__KONG_CANISTER_ID=${KONG_CANISTER}|g" .env
      sed -i.bak "s|APP__IC__KONG_DATA_CANISTER_ID=.*|APP__IC__KONG_DATA_CANISTER_ID=${KONG_DATA_CANISTER}|g" .env
      sed -i.bak 's|APP__IC__HOST=.*|APP__IC__HOST=http://localhost:4943|g' .env
      rm -f .env.bak
      
      log_success "Created and configured API .env file"
    else
      log_warning ".env.example not found, skipping .env creation"
    fi
  else
    log_info "API .env file already exists, keeping existing file"
    
    # Ensure the Kong canister ID is up to date
    KONG_CANISTER=$(dfx canister id --network ${NETWORK} ${KONG_BACKEND})
    KONG_DATA_CANISTER=$(dfx canister id --network ${NETWORK} kong_data)
    
    sed -i.bak "s|APP__IC__KONG_CANISTER_ID=.*|APP__IC__KONG_CANISTER_ID=${KONG_CANISTER}|g" .env
    sed -i.bak "s|APP__IC__KONG_DATA_CANISTER_ID=.*|APP__IC__KONG_DATA_CANISTER_ID=${KONG_DATA_CANISTER}|g" .env
    sed -i.bak 's|APP__IC__HOST=.*|APP__IC__HOST=http://localhost:4943|g' .env
    rm -f .env.bak
    
    log_info "Updated Kong canister IDs in API .env file"
  fi
  
  # Run migrations
  log_info "Applying database migrations..."
  (cd migration && cargo run)
  
  # Return to project root
  cd ..
  
  log_success "API migrations applied"
}

# Function to start API server
start_api_server() {
  log_info "Starting API server..."
  
  # Check if API is already running on the specified port
  if lsof -i :${API_PORT} | grep LISTEN &> /dev/null; then
    log_warning "API server is already running on port ${API_PORT}"
    log_warning "If you want to restart it, kill the existing process first"
    return 0
  fi
  
  # Build and run the API in the background
  cd ${API_DIR}
  cargo run &
  API_PID=$!
  
  # Check if the process started successfully
  if ! ps -p ${API_PID} > /dev/null; then
    log_error "API server failed to start"
    exit 1
  fi
  
  log_info "API server started with PID: ${API_PID}"
  
  # Wait for API to be ready
  local retry_count=0
  local max_retries=30
  
  while ! curl -s -f -o /dev/null "http://localhost:${API_PORT}/health" && [ ${retry_count} -lt ${max_retries} ]; do
    log_info "Waiting for API server to start (${retry_count}/${max_retries})..."
    sleep 2
    retry_count=$((retry_count+1))
  done
  
  if [ ${retry_count} -eq ${max_retries} ]; then
    log_error "API server failed to respond after ${max_retries} attempts"
    exit 1
  fi
  
  # Return to project root
  cd ..
  
  log_success "API server running at http://localhost:${API_PORT}"
}

# Function to sync tokens from kong_backend to API
sync_tokens_to_api() {
  log_info "Adding tokens to API database..."
  
  # Check if psql command is available
  if ! command -v psql &> /dev/null; then
    log_error "psql command not found. Please install PostgreSQL client."
    return 1
  fi
  
  # Get canister IDs
  KSUSDT_LEDGER=$(dfx canister id --network ${NETWORK} ksusdt_ledger 2>/dev/null || echo "zdzgz-siaaa-aaaar-qaiba-cai")
  KSICP_LEDGER=$(dfx canister id --network ${NETWORK} ksicp_ledger 2>/dev/null || echo "nppha-riaaa-aaaal-ajf2q-cai")
  KSBTC_LEDGER=$(dfx canister id --network ${NETWORK} ksbtc_ledger 2>/dev/null || echo "zeyan-7qaaa-aaaar-qaibq-cai")
  
  log_info "Using canister IDs: ksUSDT=${KSUSDT_LEDGER}, ksICP=${KSICP_LEDGER}, ksBTC=${KSBTC_LEDGER}"
  
  # Add ksUSDT token (ID 1)
  log_info "Adding ksUSDT token..."
  psql -h localhost -U postgres -d localapi -c "
    INSERT INTO tokens (
      token_id, name, symbol, canister_id, decimals, fee, 
      icrc1, icrc2, token_type, raw_json, is_removed
    ) VALUES (
      1, 'USD Tether (KongSwap Test Token)', 'ksUSDT', '${KSUSDT_LEDGER}', 6, 10000,
      TRUE, TRUE, 'IC', '{}'::jsonb, FALSE
    )
    ON CONFLICT (token_id) 
    DO UPDATE SET
      name = 'USD Tether (KongSwap Test Token)',
      symbol = 'ksUSDT',
      canister_id = '${KSUSDT_LEDGER}',
      decimals = 6,
      fee = 10000,
      icrc1 = TRUE,
      icrc2 = TRUE,
      token_type = 'IC',
      is_removed = FALSE;
  " || log_warning "Could not add ksUSDT token"
  
  # Add ksICP token (ID 2)
  log_info "Adding ksICP token..."
  psql -h localhost -U postgres -d localapi -c "
    INSERT INTO tokens (
      token_id, name, symbol, canister_id, decimals, fee, 
      icrc1, icrc2, token_type, raw_json, is_removed
    ) VALUES (
      2, 'Internet Computer (KongSwap Test Token)', 'ksICP', '${KSICP_LEDGER}', 8, 10000,
      TRUE, TRUE, 'IC', '{}'::jsonb, FALSE
    )
    ON CONFLICT (token_id) 
    DO UPDATE SET
      name = 'Internet Computer (KongSwap Test Token)',
      symbol = 'ksICP',
      canister_id = '${KSICP_LEDGER}',
      decimals = 8,
      fee = 10000,
      icrc1 = TRUE,
      icrc2 = TRUE,
      token_type = 'IC',
      is_removed = FALSE;
  " || log_warning "Could not add ksICP token"
  
  # Add ksBTC token (ID 3)
  log_info "Adding ksBTC token..."
  psql -h localhost -U postgres -d localapi -c "
    INSERT INTO tokens (
      token_id, name, symbol, canister_id, decimals, fee, 
      icrc1, icrc2, token_type, raw_json, is_removed
    ) VALUES (
      3, 'Bitcoin (KongSwap Test Token)', 'ksBTC', '${KSBTC_LEDGER}', 8, 10000,
      TRUE, TRUE, 'IC', '{}'::jsonb, FALSE
    )
    ON CONFLICT (token_id) 
    DO UPDATE SET
      name = 'Bitcoin (KongSwap Test Token)',
      symbol = 'ksBTC',
      canister_id = '${KSBTC_LEDGER}',
      decimals = 8,
      fee = 10000,
      icrc1 = TRUE,
      icrc2 = TRUE,
      token_type = 'IC',
      is_removed = FALSE;
  " || log_warning "Could not add ksBTC token"
  
  # Add token metrics
  log_info "Updating token metrics..."
  psql -h localhost -U postgres -d localapi -c "
    INSERT INTO token_metrics (token_id, total_supply)
    SELECT t.token_id, 0
    FROM tokens t
    LEFT JOIN token_metrics tm ON t.token_id = tm.token_id
    WHERE tm.token_id IS NULL;
  " || log_warning "Could not update token metrics"
  
  log_success "Tokens added to API database successfully"
}

# deploy prediction markets
deploy_prediction_markets() {
  scripts/prediction_markets/canister_reinstall.sh
}

# Function to display summary
display_summary() {
  log_success "Kong DEX local environment is up and running!"
  echo ""
  echo -e "${GREEN}Internet Computer:${NC} http://127.0.0.1:${DFX_PORT}"
  
  if dfx canister id --network ${NETWORK} ${KONG_BACKEND} &> /dev/null; then
    echo -e "${GREEN}Kong Backend Canister:${NC} $(dfx canister id --network ${NETWORK} ${KONG_BACKEND})"
  fi
  
  if dfx canister id --network ${NETWORK} kong_data &> /dev/null; then
    echo -e "${GREEN}Kong Data Canister:${NC} $(dfx canister id --network ${NETWORK} kong_data)"
  fi
  
  if dfx canister id --network ${NETWORK} kong_frontend &> /dev/null; then
    echo -e "${GREEN}Frontend URL:${NC} http://$(dfx canister id --network ${NETWORK} kong_frontend).localhost:${DFX_PORT}/"
  fi
  
  if dfx canister id --network ${NETWORK} kong_faucet &> /dev/null; then
    echo -e "${GREEN}Kong Faucet Canister:${NC} $(dfx canister id --network ${NETWORK} kong_faucet)"
  fi
  
  if dfx canister id --network ${NETWORK} internet_identity &> /dev/null; then
    echo -e "${GREEN}Internet Identity Canister:${NC} $(dfx canister id --network ${NETWORK} internet_identity)"
    echo -e "${GREEN}Internet Identity URL:${NC} http://$(dfx canister id --network ${NETWORK} internet_identity).localhost:${DFX_PORT}/"
  fi
  
  echo -e "${GREEN}API Server:${NC} http://localhost:${API_PORT}"
  echo -e "${GREEN}API Documentation:${NC} http://localhost:${API_PORT}/swagger-ui"
  echo ""
  echo -e "${YELLOW}Available token ledgers:${NC}"
  if dfx canister id --network ${NETWORK} ksicp_ledger &> /dev/null; then
    echo -e "  - ksICP: $(dfx canister id --network ${NETWORK} ksicp_ledger)"
  fi
  if dfx canister id --network ${NETWORK} ksusdt_ledger &> /dev/null; then
    echo -e "  - ksUSDT: $(dfx canister id --network ${NETWORK} ksusdt_ledger)"
  fi
  if dfx canister id --network ${NETWORK} ksbtc_ledger &> /dev/null; then
    echo -e "  - ksBTC: $(dfx canister id --network ${NETWORK} ksbtc_ledger)"
  fi
  echo ""
  echo -e "${YELLOW}To view your transaction history:${NC}"
  echo -e "  PRINCIPAL=\$(dfx identity get-principal)"
  echo -e "  dfx canister call kong_data txs \"(opt \\\"\${PRINCIPAL}\\\", null, null, null)\""
  echo ""
  echo -e "${YELLOW}To view a specific transaction:${NC}"
  echo -e "  dfx canister call kong_data txs \"(null, opt <TX_ID>, null, null)\""
  echo ""
  echo -e "${YELLOW}To test the API:${NC}"
  echo -e "  cd ${API_DIR}/scripts && ./test_geckoterminal.sh"
  echo ""
  echo -e "${YELLOW}To manually sync tokens from kong_backend to API:${NC}"
  echo -e "  cd ${API_DIR}/scripts && ./sync_tokens.sh"
  echo ""
  echo -e "${YELLOW}To claim test tokens:${NC}"
  echo -e "  dfx canister call kong_faucet claim"
  echo ""
  echo -e "${YELLOW}To shut down:${NC}"
  echo -e "  1. Kill the API server: kill \$(lsof -t -i:${API_PORT})"
  echo -e "  2. Stop dfx: dfx stop"
  echo -e "  3. Stop Docker containers: docker stop ${POSTGRES_CONTAINER} ${REDIS_CONTAINER}"
  echo ""
}

# Main script
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}|            KONG DEX LOCAL SETUP               |${NC}"
echo -e "${BLUE}==================================================${NC}"

# Run all steps with more direct control
setup_env_files
start_dfx
create_identities
prepare_canisters
deploy_kong_backend
deploy_kong_data
enable_archiving_to_kong_data
deploy_token_ledgers
deploy_kong_faucet
mint_tokens_to_faucet
deploy_internet_identity
mint_initial_tokens
create_tokens_and_pools
start_postgres
start_redis
initialize_api_database
run_api_migrations
start_api_server
sync_tokens_to_api
display_summary

log_info "Press CTRL+C to exit"
wait # Wait for background processes 