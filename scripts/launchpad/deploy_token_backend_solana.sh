#!/bin/bash

# Get the directory of the script
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src_dir="$(dirname "$script_dir")/src"

cargo build -p token_backend_solana -r
candid-extractor "target/wasm32-unknown-unknown/release/token_backend_solana.wasm" >"$src_dir/token_backend_solana/token_backend_solana.did"
dfx generate token_backend_solana

cargo build -p token_backend_solana -r
candid-extractor "target/wasm32-unknown-unknown/release/token_backend_solana.wasm" >"$src_dir/token_backend_solana/token_backend_solana.did"
dfx generate token_backend_solana

# Check if deployment should be skipped
if [ "$1" != "no" ]; then
    # Deploy token backend canister
    echo "Deploying token_backend_solana canister..."
    dfx deploy token_backend_solana --network=ic
    # dfx deploy token_backend_solana --network=ic --mode=reinstall
else
    echo "Skipping deployment as requested..."
fi
cargo build -p token_backend_solana -r
candid-extractor "target/wasm32-unknown-unknown/release/token_backend_solana.wasm" >"$src_dir/token_backend_solana/token_backend_solana.did"
dfx generate token_backend_solana

# Get and display the public key
echo "Getting public key..."
PUBLIC_KEY=$(dfx canister call token_backend_solana get_public_key --network=ic | tr -d '"')
echo "Public Key: $PUBLIC_KEY"

# Get and display account balance
echo "Getting account balance..."
# dfx canister call token_backend_solana get_account_balance --network=ic "(\"6KNxycXQgVVMR3RNNqZFktB6XU2Q1eM1qYj1msY7rqNL\")"

# Print completion message
echo "Deployment and setup complete!"
