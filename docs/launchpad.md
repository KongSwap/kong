# Kong DEX Launchpad - Local Development Guide

This guide covers how to run the Kong DEX Launchpad locally for development and testing purposes. There are two primary methods available: using the dfx replica or using Pocket IC.

## Prerequisites

Before getting started, ensure you have the following installed:

- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install/) (version 0.24.3 or higher)
- [Node.js](https://nodejs.org/) (version 16 or higher)
- [Rust](https://www.rust-lang.org/tools/install) rustc 1.80.1 (3f5fd8dd4 2024-08-06)
- Wasm target: `rustup target add wasm32-unknown-unknown`
- [ic-wasm](https://github.com/dfinity/ic-wasm): `cargo install ic-wasm`
- [candid-extractor](https://github.com/dfinity/candid): `cargo install candid-extractor`
- [Pocket IC](https://github.com/dfinity/pocketic) (only if using Pocket IC method)

## Initial Setup

## Method 1: Running with DFX Replica

This method uses the standard Internet Computer local development environment provided by DFINITY.

### Option A: Simplified Deployment (Recommended)

The simplest way to deploy the entire system locally is using the provided start script:

```bash
# First get the latest WASMs
bash scripts/launchpad/get_latest_wasms.sh

# Deploy with 1 miner (you can specify more miners as needed)
bash scripts/launchpad/start.sh 1
```

This script will:
1. Stop any running dfx processes
2. Start a clean dfx replica in the background
3. Deploy the token_backend canister
4. Initialize the token with default settings
5. Deploy the specified number of miner canisters
6. Connect each miner to the token_backend
7. Start mining on each miner

### Option B: Manual Deployment (For Advanced Users)

If you need more control over the deployment process, you can manually execute each step:

#### Step 1: Get Latest WASMs

First, fetch and prepare all the necessary WASM files:

```bash
bash scripts/launchpad/get_latest_wasms.sh
```

#### Step 2: Start DFX Replica

Start a local Internet Computer replica:

```bash
dfx start --clean --background
```

#### Step 3: Deploy Token Backend

Create and deploy the token backend:

```bash
# Create the canister
dfx canister create token_backend

# Deploy the canister
dfx deploy token_backend --argument '(record {
  name = "Test Token";
  ticker = "TEST";
  decimals = opt 8;
  total_supply = 10_000_000_000_000_000;
  transfer_fee = opt 10_000;
  initial_block_reward = 1_000_000_000;
  block_time_target_seconds = 10;
  halving_interval = 10_000;
  social_links = opt vec {};
})'

# Initialize the token
dfx canister call token_backend start_token
# dfx canister call token_backend create_genesis_block deprecated
```

#### Step 4: Deploy Miner

Deploy a miner canister and connect it to the token:

```bash
# Create the miner canister
dfx canister create miner

# Deploy the miner with your principal as owner
dfx deploy miner --argument "(record { owner = principal \"$(dfx identity get-principal)\" })"

# Connect the miner to the token backend
dfx canister call miner connect_token "(principal \"$(dfx canister id token_backend)\")"

# Start mining
dfx canister call miner start_mining
```

### Accessing Canister Information

Once deployed, you can check the status of your canisters:

```bash
# Get token info
dfx canister call token_backend get_info

# Get miner info
dfx canister call miner get_info

# Get mining metrics
dfx canister call token_backend get_metrics

# Get miner leaderboard
dfx canister call token_backend get_miner_leaderboard

# Get recent events
dfx canister call token_backend get_recent_events
```

## Method 2: Running with Pocket IC

Pocket IC provides a faster and more lightweight alternative to the dfx replica for local development.

### Step 1: Install Pocket IC

If not already installed:

```bash
cargo install pocketic
```

### Step 2: Get Latest WASMs

Same as with the dfx method:

```bash
bash scripts/launchpad/get_latest_wasms.sh
```

### Step 3: Run Mining Tests

The project includes tests that use Pocket IC to simulate the mining process:

```bash
# Run the mining flow tests with Pocket IC
bash scripts/launchpad/run_mining_tests.sh
```

This script:
1. Uses Pocket IC for canister emulation
2. Creates token and miner canisters in the emulated environment
3. Runs through the entire mining flow
4. Validates the correct functioning of the system

## Scaling Your Test Environment

For testing with multiple miners:

```bash
# Deploy with 3 miners
bash scripts/launchpad/start.sh 3
```

Note that this requires having `miner`, `miner1`, and `miner2` defined in your dfx.json file.

## Troubleshooting Common Issues

### WASM Generation Issues

If you encounter errors with WASM files or declarations:

```bash
# Clear the cache and regenerate
dfx cache delete
bash scripts/launchpad/get_latest_wasms.sh
```

### Missing Declarations

If you see errors about missing declarations:

```bash
# Force regenerate declarations from source candid files
mkdir -p src/token_backend
cp src/token_backend/src/token_backend.did src/token_backend/token_backend.did
dfx generate token_backend

mkdir -p src/miner/src
cp src/miner/src/miner.did src/miner/src/miner.did
dfx generate miner
```

### Checking Miner Balances

To check the balance of a miner:

```bash
bash scripts/miner_ledger_balance.sh <token_ledger_canister_id> <miner_canister_id>
```

Example:
```bash
bash scripts/miner_ledger_balance.sh be2us-64aaa-aaaaa-qaabq-cai miner
```

## Advanced Configuration

### Custom Token Parameters

When deploying the token_backend, you can customize parameters:

```bash
dfx deploy token_backend --argument '(record {
  name = "Your Token";
  ticker = "YTK";
  decimals = opt 8;
  total_supply = 100_000_000_000_000;  # Adjust total supply
  transfer_fee = opt 1_000;            # Adjust fee
  initial_block_reward = 500_000_000;  # Adjust mining reward
  block_time_target_seconds = 30;      # Adjust block time
  halving_interval = 50_000;           # Adjust halving interval
  social_links = opt vec {};
})'
```

### Economic Simulation

To simulate the mining economics:

```bash
bash scripts/launchpad/calculator.sh
```

This tool helps predict token distribution, mining rewards, and other economic parameters based on your configuration.

## Architecture Overview

The system consists of two main components:

### Token Backend
- Implements ICRC-1/2/3 ledger functionality
- Manages block templates and mining rewards
- Validates and processes submitted solutions
- Handles token transfers to successful miners

### Mining Canisters
- Request block templates from token backend
- Perform proof-of-work calculations
- Submit solutions back to token backend
- Receive rewards when valid solutions found

The flow works as follows:
1. Miner requests block template from token_backend
2. Miner performs proof-of-work calculations
3. If solution found, miner submits to token_backend
4. Token backend validates and transfers block reward to miner

## Further Resources

- [Internet Computer Developer Docs](https://internetcomputer.org/docs/current/developer-docs/)
- [Candid Reference](https://internetcomputer.org/docs/current/developer-docs/build/candid/candid-intro)
- [DFX CLI Reference](https://internetcomputer.org/docs/current/references/cli-reference/)
