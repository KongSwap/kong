#!/bin/bash

# Script for creating a prediction market with support for multiple tokens
# This script demonstrates the multi-token functionality of Kong Swap prediction markets

# Check if all required arguments are provided
if [ "$#" -lt 6 ]; then
    echo "Usage: $0 <question> <category> <rules> <outcome1,outcome2,...> <resolution_method> <duration_or_timestamp> [token_id]"
    echo ""
    echo "Example: $0 \"Will BTC reach 100k by 2025?\" Crypto \"Market resolves YES if BTC reaches \$100,000 on any major exchange before 2025\" \"Yes,No\" Admin 1766822400000000000"
    echo ""
    echo "Parameters:"
    echo "  question: The prediction market question"
    echo "  category: One of: Crypto, Sports, Politics, Memes, Gaming, KongMadness, Other"
    echo "  rules: Rules for market resolution"
    echo "  outcomes: Comma-separated list of possible outcomes (no spaces)"
    echo "  resolution_method: One of: Admin, Oracle, Decentralized"
    echo "  duration_or_timestamp: Either duration in seconds or specific timestamp in nanoseconds"
    echo "  token_id: (Optional) Token canister ID to use (defaults to KONG if not specified)"
    exit 1
fi

QUESTION="$1"
CATEGORY="$2"
RULES="$3"
OUTCOMES="$4"
RESOLUTION_METHOD="$5"
DURATION_OR_TIMESTAMP="$6"
TOKEN_ID="${7:-\"o7oak-iyaaa-aaaaq-aadzq-cai\"}" # Default to KONG if not specified

# Process the category
case "$CATEGORY" in
    "Crypto") CATEGORY_VARIANT="variant { Crypto }" ;;
    "Sports") CATEGORY_VARIANT="variant { Sports }" ;;
    "Politics") CATEGORY_VARIANT="variant { Politics }" ;;
    "Memes") CATEGORY_VARIANT="variant { Memes }" ;;
    "Gaming") CATEGORY_VARIANT="variant { Gaming }" ;;
    "KongMadness") CATEGORY_VARIANT="variant { KongMadness }" ;;
    "Other") CATEGORY_VARIANT="variant { Other }" ;;
    *) echo "Invalid category. Must be one of: Crypto, Sports, Politics, Memes, Gaming, KongMadness, Other"; exit 1 ;;
esac

# Process the resolution method
case "$RESOLUTION_METHOD" in
    "Admin") RESOLUTION_VARIANT="variant { Admin }" ;;
    "Oracle") RESOLUTION_VARIANT="variant { Oracle }" ;;
    "Decentralized") RESOLUTION_VARIANT="variant { Decentralized = record { quorum = 3 : nat } }" ;;
    *) echo "Invalid resolution method. Must be one of: Admin, Oracle, Decentralized"; exit 1 ;;
esac

# Process the duration or timestamp
# Check if it's a timestamp (large number) or duration (smaller number)
if [ "$DURATION_OR_TIMESTAMP" -gt 1000000000000 ]; then
    # It's a timestamp
    TIME_VARIANT="variant { Timestamp = $DURATION_OR_TIMESTAMP : nat64 }"
else
    # It's a duration in seconds
    TIME_VARIANT="variant { Duration = $DURATION_OR_TIMESTAMP : nat64 }"
fi

# Process the outcomes
IFS=',' read -ra OUTCOME_ARRAY <<< "$OUTCOMES"
OUTCOME_VEC=""
for outcome in "${OUTCOME_ARRAY[@]}"; do
    if [ -z "$OUTCOME_VEC" ]; then
        OUTCOME_VEC="\"$outcome\""
    else
        OUTCOME_VEC="$OUTCOME_VEC; \"$outcome\""
    fi
done

# Determine which token we're using
if [ "$TOKEN_ID" = "\"o7oak-iyaaa-aaaaq-aadzq-cai\"" ]; then
    TOKEN_NAME="KONG"
elif [ "$TOKEN_ID" = "\"ryjl3-tyaaa-aaaaa-aaaba-cai\"" ]; then
    TOKEN_NAME="ICP"
else
    TOKEN_NAME="Custom Token"
fi

echo "Creating market with $TOKEN_NAME tokens..."
echo "Question: $QUESTION"
echo "Category: $CATEGORY"
echo "Outcomes: $OUTCOMES"
echo "Resolution method: $RESOLUTION_METHOD"

# Create the market
MARKET_ID=$(dfx canister call prediction_markets_backend create_market "(
  \"$QUESTION\",
  $CATEGORY_VARIANT,
  \"$RULES\",
  vec { $OUTCOME_VEC },
  $RESOLUTION_VARIANT,
  $TIME_VARIANT,
  null,
  null,
  null,
  opt $TOKEN_ID
)" | grep -oP '\(\s*\K[0-9]+(?=\s*:\s*nat\s*\))')

echo "Created market with ID: $MARKET_ID"
echo "To place a bet on this market with $TOKEN_NAME tokens, use:"
echo "./place_bet.sh $MARKET_ID <outcome_index> <amount> $TOKEN_ID"
