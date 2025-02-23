#!/bin/bash
# TODO! deprecate this
# Check if required arguments are provided
if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Usage: $0 <lite|normal|premium> [miner_number]"
    exit 1
fi

# Capitalize first letter for Candid variant
TYPE="$(tr '[:lower:]' '[:upper:]' <<< ${1:0:1})${1:1}"

# Transform miners based on arguments
if [ $# -eq 2 ]; then
    # Transform specific miner
    MINER_NAME="$2"
    echo "Transforming ${MINER_NAME} to $TYPE..."
    dfx canister call "${MINER_NAME}" transform_miner "(variant { $TYPE })"
else
    # Transform all miners
    for i in {1..20}; do
        echo "Transforming miner${i} to $TYPE..."
        dfx canister call "miner${i}" transform_miner "(variant { $TYPE })"
    done
fi
# End of Selection
# example: sh scripts/transform_miners.sh lite (all miners will be transformed to lite)
# example: sh scripts/transform_miners.sh premium miner1  (miner1 will be transformed to premium)
