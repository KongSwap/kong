# 🦍 KongSwap

Welcome to the KongSwap project. This document will guide you through setting up and running the project locally.

## 📚 Table of Contents

- [🦍 KongSwap](#-kongswap)
  - [📚 Table of Contents](#-table-of-contents)
  - [📁 Project Directory Structure](#-project-directory-structure)
  - [✅ Requirements](#-requirements)
  - [🚀 Running the Project Locally](#-running-the-project-locally)
    - [1. Start the Replica](#1-start-the-replica)
    - [2. Create User Identities](#2-create-user-identities)
    - [3. Deploy Canisters](#3-deploy-canisters)
    - [4. Add Tokens and Liquidity Pools](#4-add-tokens-and-liquidity-pools)
  - [🔗 Accessing the Frontend](#-accessing-the-frontend)
  - [🎉 Conclusion](#-conclusion)
  - [🐛 Troubleshooting](#-troubleshooting)
    - [Resetting the Project](#resetting-the-project)
    - [❌ Couldn't load Cargo.lock](#-couldnt-load-cargolock)

## 📁 Project Directory Structure

To get started, explore the project directory structure to familiarize yourself with the components and scripts available.

## ✅ Requirements

Ensure you have the following installed on your development environment:

1. **Operating System**: Linux/MacOS (e.g., Ubuntu 24.04.01)
2. **Rust/Cargo**: Version 1.80.1
3. **Node.js/npm**: Node v22.9.0, npm 10.8.3
4. **Dfinity CDK (dfx)**: Version 0.24.0
5. **jq**: Command-line JSON processor

## 🚀 Running the Project Locally

Follow these steps to set up and run the project:

### 1. Start the Replica

Start the Internet Computer replica in the background. Use the `--clean` option to start from scratch, but note that this will erase all existing data.

```bash
# Start the replica
dfx start --clean --background
```

> **Note**: You may need to stop any running replicas first using `dfx stop` or `dfx killall`.

### 2. Create User Identities

**_This step only needs to be done once._**

Create user identities for the project.

```bash
# Navigate to the scripts directory
cd scripts/local

# Run the identity creation script
./create_identity.sh
```

> **Tip**: Use `dfx identity list` to view the list of created users.

### 3. Deploy Canisters

Compile and deploy your canisters locally. This process may take some time.

```bash
# Deploy canisters
don
```

If successful, you will see URLs for accessing the frontend and backend canisters.

### 4. Add Tokens and Liquidity Pools

The system is initially empty. You need to add tokens and liquidity pools. Modify the `deploy_tokens_pools.sh` script to adjust settings like amounts and prices.

```bash
# Deploy tokens and pools
./deploy_tokens_pools.sh
```

## 🔗 Accessing the Frontend

Once everything is deployed and running, access the frontend at:

```
http://edoy4-liaaa-aaaar-qakha-cai.localhost:4943/
```

## 🎉 Conclusion

After completing these steps, KongSwap should be fully operational. For further customization or troubleshooting, refer to the scripts and documentation within the project directory.

## 🐛 Troubleshooting

### Resetting the Project

If you encounter issues or need to reset the project, follow these steps:

1. Stop the replica:
   ```bash
   dfx stop
   dfx killall
   ```
2. Remove the `.dfx` and `node_modules` folders:
   ```bash
   rm -rf .dfx
   rm -rf node_modules
3. Clean the Cargo cache:
   ```bash
   cargo clean
   ```
4. Start the replica again:
   ```bash
   dfx start --clean --background
   ```
5. Deploy the canisters again:
   ```bash
   ./deploy_kong.sh
   ```

### ❌ Couldn't load Cargo.lock

Run `cargo uninstall cargo-audit` and try again.
