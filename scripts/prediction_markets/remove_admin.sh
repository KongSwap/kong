#!/bin/bash

# Check if a principal ID was provided
if [ -z "$1" ]; then
    echo "Error: Principal ID is required"
    echo "Usage: ./remove_admin.sh <principal_id>"
    exit 1
fi

PRINCIPAL_ID=$1

# Remove the admin using dfx
echo "Removing admin with principal: $PRINCIPAL_ID"
dfx canister call prediction_markets_backend remove_admin "(principal \"$PRINCIPAL_ID\")"

# Check if the principal was removed from the admin list
echo "Verifying admin was removed..."
dfx canister call prediction_markets_backend get_admin_principals
