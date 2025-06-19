#!/usr/bin/env bash

# Enhanced deployment script with robust error handling and retry logic
set -euo pipefail  # Exit on errors, undefined vars, pipe failures

# Setup directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
DFX_ROOT="${PROJECT_ROOT}/.dfx"
echo "=============== DEPLOY SCRIPT INFO ==============="
echo "Project root: $PROJECT_ROOT"
echo "Dfx root: $DFX_ROOT"
echo "Script directory: $SCRIPT_DIR"
echo "==============================================="

# Deployment state tracking
DEPLOYMENT_STATE_FILE="${PROJECT_ROOT}/.deployment_state.json"
FAILED_DEPLOYMENTS_LOG="${PROJECT_ROOT}/.failed_deployments.log"

# Utility functions
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo "[WARNING] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Initialize deployment state
init_deployment_state() {
    if [ ! -f "$DEPLOYMENT_STATE_FILE" ]; then
        echo '{}' > "$DEPLOYMENT_STATE_FILE"
    fi
}

# Mark component as successfully deployed
mark_deployed() {
    local component="$1"
    local network="$2"
    jq --arg comp "$component" --arg net "$network" \
        '.[$net][$comp] = {"status": "deployed", "timestamp": now}' \
        "$DEPLOYMENT_STATE_FILE" > "${DEPLOYMENT_STATE_FILE}.tmp" && \
        mv "${DEPLOYMENT_STATE_FILE}.tmp" "$DEPLOYMENT_STATE_FILE"
    log_info "Marked $component as deployed for $network"
}

# Check if component is already deployed
is_deployed() {
    local component="$1"
    local network="$2"
    local status=$(jq -r --arg comp "$component" --arg net "$network" \
        '.[$net][$comp].status // "not_deployed"' "$DEPLOYMENT_STATE_FILE")
    [ "$status" = "deployed" ]
}

# Log failed deployment
log_failed_deployment() {
    local component="$1"
    local network="$2"
    local error="$3"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - FAILED: $component on $network - $error" >> "$FAILED_DEPLOYMENTS_LOG"
    log_error "Failed to deploy $component: $error"
}

# Retry mechanism for deployments
retry_deployment() {
    local max_attempts=3
    local delay=5
    local attempt=1
    local script_path="$1"
    local network="$2"
    local component_name="$(basename "$script_path" .sh)"
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Attempt $attempt/$max_attempts for $component_name"
        
        if bash "$script_path" "$network" 2>&1; then
            log_info "Successfully deployed $component_name on attempt $attempt"
            mark_deployed "$component_name" "$network"
            return 0
        else
            local exit_code=$?
            log_warning "Attempt $attempt failed for $component_name (exit code: $exit_code)"
            
            if [ $attempt -lt $max_attempts ]; then
                log_info "Waiting ${delay}s before retry..."
                sleep $delay
                delay=$((delay * 2))  # Exponential backoff
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_failed_deployment "$component_name" "$network" "Max retry attempts exceeded"
    return 1
}

# Verify canister exists
verify_canister_exists() {
    local canister_name="$1"
    local network="$2"
    
    if dfx canister id --network "$network" "$canister_name" >/dev/null 2>&1; then
        log_info "Canister $canister_name exists on $network"
        return 0
    else
        log_error "Canister $canister_name does not exist on $network"
        return 1
    fi
}

# Verify all required canisters exist
verify_required_canisters() {
    local network="$1"
    local required_canisters=("kong_backend")
    local missing_canisters=()
    
    # Add ledger canisters for local/staging
    if [[ "$network" =~ ^(local|staging)$ ]]; then
        required_canisters+=("ksusdt_ledger" "icp_ledger" "ksbtc_ledger" "kseth_ledger" "kskong_ledger")
    fi
    
    for canister in "${required_canisters[@]}"; do
        if ! verify_canister_exists "$canister" "$network"; then
            missing_canisters+=("$canister")
        fi
    done
    
    if [ ${#missing_canisters[@]} -gt 0 ]; then
        log_error "Missing required canisters: ${missing_canisters[*]}"
        return 1
    fi
    
    log_info "All required canisters verified"
    return 0
}

# Set network and prepare environment
NETWORK=${1:-local}
echo "Building and deploying KONG canisters to ${NETWORK}"

# Initialize deployment tracking
init_deployment_state
log_info "Starting deployment to $NETWORK network"

# Copy canister IDs file
cp "${PROJECT_ROOT}"/canister_ids.all.json "${PROJECT_ROOT}"/canister_ids.json

# Check required commands
for cmd in rustc cargo npm dfx jq sha256sum; do
    if ! command -v $cmd >/dev/null; then
        echo "$cmd is not installed"
        exit 1
    fi
done

# Generate secrets
bash "${SCRIPT_DIR}/generate_secrets.sh"

# Source the generated secrets file if it exists
if [ -f "${PROJECT_ROOT}/.secrets" ]; then
  echo "Sourcing secrets from ${PROJECT_ROOT}/.secrets"
  set -a # Automatically export all variables defined after this
  source "${PROJECT_ROOT}/.secrets"
  set +a # Stop automatically exporting variables
else
  echo "Warning: ${PROJECT_ROOT}/.secrets file not found after generation."
fi

# check wasm32-unknown-unknown target installed
if ! rustup target list | grep -q "wasm32-unknown-unknown"; then
    echo "wasm32-unknown-unknown target not installed"
    echo "Run \"rustup target add wasm32-unknown-unknown\""
    exit 1
fi

# Setup local network if needed
if [ "${NETWORK}" == "local" ]; then
    dfx stop
    # Full clean of local network state
    rm -rf "${DFX_ROOT}/local" 2>/dev/null
    echo "Waiting for dfx to start..."
    dfx start --clean --background
    # Clean previous canister IDs
    rm -f "${DFX_ROOT}/local/canister_ids.json" 2>/dev/null
    #dfx identity --network local deploy-wallet
fi

# Check required identities for local and staging networks
if [[ "${NETWORK}" =~ ^(local|staging)$ ]]; then
    for identity in kong kong_token_minter kong_user1 kong_user2; do
        # Use temporary file to avoid pipe issues
        if ! dfx identity list --network "${NETWORK}" > /tmp/dfx_identities.tmp 2>&1 || ! grep -q "$identity" /tmp/dfx_identities.tmp; then
            echo "User $identity does not exist. Run \"create_identity.sh\""
            exit 1
        fi
    done
    rm -f /tmp/dfx_identities.tmp
fi

# Copy correct environment file using absolute path
if [ -f "${SCRIPT_DIR}/copy_env.sh" ]; then
    echo "Running copy_env.sh from $SCRIPT_DIR"
    bash "${SCRIPT_DIR}/copy_env.sh" "${NETWORK}"
    
    # Verify .env file after copy_env.sh
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        echo ".env file exists after copy_env.sh"
        ls -la "${PROJECT_ROOT}/.env"
        echo "Content of .env:"
        cat "${PROJECT_ROOT}/.env"
    else
        echo "Error: .env file not found after copy_env.sh!"
        exit 1
    fi
else 
    echo "Warning: copy_env.sh not found in $SCRIPT_DIR"
    ls -la "$SCRIPT_DIR"
    exit 1
fi

# Deploy internet identity canister
[ "${NETWORK}" == "local" ] && dfx deploy internet_identity --network "${NETWORK}"

# Deploy core canisters - limited to kong_backend only
CORE_CANISTERS_SCRIPTS=(
    "deploy_kong_backend.sh"
)

for script in "${CORE_CANISTERS_SCRIPTS[@]}"; do
    [ -f "${SCRIPT_DIR}/${script}" ] && {
        echo "Running ${script}"
        bash "${SCRIPT_DIR}/${script}" "${NETWORK}"
    } || echo "Warning: ${script} not found"
done

# Deploy test token ledgers, faucet, mint and create tokens and pools for local/staging
if [[ "${NETWORK}" =~ ^(local|staging)$ ]]; then

    # Deploy test token ledger canisters with robust error handling
    LEDGER_SCRIPTS=(
        "${SCRIPT_DIR}/deploy_ksusdt_ledger.sh"
        "${SCRIPT_DIR}/deploy_icp_ledger.sh"
        "${SCRIPT_DIR}/deploy_ksbtc_ledger.sh"
        "${SCRIPT_DIR}/deploy_kseth_ledger.sh"
        "${SCRIPT_DIR}/deploy_kskong_ledger.sh"
    )

    deployed_ledgers=()
    failed_ledgers=()
    
    log_info "Deploying ledger canisters..."
    
    for script in "${LEDGER_SCRIPTS[@]}"; do
        script_name="$(basename "$script" .sh)"
        
        if [ ! -f "${script}" ]; then
            log_warning "Script not found: ${script}"
            continue
        fi
        
        # Skip if already deployed
        if is_deployed "$script_name" "$NETWORK"; then
            log_info "Skipping $script_name - already deployed"
            deployed_ledgers+=("$script_name")
            continue
        fi
        
        log_info "Deploying ledger: $script_name"
        
        if retry_deployment "${script}" "${NETWORK}"; then
            deployed_ledgers+=("$script_name")
            log_info "Successfully deployed: $script_name"
        else
            failed_ledgers+=("$script_name")
            log_error "Failed to deploy: $script_name (continuing with others)"
        fi
    done
    
    # Report deployment status
    log_info "Ledger deployment summary:"
    log_info "  Successfully deployed: ${#deployed_ledgers[@]} ledgers"
    if [ ${#deployed_ledgers[@]} -gt 0 ]; then
        log_info "    ${deployed_ledgers[*]}"
    fi
    
    if [ ${#failed_ledgers[@]} -gt 0 ]; then
        log_warning "  Failed deployments: ${#failed_ledgers[@]} ledgers"
        log_warning "    ${failed_ledgers[*]}"
        log_warning "  Check ${FAILED_DEPLOYMENTS_LOG} for details"
    fi

    # Deploy auxiliary components with error handling
    AUXILIARY_SCRIPTS=(
        "deploy_kong_faucet.sh:faucet"
        "faucet_mint.sh:faucet_mint"
        "user_mint.sh:user_mint"
    )
    
    for script_info in "${AUXILIARY_SCRIPTS[@]}"; do
        IFS=':' read -r script_name component_name <<< "$script_info"
        script_path="${SCRIPT_DIR}/${script_name}"
        
        if [ ! -f "$script_path" ]; then
            log_warning "Script not found: $script_path"
            continue
        fi
        
        if is_deployed "$component_name" "$NETWORK"; then
            log_info "Skipping $component_name - already deployed"
            continue
        fi
        
        log_info "Running $script_name"
        
        if retry_deployment "$script_path" "$NETWORK"; then
            log_info "Successfully completed: $script_name"
        else
            log_warning "Failed to complete: $script_name (continuing)"
        fi
    done
    
    # Verify all required canisters exist before deploying tokens and pools
    log_info "Verifying all required canisters exist..."
    
    if verify_required_canisters "$NETWORK"; then
        # Deploy tokens and pools with enhanced error handling
        if [ -f "${SCRIPT_DIR}/deploy_tokens_pools.sh" ]; then
            if is_deployed "deploy_tokens_pools" "$NETWORK"; then
                log_info "Skipping token and pool deployment - already completed"
            else
                log_info "All required canisters verified. Deploying tokens and creating liquidity pools..."
                
                if retry_deployment "${SCRIPT_DIR}/deploy_tokens_pools.sh" "$NETWORK"; then
                    log_info "Successfully deployed tokens and pools"
                else
                    log_error "Failed to deploy tokens and pools"
                    exit 1
                fi
            fi
        else
            log_warning "deploy_tokens_pools.sh not found"
        fi
    else
        log_error "Cannot proceed with token/pool deployment - missing required canisters"
        log_error "Please check deployment logs and retry failed components"
        exit 1
    fi
fi

# Final verification and cleanup
if [[ "${NETWORK}" == "ic" ]]; then
    # calculate sha256 for SNS proposal
    log_info "Calculating SHA256 for kong_backend.wasm.gz:"
    sha256sum "${DFX_ROOT}"/ic/canisters/kong_backend/kong_backend.wasm.gz
fi

# Final deployment summary
log_info "=============== DEPLOYMENT SUMMARY ==============="
log_info "Network: $NETWORK"
log_info "Deployment completed at: $(date)"

if [ -f "$FAILED_DEPLOYMENTS_LOG" ] && [ -s "$FAILED_DEPLOYMENTS_LOG" ]; then
    log_warning "Some components failed to deploy. Check $FAILED_DEPLOYMENTS_LOG for details."
    log_warning "You can re-run this script to retry failed deployments."
else
    log_info "All components deployed successfully!"
fi

log_info "================================================="
