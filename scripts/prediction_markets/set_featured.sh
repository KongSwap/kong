#!/bin/bash
# Script to set the featured status of a market in the Kong Swap prediction markets

# Default values
MARKET_ID=""
FEATURED="true"
CANISTER_ID="uxrrr-q7777-77774-qaaaq-cai"

# Function to display usage information
show_help() {
    echo "Usage: $0 -m <market_id> [-f true|false] [-c <canister_id>]"
    echo ""
    echo "Options:"
    echo "  -m MARKET_ID    The ID of the market to update (required)"
    echo "  -f FEATURED     Set to 'true' to feature the market, 'false' to unfeature (default: true)"
    echo "  -c CANISTER_ID  The canister ID of the prediction markets backend (default: $CANISTER_ID)"
    echo "  -h              Display this help message"
    echo ""
    echo "Example:"
    echo "  $0 -m 123 -f true     # Set market 123 as featured"
    echo "  $0 -m 456 -f false    # Remove featured status from market 456"
}

# Parse command line arguments
while getopts "m:f:c:h" opt; do
    case $opt in
        m) MARKET_ID="$OPTARG" ;;
        f) FEATURED="$OPTARG" ;;
        c) CANISTER_ID="$OPTARG" ;;
        h) show_help; exit 0 ;;
        \?) echo "Invalid option: -$OPTARG" >&2; show_help; exit 1 ;;
    esac
done

# Check if market ID is provided
if [ -z "$MARKET_ID" ]; then
    echo "Error: Market ID is required"
    show_help
    exit 1
fi

# Convert featured value to proper boolean format
if [ "$FEATURED" = "true" ] || [ "$FEATURED" = "1" ] || [ "$FEATURED" = "yes" ]; then
    FEATURED="true"
elif [ "$FEATURED" = "false" ] || [ "$FEATURED" = "0" ] || [ "$FEATURED" = "no" ]; then
    FEATURED="false"
else
    echo "Error: Featured status must be 'true' or 'false'"
    show_help
    exit 1
fi

echo "Setting market $MARKET_ID featured status to $FEATURED..."

# Call the function using dfx
dfx canister call $CANISTER_ID set_market_featured "($MARKET_ID, $FEATURED)"

# Check the result
if [ $? -eq 0 ]; then
    echo "Successfully updated market $MARKET_ID featured status to $FEATURED"
else
    echo "Failed to update market featured status"
    exit 1
fi
