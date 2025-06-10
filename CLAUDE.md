# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build Commands
```bash
# Build all workspaces (frontend + backend)
npm run build

# Build specific canisters
cargo build --release --target wasm32-unknown-unknown -p kong_backend
./scripts/build_kong_backend.sh  # Builds and gzips the WASM
./scripts/build_kong_data.sh
./scripts/build_kong_faucet.sh

# Frontend build (in src/kong_svelte/)
npm run build
```

### Development Commands
```bash
# Start local replica
dfx start --clean --background

# Deploy locally (first time)
cd scripts/local && ./create_identity.sh  # Only needed once
./deploy_kong.sh
./deploy_tokens_pools.sh

# Frontend development
npm run start  # Starts dev server at localhost:5173

# Access local frontend
# http://edoy4-liaaa-aaaar-qakha-cai.localhost:4943/
```

### Test Commands
```bash
# Rust tests
cargo test -p kong_backend
cargo test -p kong_data
./scripts/test_kong_backend.sh  # Integration tests

# Frontend tests (in src/kong_svelte/)
npm test
npm run test:unit
npm run test:coverage

# Prediction markets tests
./scripts/prediction_markets/01_user_mkt_test.sh
```

### Lint and Format Commands
```bash
# Rust
cargo fmt  # Uses rustfmt.toml (max_width = 140)
cargo clippy

# Frontend (in src/kong_svelte/)
npm run check  # Type checking with svelte-check
npm run format  # Prettier formatting
```

## Architecture

### Core Design Pattern (AMM Transaction Flow)
All major operations (swap, add_liquidity, remove_liquidity) follow this pattern to ensure atomicity and handle race conditions:

1. Error checking
2. Calculate parameters (1st time)
3. Transfer tokens from user → backend (using ICRC2 approve/transfer_from)
4. Re-calculate parameters (2nd time - handles race conditions)
5. Update stable memory atomically
6. Transfer tokens from backend → user
7. Create claims if transfer fails
8. Verify actual vs expected balances

### Canister Architecture
- **kong_backend**: Main AMM canister handling pools, swaps, liquidity
- **kong_data**: Analytics and transaction archival
- **kong_svelte**: Frontend SvelteKit application
- **prediction_markets_backend**: Prediction markets implementation
- **trollbox**: Chat functionality
- **ic_siws_provider**: Solana wallet integration

### Stable Memory Structure
Key data structures using IC's stable memory:
- `StableUser`: User profiles and settings
- `StableToken`: Token metadata (ledger, decimals, fees)
- `StablePool`: Pool state (balances, K constant, fees)
- `StableRequest`: Audit log of all requests
- `StableClaim`: IOUs for failed transfers
- `StableTransfer`: Transfer history
- `StableTx`: Transaction records

### Frontend Architecture (Svelte 5)
- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`)
- TypeScript-first approach
- Tailwind CSS for styling
- Agent-JS for IC communication
- Vite for building

### Token Standards
- Supports ICRC-1 and ICRC-2 tokens
- Custom LP tokens for liquidity providers
- Uses approve/transfer_from pattern for user transfers

### Security Considerations
- Principal-based authentication
- Claims system for handling failed transfers
- Transaction verification and reconciliation
- Admin controls with guard checks

## Development Tips

### Working with Stable Memory
- All stable memory updates are atomic within a single execution block
- Use thread-local storage with `RefCell` for state management
- Always verify transfers with `verify_transfer` after ICRC operations

### Testing Swaps and Liquidity
Use the scripts in `scripts/kong_backend/`:
- `swap_amounts.sh` - Calculate swap amounts
- `swap_approve.sh` - Approve tokens for swap
- `swap_transfer.sh` - Execute swap
- `add_liquidity_amounts.sh` - Calculate liquidity amounts
- `pools.sh` - View all pools

### Frontend Development
When modifying the frontend:
1. Follow Svelte 5 best practices (see `.cursor/rules/svelte-frontend-rules.mdc`)
2. Use TypeScript for all new code
3. Test with both unit tests and manual testing
4. Consider bundle size - use dynamic imports for large components

### Debugging
- Use `scripts/prod/canister_log.sh` to view canister logs
- Check `scripts/staging/canister_status.sh` for canister health
- Use `dfx canister logs kong_backend` for local debugging

### Common Pitfalls
- Always check if tokens are already added before `add_token`
- Remember to approve tokens before transfers
- Pool prices change with each swap - always recalculate
- Failed transfers create claims - users must claim manually
- Use the correct feature flags: `local`, `staging`, or `prod`