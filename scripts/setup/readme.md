# Setup Scripts

This directory contains scripts to simplify the setup and running of various components.

## Available Scripts

| Script | Description |
|--------|-------------|
| `scripts/setup/local_dex.sh` | Runs Kong backend locally and runs the API locally |

## Usage

Choose the appropriate script for your needs and run it from the project root directory.

### Running a Local DEX Environment

To set up a complete local DEX environment with both the backend canister and API server:

```bash
# From the project root directory
./scripts/setup/local_dex.sh
```

This script will:
1. Start a local Internet Computer (dfx) instance
2. Deploy the Kong backend canister
3. Deploy token ledgers (ksICP, ksUSDT, ksBTC)
4. Create pools
5. Set up PostgreSQL and Redis for the API
6. Initialize the API database and run migrations
7. Start the API server

Once the script completes, you'll have:
- A running Kong DEX backend
- Token ledgers and liquidity pools
- A running API server that can be tested with GeckoTerminal endpoints

To test the API with GeckoTerminal endpoints:
```bash
cd apis/scripts && ./test_geckoterminal.sh
```

To shut down the environment:
1. Kill the API server process
2. Stop dfx
3. Stop Docker containers

## API Submodule Setup

The KONG APIs are included as a Git submodule. For developers with access to the private repository:

```bash
# After cloning the main repo
git submodule init
git submodule update
```

This will populate the `apis/` directory with the API code.

Note: Developers without access to the private KongSwap/apis repository will see an empty directory and will get permission errors when trying to initialize the submodule.

### Submodule Maintenance
To update the API submodule to the latest version:

When you navigate to the API submodule directory, you'll be working with the API's git repository. From there, you can use standard git commands to update it:
```bash
cd apis
git pull origin main
cd ..
git add apis
git commit -m "Update API submodule"
```