#!/bin/bash

# Script to run PocketIC tests for prediction markets backend

set -e  # Exit immediately if a command exits with a non-zero status

# Navigate to the kong project root
cd "$(dirname "$0")/../../.."
PROJECT_ROOT=$(pwd)
echo "Project root: $PROJECT_ROOT"

# 1. Build the canister (if needed)
echo "Building prediction_markets_backend canister..."
dfx build prediction_markets_backend

# 2. Run the integration tests
echo "Running the PocketIC integration tests..."
cd "$PROJECT_ROOT/src/prediction_markets_backend"

# Define color codes for better readability
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m" # No Color

# Check if a specific test module was specified
if [ "$1" == "" ]; then
    # Run all tests with nocapture to show detailed output
    echo -e "${YELLOW}Running all PocketIC tests with detailed output...${NC}"
    cargo test -- --nocapture
    echo -e "${GREEN}All tests completed!${NC}"
else
    # Run a specific test module or test with nocapture
    echo -e "${YELLOW}Running specific test: $1 with detailed output...${NC}"
    cargo test "$1" -- --nocapture
    echo -e "${GREEN}Test completed!${NC}"
fi

# Usage examples:
# ./run_pocketic_tests.sh                      # Run all tests
# ./run_pocketic_tests.sh admin                # Run all admin tests
# ./run_pocketic_tests.sh admin::authentication_tests  # Run specific admin test module

# If you have a local PocketIC binary, set the environment variable:
# POCKET_IC_BIN=/path/to/pocket-ic ./run_pocketic_tests.sh
