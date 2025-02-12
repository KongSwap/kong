#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..
static_dir="${root_dir}/src/kong_svelte/static/.well-known"

# Add this at the very top of the script after initial_dir definitions
NETWORK=${1:-local}

# Deploy prediction markets backend canister
root_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/.. && pwd )"
CANISTER_ID=$(jq -r ".prediction_markets_backend.${NETWORK}" "${root_dir}"/canister_ids.all.json)
echo "CANISTER_ID: ${CANISTER_ID}"
# Verify canister ID exists before deploying
if [ -z "$CANISTER_ID" ] || [ "$CANISTER_ID" == "null" ]; then
    echo "Error: Missing prediction_markets_backend canister ID for network ${NETWORK}"
    exit 1
fi

dfx deploy prediction_markets_backend --network "${NETWORK}" --specified-id "${CANISTER_ID}"

# Create .well-known directory if it doesn't exist
mkdir -p "${static_dir}"

create_static_files() {
    local env=$1
    local canister_id=$2

    case $env in
        "ic")
            # Create ic-domains file for production
            cat > "${static_dir}/ic-domains" << EOL
www.kongswap.io
kongswap.io
www.kingkongswap.com
kingkongswap.com
dev.kongswap.io
EOL
            # Create ii-alternative-origins file for production
            cat > "${static_dir}/ii-alternative-origins" << EOL
{
    "alternativeOrigins": [
        "https://www.kongswap.io",
        "https://kongswap.io",
        "https://www.kingkongswap.com",
        "https://kingkongswap.com",
        "https://dev.kongswap.io",
        "https://edoy4-liaaa-aaaar-qakha-cai.icp0.io",
        "https://${canister_id}.icp0.io"
    ]
}
EOL
            ;;
            
        "staging")
            # Create ic-domains file for staging
            cat > "${static_dir}/ic-domains" << EOL
dev.kongswap.io
EOL
            # Create ii-alternative-origins file for staging
            cat > "${static_dir}/ii-alternative-origins" << EOL
{
    "alternativeOrigins": [
        "https://dev.kongswap.io",
        "https://${canister_id}.icp0.io",
        "https://localhost:5173"
    ]
}
EOL
            ;;
            
        "local")
            # Create ic-domains file for local
            cat > "${static_dir}/ic-domains" << EOL
localhost
EOL
            # Create ii-alternative-origins file for local
            cat > "${static_dir}/ii-alternative-origins" << EOL
{
    "alternativeOrigins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://${canister_id}.localhost:8000"
    ]
}
EOL
            ;;
    esac
}

npm i

if [ $1 == "ic" ]; then
    bash create_canister_id.sh ic
    CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"ic\"]" "${root_dir}"/canister_ids.all.json)
    create_static_files "ic" "${CANISTER_ID}"
    dfx build kong_svelte --network ic
elif [ $1 == "staging" ]; then
    bash create_canister_id.sh staging
    CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"staging\"]" "${root_dir}"/canister_ids.all.json)
    create_static_files "staging" "${CANISTER_ID}"
    dfx deploy kong_svelte --network staging
elif [ $1 == "local" ]; then
    CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"local\"]" "${root_dir}"/canister_ids.all.json)
    echo "CANISTER_ID: ${CANISTER_ID}"
    create_static_files "local" "${CANISTER_ID}"
    dfx deploy kong_svelte --specified-id "${CANISTER_ID}"
fi
