#!/usr/bin/env bash

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
echo "Building and deploying to ${NETWORK}"

# Setup local network if needed
if [ "${NETWORK}" == "local" ]; then
    dfx stop
    dfx start --clean --background
    #dfx identity --network local deploy-wallet
fi

dfx identity use kong

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

echo "Current DFX identity: $(dfx identity whoami)"
