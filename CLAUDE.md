# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## KongSwap Svelte Frontend Guide

### Project Overview

KongSwap is a multi-chain DeFi platform built on the Internet Computer Protocol (ICP). The frontend is built with Svelte, while the backend consists of multiple Rust canisters that handle various aspects of the application:

- `kong_backend`: Core DEX functionality (swaps, liquidity, pools)
- `kong_data`: Analytics and data storage
- `kong_faucet`: Token faucet for testing
- Prediction markets: On-chain prediction markets
- Trollbox: Chat functionality

### Development Environment Setup

```bash
# Start the local IC replica
dfx start --clean --background

# Create identities (only needed once)
cd scripts/local
./create_identity.sh

# Deploy all canisters
./deploy_kong.sh

# Deploy test tokens and pools
./deploy_tokens_pools.sh
```

Access the frontend at: http://localhost:4943/?canisterId=[canister-id]

### Authentication System

The authentication system uses a library called `plug-n-play` (PNP) that provides integrations with various authentication methods:

1. Internet Identity (II)
2. Plug wallet
3. NFID
4. Oisy
5. Phantom SIWS (Sign-In With Solana)
6. Solflare SIWS
7. WalletConnect SIWS

The implementation is in `src/lib/stores/auth.ts` and configuration in `src/lib/config/auth.config.ts`.

#### Authentication Flow

1. User selects a wallet provider
2. The PNP library handles the authentication process
3. Upon successful authentication, a principal ID is obtained
4. The principal is used for all canister interactions
5. User tokens and balances are automatically loaded on authentication

```typescript
// Example of connecting a wallet
import { auth, connectWallet } from "$lib/stores/auth";

// Connect a wallet
await connectWallet("plug");

// Disconnect the wallet
await auth.disconnect();
```

### Canister Interaction

#### Creating Actors

Actors are the primary way to interact with canisters (smart contracts) on the Internet Computer.

1. **Authenticated Actors**: Used when the user must be authenticated.

```typescript
// Example: Getting an authenticated actor
const actor = auth.pnp.getActor({
  canisterId: canisters.kongBackend.canisterId,
  idl: canisters.kongBackend.idl,
  anon: false,
  requiresSigning: true, // If the canister requires signature verification
});

// Make calls
const result = await actor.someMethod();
```

2. **Anonymous Actors**: Used for public read-only methods.

```typescript
// Example: Creating an anonymous actor
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";

const actor = createAnonymousActorHelper(
  canisterId,
  idlFactory
);

// Make calls
const result = await actor.someMethod();
```

#### Adding a New Canister

To add a new canister to the frontend:

1. Generate canister declarations using dfx:

```bash
dfx generate [canister_name]
```

2. Add the canister to `src/lib/config/auth.config.ts`:

```typescript
// Import the declarations
import { idlFactory as myCanisterIDL, canisterId as myCanisterId } from "../../../../declarations/my_canister";
import type { _SERVICE as _MY_CANISTER_SERVICE } from '../../../../declarations/my_canister/my_canister.did.d.ts';

// Add to CanisterType
export type CanisterType = {
  // ... existing canisters
  MY_CANISTER: _MY_CANISTER_SERVICE;
}

// Add to canisters object
export const canisters: CanisterConfigs = {
  // ... existing canisters
  myCanister: {
    canisterId: myCanisterId,
    idl: myCanisterIDL,
    type: {} as CanisterType['MY_CANISTER'],
  },
}
```

3. Create API methods in a dedicated file (e.g., `src/lib/api/myCanister.ts`):

```typescript
import { auth } from '$lib/stores/auth';
import { canisters } from '$lib/config/auth.config';
import type { CanisterType } from '$lib/config/auth.config';

export const fetchSomeData = async () => {
  const actor = auth.pnp.getActor<CanisterType['MY_CANISTER']>({
    canisterId: canisters.myCanister.canisterId,
    idl: canisters.myCanister.idl,
    anon: true, // Set to false if authentication is required
  });
  
  return await actor.someMethod();
};
```

### State Management with Stores

KongSwap uses Svelte stores for state management:

1. **Authentication Store**: `src/lib/stores/auth.ts`
2. **Tokens Store**: `src/lib/stores/tokenStore.ts` and `src/lib/stores/userTokens.ts`
3. **Balances Store**: `src/lib/stores/balancesStore.ts`
4. **Pools Store**: `src/lib/stores/poolStore.ts`
5. **Swap Store**: `src/lib/stores/swapStore.ts`
6. **UI State Stores**: Modal, notifications, sidebar, theme, etc.

Example of using stores:

```typescript
// In a component
import { tokenStore } from '$lib/stores/tokenStore';
import { onMount } from 'svelte';
import { get } from 'svelte/store';

onMount(async () => {
  // Get current value
  const tokens = get(tokenStore);
  
  // Subscribe to changes
  const unsubscribe = tokenStore.subscribe((value) => {
    // Do something with updated tokens
  });
  
  return unsubscribe; // Clean up subscription
});
```

### Helper Functions and Utilities

KongSwap provides various helper utilities:

1. **Actor Utils**: `src/lib/utils/actorUtils.ts` - For creating actors
2. **Number Formatting**: `src/lib/utils/numberFormatters.ts` - For formatting currencies and numbers
3. **Date Formatting**: `src/lib/utils/dateFormatters.ts`
4. **Analytics**: `src/lib/utils/analytics.ts` - For tracking events
5. **Local Storage**: `src/lib/config/localForage.config.ts` - For persistent storage

### Adding a New Page or Feature

1. **Create a new route**: Add a new directory in `src/routes/(app)/my-feature/`
2. **Create a page component**: Add `+page.svelte` in the new directory
3. **Add data loading** (if needed): Add `+page.ts` for data loading
4. **Add to navigation**: Update the navigation component to include the new route

### API Structure

KongSwap uses a combination of:

1. **Direct canister calls**: For real-time data and transactions
2. **REST API calls**: For indexed data from a backend service

The API clients are structured as follows:

- `src/lib/api/base/ApiClient.ts`: Base client for REST API calls
- `src/lib/api/tokens/TokenApiClient.ts`: Token-specific API methods
- `src/lib/api/pools.ts`: Pool-related API methods
- `src/lib/api/transactions.ts`: Transaction history methods

### Common Development Tasks

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run check

# Format code
npm run format
```

### Debugging Tips

1. Use the Svelte DevTools browser extension
2. Check the browser console for errors
3. Use `console.log` with store values to debug state issues
4. Use the IC Dashboard to inspect canister calls
5. Use the PNP debug mode by setting `debug: true` in the config

### Resources

- [Svelte Documentation](https://svelte.dev/docs)
- [Internet Computer Documentation](https://internetcomputer.org/docs/current/developer-docs/)
- [Dfinity CDK (dfx) Documentation](https://internetcomputer.org/docs/current/references/cli-reference/dfx-commands)