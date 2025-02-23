#!/bin/bash

# Start miners 1-20 in sequence
for i in {1..20}; do
    MINER_NAME="miner$i"
    echo "Starting $MINER_NAME..."
    
    # Check if there's a current block
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
    
    echo "$MINER_NAME started successfully"
    echo "-----------------------------------"
done

echo "All miners started successfully!"
