```markdown:scripts/launchpad/readme.md
# Token Mining Launchpad 🚀

## Overview
This launchpad provides a complete framework for deploying and managing a token mining ecosystem on the Internet Computer. Includes:
- ICRC-1 compliant token ledger
- Customizable mining canisters
- Automated deployment scripts
- Economic simulation tools

## Getting Started

### Basic Deployment (1 Miner)
```bash
# Start local replica and deploy core components and 1 miner
sh scripts/launchpad/get_latest_wasms.sh
sh scripts/launchpad/start.sh 1
```

This will:
1. Deploy token backend with ICRC-1/2/3 ledger
2. Launch 1 mining canister
3. Connect miner to token backend
4. Start mining process

### Access Interfaces
- **Token info**: `dfx canister call token_backend get_info`
- **Miner info**: `dfx canister call miner get_info`
- **Supply info**: `dfx canister call token_backend get_metrics`
- **Mining Leaderboard**: `dfx canister call token_backend get_miner_leaderboard`
- **Event Hashing**: Since our ledger is ICRC-1/2/3 we don't hash token transactions, but rather we hash changes, so called "Events". This paves the way for future features like letting the token_backend store NFTs or other data types in its blocks for proof of work.
- **Recent Events**: `dfx canister call token_backend get_recent_events`

## Miner Scaling ⚡

To scale miners:
```bash
# Deploy 3 miners (u need to have miner, miner1, miner2 in dfx.json)
sh scripts/launchpad/start.sh 3
```

> **Note**: Hashrate scales somewhat linearly at the system level while individual miner rates decrease proportionally. Total network capacity remains constant or something in replica enviroment.

## Scripts Overview

### Economic Tools
```bash
# Check miner balances
sh scripts/miner_ledger_balance.sh be2us-64aaa-aaaaa-qaabq-cai miner

# Simulate mining economics
sh scripts/launchpad/calculator.sh
```

## Architecture

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

Flow:***
1. Miner requests block template from token_backend
2. Miner performs proof-of-work calculations
3. If solution found, miner submits to token_backend
4. Token backend validates and transfers block reward to miner

## Troubleshooting

### Issues
- **to be identified*****
