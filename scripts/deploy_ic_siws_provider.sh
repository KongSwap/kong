#!/bin/bash

# --- Start: Added Secrets Generation ---
# Get the project root directory (1 level up from scripts folder)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

# Source the .env file from project root to get DFX_NETWORK (still needed for fallback/Doppler check)
if [ -f "${PROJECT_ROOT}/.env" ]; then
  source "${PROJECT_ROOT}/.env"
else
  echo "Warning: ${PROJECT_ROOT}/.env not found in deploy_ic_siws_provider.sh"
fi

# Use the first argument ($1) as the primary network identifier, fallback to DFX_NETWORK then 'local'
network="${1:-${DFX_NETWORK:-local}}"
echo "deploy_ic_siws_provider.sh: Using network: ${network}"


# Pull secrets from Doppler based on the determined network
if [ "$network" != "local" ] && command -v doppler &> /dev/null; then
  echo "deploy_ic_siws_provider.sh: Generating secrets using Doppler (${network})..."
  doppler secrets download --config ${network} --no-file --format env > "${PROJECT_ROOT}/.secrets"
else
  echo "deploy_ic_siws_provider.sh: Skipping Doppler secrets generation (Network: ${network}, Doppler installed: $(command -v doppler &> /dev/null && echo yes || echo no))"
  # Ensure the file exists even if empty, so source doesn't fail
  touch "${PROJECT_ROOT}/.secrets"
fi

# Source the generated secrets file if it exists and export variables
if [ -f "${PROJECT_ROOT}/.secrets" ]; then
  echo "deploy_ic_siws_provider.sh: Sourcing secrets from ${PROJECT_ROOT}/.secrets"
  set -a # Automatically export all variables defined after this
  source "${PROJECT_ROOT}/.secrets"
  set +a # Stop automatically exporting variables
else
  echo "Warning: ${PROJECT_ROOT}/.secrets file not found for sourcing in deploy_ic_siws_provider.sh"
fi
# --- End: Added Secrets Generation ---

# Read salt from environment variable (should now be populated from sourced .secrets), defaulting if not set
siws_salt="${SIWS_SALT:-Dfwdsf31453qegsdq2345eFDasFGSHd}"

# Set domain, URI, scheme and target canister IDs based on the network
if [ "$network" = "ic" ]; then
    domain="kongswap.io"
    uri="https://www.kongswap.io"
    scheme="https"
    kong_backend_id="2ipq2-uqaaa-aaaar-qailq-cai"
    trollbox_id="rchbn-fqaaa-aaaao-a355a-cai"
    prediction_markets_id="xidgj-jyaaa-aaaad-qghpq-cai"
elif [ "$network" = "staging" ]; then
    domain="localhost" # Or staging domain if applicable
    uri="http://localhost:5173" # Or staging URI if applicable
    scheme="http" # Or https if applicable
    kong_backend_id="l4lgk-raaaa-aaaar-qahpq-cai"
    trollbox_id="rchbn-fqaaa-aaaao-a355a-cai" # staging ID same as ic/local in json
    prediction_markets_id="xidgj-jyaaa-aaaad-qghpq-cai" # staging ID same as ic/local in json
else # Default to local
    network="local" # Ensure network variable is explicitly local for dfx commands
    domain="localhost"
    uri="http://localhost:5173"
    scheme="http"
    # Note: canister_ids.all.json shows local IDs same as ic for these? Using them as specified.
    kong_backend_id="2ipq2-uqaaa-aaaar-qailq-cai"
    trollbox_id="rchbn-fqaaa-aaaao-a355a-cai"
    prediction_markets_id="xidgj-jyaaa-aaaad-qghpq-cai"
fi

echo "Using SIWS_SALT: ${siws_salt}" # Print the salt value

# Get the dynamically created/deployed ic_siws_provider ID for the current network
# Ensure the canister is created before trying to get its ID
if ! dfx canister id ic_siws_provider --network "$network" > /dev/null 2>&1; then
    echo "ic_siws_provider canister ID not found for network '$network'. Attempting to create..."
    dfx canister create ic_siws_provider --network "$network"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create ic_siws_provider canister for network '$network'."
        exit 1
    fi
fi

ic_siws_provider_id=$(dfx canister id ic_siws_provider --network "$network")
if [ -z "$ic_siws_provider_id" ]; then
    echo "Error: Failed to get canister ID for ic_siws_provider on network '$network' even after creation attempt."
    exit 1
fi
echo "Using ic_siws_provider ID: ${ic_siws_provider_id}"


# Use standard double quotes for the argument and escape internal quotes
dfx deploy ic_siws_provider --network "$network" --argument "(
    record {
        domain = \"$domain\";
        uri = \"$uri\";
        salt = \"$siws_salt\";
        chain_id = opt \"mainnet\";
        scheme = opt \"$scheme\";
        statement = opt \"Connect to KongSwap\";
        sign_in_expires_in = opt 300000000000;
        session_expires_in = opt 604800000000000;
        targets = null;
    }
)" --mode reinstall