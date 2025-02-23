#!/usr/bin/env bash
set -e

# Configuration
CANISTER_NAME="backend"
SUBNET_ID="yinp6-35cfo-wgcd2-oc4ty-2kqpf-t4dul-rfk33-fsq3r-mfmua-m2ngh-jqe"
NETWORK="ic"

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🚀 Deploying ${CANISTER_NAME} to ${NETWORK} network on subnet ${SUBNET_ID}"

# Step 1: Create the canister
echo "📦 Creating canister..."
CANISTER_ID=$(dfx canister create "$CANISTER_NAME" --subnet "$SUBNET_ID" --network "$NETWORK" | grep -oE '[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{3}')

echo -e "${GREEN}✅ Canister created with ID: ${CANISTER_ID}${NC}"

# Step 2: Build and deploy the Wasm
echo "🔨 Building and deploying Wasm..."
dfx deploy "$CANISTER_NAME" --network "$NETWORK"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "🌐 Canister URL: https://${CANISTER_ID}.icp0.io/"
echo "🔍 Candid UI: https://${CANISTER_ID}.icp0.io/_/candid" 
