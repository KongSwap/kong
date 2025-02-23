#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <number_of_miners>"
    echo "Example: $0 1"
    exit 1
fi

echo "Current directory: $(pwd)"

sh scripts/launchpad/get_latest_wasms.sh

echo "Starting token backend..."

# Ensure clean environment
dfx killall
dfx killall
dfx killall

# Start dfx in background
dfx start --clean --background

# Create and deploy token backend
echo "Creating token backend canister..."
dfx canister create token_backend || { echo "Failed to create token_backend canister"; exit 1; }

echo "Deploying token backend..."
sh scripts/launchpad/deploy_token_backend.sh || { echo "Failed to deploy token_backend"; exit 1; }

# Verify token_backend exists before proceeding
if ! dfx canister status token_backend >/dev/null 2>&1; then
    echo "Token backend canister not found after deployment"
    exit 1
fi

echo "Initializing token backend..."
sh scripts/launchpad/start_token.sh || { echo "Failed to initialize token_backend"; exit 1; }

# Deploy and connect miners
count=0
for miner in miner $(seq -f "miner%g" 1 19); do
    if [ $count -ge $1 ]; then
        break
    fi
    echo "Deploying and connecting $miner..."
    dfx canister create "$miner" || { echo "Failed to create $miner canister"; continue; }
    sh scripts/launchpad/deploy_miner.sh "$miner" || { echo "Failed to deploy $miner"; continue; }
    sh scripts/launchpad/connect_token.sh "$miner" token_backend || { echo "Failed to connect $miner to token_backend"; continue; }
    count=$((count + 1))
done

count=0
for miner in miner $(seq -f "miner%g" 1 19); do
    if [ $count -ge $1 ]; then
        break
    fi
    echo "Starting mining for $miner..."
    sh scripts/launchpad/start_miner.sh "$miner"
    count=$((count + 1))
done
