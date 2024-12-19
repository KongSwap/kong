#!/usr/bin/env bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd ".." && pwd )"

# Debug output
echo "=============== DEPLOY SCRIPT INFO ==============="
echo "Script directory: $SCRIPT_DIR"
echo "Project root: $PROJECT_ROOT"
echo "Current directory before cd: $(pwd)"

# Change to project root directory
echo "==============================================="

# Check required commands
for cmd in cargo npm dfx jq; do
    if ! command -v $cmd >/dev/null; then
        echo "$cmd is not installed"
        exit 1
    fi
done

# Check required identities
for identity in kong kong_token_minter kong_user1; do
    if ! dfx identity list | grep -q "$identity"; then
        echo "User $identity does not exist. Run create_identity.sh"
        exit 1
    fi
done

# Set network and prepare environment
NETWORK=${1:-local}
echo "Building and deploying KONG canisters to ${NETWORK}"

# Copy correct environment file using absolute path
if [ -f "copy_env.sh" ]; then
    echo "Running copy_env.sh from $SCRIPT_DIR"
    bash "./copy_env.sh" "${NETWORK}"
    
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

# Setup local network if needed
if [ "${NETWORK}" == "local" ]; then
    dfx stop
    dfx start --clean --background
    #dfx identity --network local deploy-wallet
fi

# Deploy core canisters
CORE_CANISTERS_SCRIPTS=(
    "deploy_kong_backend.sh"
	"deploy_kong_data.sh"
	"deploy_kong_svelte.sh"
)

for script in "${CORE_CANISTERS_SCRIPTS[@]}"; do
    [ -f "${script}" ] && {
        echo "Running ${script}"
        bash "${script}" "${NETWORK}"
    } || echo "Warning: ${script} not found"
done

# Deploy Internet Identity for local network
[ "${NETWORK}" == "local" ] && dfx deploy internet_identity --network "${NETWORK}"

# Deploy test token ledgers, faucet, mint and create tokens and pools for local/staging
if [[ "${NETWORK}" =~ ^(local|staging)$ ]]; then

    # Deploy test token ledger canisters
    LEDGER_SCRIPTS=(
        "deploy_ckusdt_ledger.sh"
        "deploy_icp_ledger.sh"
        "deploy_ckbtc_ledger.sh"
        "deploy_cketh_ledger.sh"
        "deploy_kong_ledger.sh"
    )

    for script in "${LEDGER_SCRIPTS[@]}"; do
        [ -f "${script}" ] && {
            echo "Running ${script}"
            bash "${script}" "${NETWORK}"
        } || echo "Warning: ${script} not found"
    done

    # deploy test token faucet canister
    [ -f "deploy_kong_faucet.sh" ] && {
        bash "deploy_kong_faucet.sh" "${NETWORK}"
    } || echo "Warning: deploy_kong_faucet.sh not found"

	# mint test tokens to kong_faucet
    [ -f "faucet_mint.sh" ] && {
        bash "faucet_mint.sh" "${NETWORK}"
    } || echo "Warning: user_mint.sh not found"

	# mint test tokens to kong_user1
    [ -f "user_mint.sh" ] && {
        bash "user_mint.sh" "${NETWORK}"
    } || echo "Warning: user_mint.sh not found"

    # deploy tokens and pools
    [ -f "deploy_tokens_pools.sh" ] && {
        bash "deploy_tokens_pools.sh" "${NETWORK}"
    } || echo "Warning: deploy_tokens_pools.sh not found"
fi
