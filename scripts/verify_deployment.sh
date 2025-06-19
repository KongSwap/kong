#!/usr/bin/env bash

# Deployment verification and recovery script
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
NETWORK=${1:-local}

log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo "[WARNING] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Verify canister deployment status
verify_canister() {
    local canister_name="$1"
    local network="$2"
    
    if dfx canister id --network "$network" "$canister_name" >/dev/null 2>&1; then
        local canister_id=$(dfx canister id --network "$network" "$canister_name")
        log_info "✓ $canister_name exists: $canister_id"
        
        # Check if canister is running
        if dfx canister status --network "$network" "$canister_name" >/dev/null 2>&1; then
            local status=$(dfx canister status --network "$network" "$canister_name" 2>/dev/null | head -1 || echo "Unknown")
            log_info "  Status: $status"
        else
            log_warning "  Could not get status for $canister_name"
        fi
        return 0
    else
        log_error "✗ $canister_name does not exist"
        return 1
    fi
}

# Main verification function
verify_deployment() {
    local network="$1"
    
    log_info "=============== DEPLOYMENT VERIFICATION ==============="
    log_info "Network: $network"
    log_info "======================================================"
    
    # Define required canisters
    local core_canisters=("kong_backend")
    local ledger_canisters=()
    local auxiliary_canisters=()
    
    if [[ "$network" =~ ^(local|staging)$ ]]; then
        ledger_canisters=("ksusdt_ledger" "icp_ledger" "ksbtc_ledger" "kseth_ledger" "kskong_ledger")
        auxiliary_canisters=("kong_faucet")
        if [ "$network" == "local" ]; then
            auxiliary_canisters+=("internet_identity")
        fi
    fi
    
    local all_canisters=("${core_canisters[@]}")
    if [ ${#ledger_canisters[@]} -gt 0 ]; then
        all_canisters+=("${ledger_canisters[@]}")
    fi
    if [ ${#auxiliary_canisters[@]} -gt 0 ]; then
        all_canisters+=("${auxiliary_canisters[@]}")
    fi
    
    # Verify each canister
    local missing_canisters=()
    local existing_canisters=()
    
    log_info "Checking core canisters..."
    for canister in "${core_canisters[@]}"; do
        if verify_canister "$canister" "$network"; then
            existing_canisters+=("$canister")
        else
            missing_canisters+=("$canister")
        fi
    done
    
    if [ ${#ledger_canisters[@]} -gt 0 ]; then
        log_info "Checking ledger canisters..."
        for canister in "${ledger_canisters[@]}"; do
            if verify_canister "$canister" "$network"; then
                existing_canisters+=("$canister")
            else
                missing_canisters+=("$canister")
            fi
        done
    fi
    
    if [ ${#auxiliary_canisters[@]} -gt 0 ]; then
        log_info "Checking auxiliary canisters..."
        for canister in "${auxiliary_canisters[@]}"; do
            if verify_canister "$canister" "$network"; then
                existing_canisters+=("$canister")
            else
                missing_canisters+=("$canister")
            fi
        done
    fi
    
    # Summary
    log_info "=============== VERIFICATION SUMMARY ==============="
    log_info "Existing canisters: ${#existing_canisters[@]}"
    for canister in "${existing_canisters[@]}"; do
        log_info "  ✓ $canister"
    done
    
    if [ ${#missing_canisters[@]} -gt 0 ]; then
        log_warning "Missing canisters: ${#missing_canisters[@]}"
        for canister in "${missing_canisters[@]}"; do
            log_error "  ✗ $canister"
        done
        log_info "================================================="
        return 1
    else
        log_info "All required canisters are deployed!"
        log_info "================================================="
        return 0
    fi
}

# Recovery suggestions
suggest_recovery() {
    local network="$1"
    
    log_info "=============== RECOVERY SUGGESTIONS ==============="
    log_info "To recover from deployment failures:"
    log_info ""
    log_info "1. Re-run the main deployment script:"
    log_info "   bash ${SCRIPT_DIR}/deploy_kong.sh $network"
    log_info ""
    log_info "2. For specific ledger failures, run individual scripts:"
    log_info "   bash ${SCRIPT_DIR}/deploy_ksusdt_ledger.sh $network"
    log_info "   bash ${SCRIPT_DIR}/deploy_icp_ledger.sh $network"
    log_info "   bash ${SCRIPT_DIR}/deploy_ksbtc_ledger.sh $network"
    log_info "   bash ${SCRIPT_DIR}/deploy_kseth_ledger.sh $network"
    log_info "   bash ${SCRIPT_DIR}/deploy_kskong_ledger.sh $network"
    log_info ""
    log_info "3. Check deployment logs:"
    log_info "   cat ${PROJECT_ROOT}/.failed_deployments.log"
    log_info ""
    log_info "4. For subnet conflicts (common with ksKONG), try:"
    log_info "   dfx canister delete --network $network kskong_ledger"
    log_info "   bash ${SCRIPT_DIR}/deploy_kskong_ledger.sh $network"
    log_info "================================================="
}

# Clean deployment state (use with caution)
clean_deployment_state() {
    local network="$1"
    local deployment_state_file="${PROJECT_ROOT}/.deployment_state.json"
    
    log_warning "Cleaning deployment state for network: $network"
    
    if [ -f "$deployment_state_file" ]; then
        # Remove network-specific state
        jq --arg net "$network" 'del(.[$net])' "$deployment_state_file" > "${deployment_state_file}.tmp" && \
            mv "${deployment_state_file}.tmp" "$deployment_state_file"
        log_info "Deployment state cleaned for $network"
    else
        log_info "No deployment state file found"
    fi
}

# Main execution
case "${2:-verify}" in
    "verify")
        if ! verify_deployment "$NETWORK"; then
            suggest_recovery "$NETWORK"
            exit 1
        fi
        ;;
    "clean")
        clean_deployment_state "$NETWORK"
        ;;
    "recover")
        suggest_recovery "$NETWORK"
        ;;
    *)
        echo "Usage: $0 <network> [verify|clean|recover]"
        echo "  verify  - Check deployment status (default)"
        echo "  clean   - Clean deployment state for network"
        echo "  recover - Show recovery suggestions"
        exit 1
        ;;
esac