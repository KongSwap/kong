#!/bin/bash

# Check if miner name is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <miner_name>"
    echo "Example: $0 miner1"
    exit 1
fi

MINER_NAME=$1

# Check if there's a current block (token_backend doesnt generate a static genesis block yet TODO
# genesis blocks are cool and idk how to make them epic but for now just call generate_block, something token_backend
# also does when a solution is found etc)
CURRENT_BLOCK=$(dfx canister call token_backend get_current_block)

if [[ $CURRENT_BLOCK == "(null)" ]] || [[ $CURRENT_BLOCK == "(opt null)" ]]; then
    echo "No block available. Generating new block..."
    dfx canister call token_backend generate_new_block
    if [ $? -ne 0 ]; then
        echo "Failed to generate new block"
        exit 1
    fi
    echo "New block generated successfully"
fi

echo "Starting mining for $MINER_NAME..."
dfx canister call "$MINER_NAME" start_mining

# Show mining info
# not reachable since mining is started
# echo -e "\nMining info:"
# dfx canister call "$MINER_NAME" get_info
