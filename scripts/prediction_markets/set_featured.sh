#!/bin/bash
# Script to set the featured status of a market in the Kong Swap prediction markets

# Default values
MARKET_ID="2"
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

# Call the function using dfx and capture the output
RESULT=$(dfx canister call $CANISTER_ID set_market_featured "($MARKET_ID, $FEATURED)")
RESULT_CODE=$?

# Check the command exit code first
if [ $RESULT_CODE -ne 0 ]; then
    echo "Command failed with error code $RESULT_CODE"
    exit 1
fi

# Check if the result contains an error
if echo "$RESULT" | grep -q "Err"; then
    echo "Error: $RESULT"
    echo "Failed to update market featured status"
    exit 1
fi

echo "Update command executed successfully. Verifying the market status..."

# Get the market to verify the featured status was set correctly
MARKET_INFO=$(dfx canister call $CANISTER_ID get_market "($MARKET_ID)")
MARKET_CODE=$?

if [ $MARKET_CODE -ne 0 ]; then
    echo "Failed to retrieve market information after update"
    exit 1
fi

# Check if the market info contains 'opt record' (indicating a valid result)
if ! echo "$MARKET_INFO" | grep -q "opt record"; then
    echo "Error: Market $MARKET_ID not found or invalid response format"
    echo "Response: $MARKET_INFO"
    exit 1
fi

# Check if the featured flag matches what we set
if echo "$MARKET_INFO" | grep -q "featured = $FEATURED"; then
    echo "Verification successful: Market $MARKET_ID featured status is now set to $FEATURED"
else
    echo "Verification failed: Market featured status was not updated correctly"
    # Display a more readable version of the market info
    echo "Market Info Summary:"
    echo "$MARKET_INFO" | grep -E "id|featured|question" | sed 's/^[[:space:]]*/  /'
    exit 1
fi
