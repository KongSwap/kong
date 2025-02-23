#!/bin/bash

# Check if an argument is provided
EXCLUDE_MINER=""
if [ $# -eq 1 ]; then
    EXCLUDE_MINER=$1
    echo "Will stop all miners except $EXCLUDE_MINER"
fi

# Function to stop a miner
stop_miner() {
    local miner_name=$1
    echo "Stopping $miner_name..."
    dfx canister call "$miner_name" stop_mining
    echo "✓ $miner_name stopped"
}

# Loop through miners 1-20
for i in {1..20}; do
    MINER_NAME="miner$i"
    
    # If we have an excluded miner, skip it
    if [ "$MINER_NAME" = "$EXCLUDE_MINER" ]; then
        echo "Skipping $MINER_NAME as requested"
        continue
    fi
    
    # Stop the miner and handle any errors
    if ! stop_miner "$MINER_NAME"; then
        echo "⚠️  Warning: Failed to stop $MINER_NAME"
    fi
done

echo "----------------------------------------"
if [ -z "$EXCLUDE_MINER" ]; then
    echo "All miners stopped successfully"
else
    echo "All miners stopped except $EXCLUDE_MINER"
fi
