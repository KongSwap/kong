#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..
static_dir="${root_dir}/src/kong_svelte/static/.well-known"

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
EOL
            # Create ii-alternative-origins file for production
            cat > "${static_dir}/ii-alternative-origins" << EOL
{
    "alternativeOrigins": [
        "https://www.kongswap.io",
        "https://kongswap.io",
        "https://www.kingkongswap.com",
        "https://kingkongswap.com",
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
    if CANISTER_ID=$(jq -r ".[\"kong_svelte\"][\"local\"]" "${root_dir}"/canister_ids.all.json); then
        [ "${CANISTER_ID}" != "null" ] && {
            create_static_files "local" "${CANISTER_ID}"
            dfx deploy kong_svelte --network local --specified-id "${CANISTER_ID}" || true
        }
    fi
fi