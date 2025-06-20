#!/usr/bin/env bash

# Hot update script for Kong backend development
# This script:
# 1. Increments version
# 2. Cleans build artifacts
# 3. Rebuilds kong_backend
# 4. Deploys with upgrade
# 5. Verifies the deployment
# should change better to pre check module hash than check module hash again after
# faster that way

set -e

# Colors for output
if [ -t 1 ] && command -v tput >/dev/null && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
    BOLD="$(tput bold)"
    NORMAL="$(tput sgr0)"
    GREEN="$(tput setaf 2)"
    BLUE="$(tput setaf 4)"
    RED="$(tput setaf 1)"
    YELLOW="$(tput setaf 3)"
else
    BOLD=""
    NORMAL=""
    GREEN=""
    BLUE=""
    RED=""
    YELLOW=""
fi

print_header() {
    echo
    echo "${BOLD}========== $1 ==========${NORMAL}"
    echo
}

print_success() {
    echo "${GREEN}✓${NORMAL} $1"
}

print_error() {
    echo "${RED}✗${NORMAL} $1" >&2
}

print_info() {
    echo "${BLUE}ℹ${NORMAL} $1"
}

# Network parameter (default to local)
NETWORK="${1:-local}"
NETWORK_FLAG=""
if [ "${NETWORK}" != "local" ]; then
    NETWORK_FLAG="--network ${NETWORK}"
fi

print_header "HOT UPDATE KONG BACKEND"

# Step 1: Get current version and increment
print_info "Getting current version..."
CARGO_FILE="src/kong_backend/Cargo.toml"
CURRENT_VERSION=$(grep '^version' $CARGO_FILE | sed 's/version = "\(.*\)"/\1/')
print_info "Current version: $CURRENT_VERSION"

# Increment patch version
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

print_info "Updating to version: $NEW_VERSION"
sed -i '' "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" $CARGO_FILE

# Step 2: Clean build artifacts
print_header "CLEAN BUILD"
print_info "Running cargo clean..."
cargo clean -p kong_backend
print_success "Build artifacts cleaned"

# Step 3: Build kong_backend
print_header "BUILD"
print_info "Building kong_backend..."
./scripts/build_kong_backend.sh local
print_success "Build completed"

# Step 4: Deploy with upgrade
print_header "DEPLOY"
print_info "Deploying kong_backend..."

# Stop the canister first to ensure clean upgrade
print_info "Stopping canister..."
dfx canister stop kong_backend ${NETWORK_FLAG} || true

# Deploy with upgrade
dfx deploy kong_backend ${NETWORK_FLAG} --upgrade-unchanged

# Start the canister again
print_info "Starting canister..."
dfx canister start kong_backend ${NETWORK_FLAG}

print_success "Deployment completed"

# Step 5: Verify deployment by calling version
print_header "VERIFICATION"
print_info "Verifying deployment..."

# Call the canister to get version info
KONG_INFO=$(dfx canister call ${NETWORK_FLAG} kong_backend icrc1_name 2>&1 || echo "")
if [[ "$KONG_INFO" == *"Kong Backend"* ]] || [[ "$KONG_INFO" == *"kong_backend"* ]]; then
    print_success "Kong backend is responding"
else
    print_error "Kong backend verification failed"
    echo "Response: $KONG_INFO"
fi

# Summary
print_header "SUMMARY"
print_success "Hot update completed!"
print_info "Version updated: $CURRENT_VERSION → $NEW_VERSION"
print_info "Network: ${NETWORK:-local}"
print_info "Kong backend canister ID: $(dfx canister id ${NETWORK_FLAG} kong_backend)"