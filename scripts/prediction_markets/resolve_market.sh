#!/bin/bash

# Check if required arguments are provided
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <market_id> <outcome_index1> [outcome_index2 ...]"
    echo "Example: $0 0 1     # Resolve market 0 with outcome 1 as winner"
    echo "Example: $0 0 0 1   # Resolve market 0 with both outcomes 0 and 1 as winners"
    exit 1
fi

MARKET_ID=$1
shift  # Remove market_id from arguments

# Build the outcome indices array
OUTCOMES="vec {"
first=true
for index in "$@"; do
    if [ "$first" = true ]; then
        OUTCOMES="$OUTCOMES$index : nat"
        first=false
    else
        OUTCOMES="$OUTCOMES; $index : nat"
    fi
done
OUTCOMES="$OUTCOMES}"

dfx canister call prediction_markets_backend resolve_via_admin "(
    $MARKET_ID : nat,
    $OUTCOMES
)"

# Examples:
# # Resolve market 0 with EXE (index 0) as winner
# ./scripts/resolve_market.sh 0 0

# # Resolve market 0 with ALICE (index 1) as winner
# ./scripts/resolve_market.sh 0 1

# # Resolve market 0 with both as winners (split pot)
# ./scripts/resolve_market.sh 0 0 1