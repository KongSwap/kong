#!/bin/bash

# Check if a principal ID was provided
if [ -z "$1" ]; then
    echo "Error: Principal ID is required"
    echo "Usage: ./add_admin.sh <principal_id>"
    exit 1
fi

PRINCIPAL_ID=$1

# Add the admin using dfx
echo "Adding admin with principal: $PRINCIPAL_ID"
dfx canister call prediction_markets_backend add_admin "(principal \"$PRINCIPAL_ID\")"

# Check if the principal is now in the admin list
echo "Verifying admin was added..."
dfx canister call prediction_markets_backend get_admin_principals
