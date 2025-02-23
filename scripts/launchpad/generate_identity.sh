#!/bin/bash

# Get the current identity
CURRENT_IDENTITY=$(dfx identity whoami)
echo "Current identity: $CURRENT_IDENTITY"

# Create the directory if it doesn't exist
mkdir -p src/launchpad_backend/tests

# Export the identity to the correct location
dfx identity export "$CURRENT_IDENTITY" > src/launchpad_backend/tests/identity.pem

# Set correct permissions
chmod 600 src/launchpad_backend/tests/identity.pem

echo "Generated identity.pem in src/launchpad_backend/tests/"
ls -l src/launchpad_backend/tests/identity.pem
