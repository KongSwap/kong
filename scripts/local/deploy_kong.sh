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

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "${SCRIPT_DIR}/../.."

# Set network and prepare environment
NETWORK=${1:-local}
echo "Building and deploying to ${NETWORK}"

# Setup local network if needed
if [ "${NETWORK}" == "local" ]; then
    dfx stop
    dfx start --clean --background
    dfx identity --network local deploy-wallet
fi

dfx identity use kong

# Deploy core canisters
CORE_CANISTERS=("kong_backend" "kong_data" "kong_svelte")
for canister in "${CORE_CANISTERS[@]}"; do
    if CANISTER_ID=$(jq -r ".[\"${canister}\"][\"${NETWORK}\"]" canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            echo "Deploying ${canister} with ID: ${CANISTER_ID}"
            dfx deploy "${canister}" --network "${NETWORK}" --specified-id "${CANISTER_ID}" || true
        }
    fi
done

# Deploy Internet Identity for local network
[ "${NETWORK}" == "local" ] && dfx deploy internet_identity --network "${NETWORK}"

# Deploy ledger canisters
LEDGER_SCRIPTS=(
    "deploy_ksusdt_ledger.sh"
    "deploy_ksicp_ledger.sh"
    "deploy_ksusdc_ledger.sh"
    "deploy_ksbtc_ledger.sh"
    "deploy_kseth_ledger.sh"
    "deploy_kskong_ledger.sh"
)

for script in "${LEDGER_SCRIPTS[@]}"; do
    [ -f "${SCRIPT_DIR}/../${script}" ] && {
        echo "Running ${script}"
        bash "${SCRIPT_DIR}/../${script}" "${NETWORK}"
    } || echo "Warning: ${script} not found"
done

# Deploy faucet and mint for local/staging
if [[ "${NETWORK}" =~ ^(local|staging)$ ]]; then
    dfx deploy kong_faucet --network "${NETWORK}"
	# mint test tokens to kong_faucet
    [ -f "${SCRIPT_DIR}/../faucet_mint.sh" ] && {
        bash "${SCRIPT_DIR}/../faucet_mint.sh" "${NETWORK}"
    } || echo "Warning: user_mint.sh not found"
	# mint test tokens to kong_user1
    [ -f "${SCRIPT_DIR}/../user_mint.sh" ] && {
        bash "${SCRIPT_DIR}/../user_mint.sh" "${NETWORK}"
    } || echo "Warning: user_mint.sh not found"
fi

echo "Current DFX identity: $(dfx identity whoami)"
