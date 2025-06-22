#!/usr/bin/env bash

# note: quick hot changes with existing LP pools
# cargo clean:   Bash(dfx deploy kong_backend --upgrade-unchanged)
# Setup directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
DFX_ROOT="${PROJECT_ROOT}/.dfx"
echo "=============== DEPLOY SCRIPT INFO ==============="
echo "Project root: $PROJECT_ROOT"
echo "Dfx root: $DFX_ROOT"
echo "Script directory: $SCRIPT_DIR"
echo "==============================================="

# Set network and prepare environment
NETWORK=${1:-local}
echo "Building and deploying KONG canisters to ${NETWORK}"

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
    dfx killall
    # Full clean of local network state
    rm -rf "${DFX_ROOT}/local" 2>/dev/null
    echo "Waiting for dfx to start..."
    dfx start --clean --background
    # Clean previous canister IDs
    rm -f "${DFX_ROOT}/local/canister_ids.json" 2>/dev/null
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

    # Deploy test token ledger canisters
    LEDGER_SCRIPTS=(
        "${SCRIPT_DIR}/deploy_ksusdt_ledger.sh"
        "${SCRIPT_DIR}/deploy_icp_ledger.sh"
        "${SCRIPT_DIR}/deploy_ksbtc_ledger.sh"
        "${SCRIPT_DIR}/deploy_kseth_ledger.sh"
        "${SCRIPT_DIR}/deploy_kskong_ledger.sh"
    )

    for script in "${LEDGER_SCRIPTS[@]}"; do
        [ -f "${script}" ] && {
            echo "Running ${script}"
            if ! bash "${script}" "${NETWORK}"; then
                echo "Warning: ${script} failed, continuing with deployment"
            fi
        } || echo "Warning: ${script} not found"
    done

    # deploy test token faucet canister
    [ -f "${SCRIPT_DIR}/deploy_kong_faucet.sh" ] && {
        bash "${SCRIPT_DIR}/deploy_kong_faucet.sh" "${NETWORK}"
    } || echo "Warning: deploy_kong_faucet.sh not found"

	# mint test tokens to kong_faucet
    [ -f "${SCRIPT_DIR}/faucet_mint.sh" ] && {
        bash "${SCRIPT_DIR}/faucet_mint.sh" "${NETWORK}"
    } || echo "Warning: faucet_mint.sh not found"

	# mint test tokens to kong_user1
    [ -f "${SCRIPT_DIR}/user_mint.sh" ] && {
        bash "${SCRIPT_DIR}/user_mint.sh" "${NETWORK}"
    } || echo "Warning: user_mint.sh not found"

    # deploy tokens and pools
    [ -f "${SCRIPT_DIR}/deploy_tokens_pools.sh" ] && {
        echo "Deploying tokens and creating liquidity pools..."
        bash "${SCRIPT_DIR}/deploy_tokens_pools.sh" "${NETWORK}"
    } || echo "Warning: deploy_tokens_pools.sh not found"

    # Add Solana tokens
    [ -f "${SCRIPT_DIR}/add_solana_token.sh" ] && {
        echo "Adding SOL token..."
        bash "${SCRIPT_DIR}/add_solana_token.sh" "${NETWORK}"
    } || echo "Warning: add_solana_token.sh not found"

    [ -f "${SCRIPT_DIR}/add_solana_usdc.sh" ] && {
        echo "Adding USDC (Solana) token..."
        bash "${SCRIPT_DIR}/add_solana_usdc.sh" "${NETWORK}"
    } || echo "Warning: add_solana_usdc.sh not found"

    # Create Solana pools
    [ -f "${SCRIPT_DIR}/add_sol_pool.sh" ] && {
        echo "Creating SOL/ksUSDT pool..."
        bash "${SCRIPT_DIR}/add_sol_pool.sh" "${NETWORK}"
    } || echo "Warning: add_sol_pool.sh not found"

    # create spl usdc pool
    [ -f "${SCRIPT_DIR}/add_usdc_pool.sh" ] && {
        echo "Creating USDC/ksUSDT pool..."
        bash "${SCRIPT_DIR}/add_usdc_pool.sh" "${NETWORK}"
    } || echo "Warning: add_usdc_pool.sh not found"
fi

if [[ "${NETWORK}" == "ic" ]]; then
    # calculate sha256 for SNS proposal
    echo "SHA256 for kong_backend.wasm.gz:"
    sha256sum "${DFX_ROOT}"/ic/canisters/kong_backend/kong_backend.wasm.gz
fi

