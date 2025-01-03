#!/usr/bin/env bash

# Setup directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd ".." && pwd )"
DFX_ROOT="${PROJECT_ROOT}/.dfx"
echo "=============== DEPLOY SCRIPT INFO ==============="
echo "Project root: $PROJECT_ROOT"
echo "Dfx root: $DFX_ROOT"
echo "Script directory: $SCRIPT_DIR"
echo "==============================================="

# Set network and prepare environment
NETWORK=${1:-local}
echo "Building and deploying KONG canisters to ${NETWORK}"

# Check required commands
for cmd in rustc cargo npm dfx jq sha256sum; do
    if ! command -v $cmd >/dev/null; then
        echo "$cmd is not installed"
        exit 1
    fi
done

# check wasm32-unknown-unknown target installed
if ! rustup target list | grep -q "wasm32-unknown-unknown"; then
    echo "wasm32-unknown-unknown target not installed"
    echo "Run \"rustup target add wasm32-unknown-unknown\""
    exit 1
fi

# Check required identities for local and staging networks
if [[ "${NETWORK}" =~ ^(local|staging)$ ]]; then
    for identity in kong kong_token_minter kong_user1 kong_user2; do
        if ! dfx identity list | grep -q "$identity"; then
            echo "User $identity does not exist. Run \"create_identity.sh\""
            exit 1
        fi
    done
fi

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

# # Deploy test token ledgers, faucet, mint and create tokens and pools for local/staging
# if [[ "${NETWORK}" =~ ^(local|staging)$ ]]; then

#     # Deploy test token ledger canisters
#     LEDGER_SCRIPTS=(
#         "deploy_ksusdt_ledger.sh"
#         "deploy_ksicp_ledger.sh"
#         "deploy_ksbtc_ledger.sh"
#         "deploy_kseth_ledger.sh"
#         "deploy_kskong_ledger.sh"
#     )

#     for script in "${LEDGER_SCRIPTS[@]}"; do
#         [ -f "${script}" ] && {
#             echo "Running ${script}"
#             bash "${script}" "${NETWORK}"
#         } || echo "Warning: ${script} not found"
#     done

#     # deploy test token faucet canister
#     [ -f "deploy_kong_faucet.sh" ] && {
#         bash "deploy_kong_faucet.sh" "${NETWORK}"
#     } || echo "Warning: deploy_kong_faucet.sh not found"

# 	# mint test tokens to kong_faucet
#     [ -f "faucet_mint.sh" ] && {
#         bash "faucet_mint.sh" "${NETWORK}"
#     } || echo "Warning: user_mint.sh not found"

# 	# mint test tokens to kong_user1
#     [ -f "user_mint.sh" ] && {
#         bash "user_mint.sh" "${NETWORK}"
#     } || echo "Warning: user_mint.sh not found"

#     # deploy tokens and pools
#     [ -f "deploy_tokens_pools.sh" ] && {
#         bash "deploy_tokens_pools.sh" "${NETWORK}"
#     } || echo "Warning: deploy_tokens_pools.sh not found"
# fi

# if [[ "${NETWORK}" == "ic" ]]; then
#     # calculate sha256 for SNS proposal
#     echo "SHA256 for kong_backend.wasm.gz:"
#     sha256sum "${DFX_ROOT}"/ic/canisters/kong_backend/kong_backend.wasm.gz
# fi
