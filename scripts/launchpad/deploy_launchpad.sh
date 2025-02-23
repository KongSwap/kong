#!/usr/bin/env bash

# Usage: 
# ./deploy_launchpad.sh [component] [network]
# - component: frontend | backend | all (default: all)
# - network: local (default) | ic
# Examples:
# ./deploy_launchpad.sh              # Deploy all locally (including icp_ledger)
# ./deploy_launchpad.sh frontend ic  # Deploy frontend to IC
# ./deploy_launchpad.sh backend      # Deploy backend locally
# ./deploy_launchpad.sh ic           # Deploy all to IC (legacy)

set -e

function build_backend {
    cargo build --target wasm32-unknown-unknown --release --package launchpad_backend
    candid-extractor target/wasm32-unknown-unknown/release/launchpad_backend.wasm > src/launchpad_backend/launchpad_backend.did
}

function setup_asset_storage {
    local network="$1"
    local network_dir=".dfx/${network:-local}"
    local canister_dir="$network_dir/canisters/launchpad_frontend"
    
    # Create necessary directories
    mkdir -p "$canister_dir"
    
    # Copy our custom assetstorage.did
    cp src/launchpad_frontend/assetstorage.did "$canister_dir/assetstorage.did"
    
    echo "Asset storage setup completed for $network network"
}

function deploy_frontend {
    local network_arg=""
    [ "$1" == "ic" ] && network_arg="--network=ic"
    
    # Setup asset storage before deployment
    setup_asset_storage "$1"
    
    dfx deploy launchpad_frontend $network_arg
}

function deploy_backend {
    local network_arg=""
    [ "$1" == "ic" ] && network_arg="--network=ic"
    dfx deploy launchpad_backend $network_arg
}

function deploy_icp_ledger {
    local network_arg=""
    # Only deploy ledger on local deployments; if network isn't local, skip it.
    if [ "$1" != "local" ]; then
        return
    fi

    # Use dfx identity get to retrieve the current principal (owner)
    local owner
    owner=$(dfx identity get)

    # Generate a dynamic init args file for the icp_ledger canister using the current identity.
    cat > icp_ledger_init_args.txt <<EOF
(variant { Init =
record {
    token_symbol = "LICP";
    token_name = "LocalICP";
    minting_account = record { owner = principal "$owner" };
    transfer_fee = 10_000;
    metadata = vec {};
    feature_flags = opt record { icrc2 = true; icrc3 = true };
    initial_balances = vec { record { record { owner = principal "$owner" }; 10_000_000_000; } };
    archive_options = record {
        num_blocks_to_archive = 1000;
        trigger_threshold = 2000;
        controller_id = principal "$owner";
        cycles_for_archive_creation = opt 10000000000000;
    };
}
})
EOF

    # Deploy the icp_ledger canister.
    dfx deploy icp_ledger
}

if [ $# -eq 0 ]; then
    # Default: deploy everything locally (including icp_ledger)
    build_backend
    deploy_backend "local"
    deploy_frontend "local"
    deploy_icp_ledger "local"
else
    # Parse arguments
    component="$1"
    network="${2:-local}"  # Default to local if second arg not provided

    # Validate network: if it's not local or ic, then error out.
    if [[ "$network" != "local" && "$network" != "ic" ]]; then
        echo "Invalid network. Use 'local' or 'ic'."
        exit 1
    fi

    # Handle deployment
    case "$component" in
        "frontend")
            deploy_frontend "$network"
            ;;
        "backend")
            build_backend
            deploy_backend "$network"
            ;;
        "ic")  # Backwards compatibility: deploy all to IC
            build_backend
            deploy_backend "ic"
            deploy_frontend "ic"
            ;;
        *)
            if [ "$component" == "all" ] || [ -z "$component" ]; then
                build_backend
                deploy_backend "$network"
                deploy_frontend "$network"
                # Only deploy icp_ledger if network is local.
                if [ "$network" == "local" ]; then
                    deploy_icp_ledger "local"
                fi
            else
                echo "Invalid component. Use 'frontend', 'backend', or 'all'."
                exit 1
            fi
            ;;
    esac
fi
