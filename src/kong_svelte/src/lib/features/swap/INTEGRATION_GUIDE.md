# Integration Guide for New Swap Architecture

## Quick Start

To integrate the new swap architecture, follow these steps:

### 1. Install Dependencies

```bash
npm install
```

This will install the new dependencies:
- `@xstate/fsm` - State machine implementation
- `zod` - Runtime validation

### 2. Update Routes

Replace the old Swap component with the new SwapContainer:

```svelte
<!-- src/routes/(app)/swap/+page.svelte -->
<script lang="ts">
  // OLD
  // import Swap from '$lib/components/swap/Swap.svelte';
  
  // NEW
  import SwapContainer from '$lib/features/swap/components/SwapContainer.svelte';
</script>

<!-- OLD -->
<!-- <Swap /> -->

<!-- NEW -->
<SwapContainer />
```

### 3. Update Imports

If you're importing swap-related utilities elsewhere:

```typescript
// OLD
import { SwapService } from '$lib/services/swap/SwapService';

// NEW
import { SwapOrchestrator } from '$lib/features/swap/services/SwapOrchestrator';
```

### 4. Type Updates

The new architecture uses `SwapToken` which extends `Kong.Token`:

```typescript
// All Kong.Token properties are available
const token: SwapToken = {
  id: 1,
  name: "Internet Computer",
  symbol: "ICP",
  address: "ryjl3-tyaaa-aaaaa-aaaba-cai",
  // ... all other Kong.Token properties
};
```

## Migration Checklist

- [ ] Run `npm install` to install new dependencies
- [ ] Update swap route to use `SwapContainer`
- [ ] Update any direct imports of swap services
- [ ] Test swap functionality thoroughly
- [ ] Remove old swap components once migration is complete

## Feature Comparison

| Feature | Old Architecture | New Architecture |
|---------|-----------------|------------------|
| State Management | Multiple stores | Single state machine |
| Error Handling | Inline try-catch | Error boundary + orchestrator |
| Validation | Scattered | Centralized SwapValidator |
| Component Size | 600+ lines | <200 lines each |
| Type Safety | Partial | Full coverage |
| Testing | Difficult | Easy with isolated services |

## Gradual Migration

You can run both architectures side-by-side using feature flags:

```svelte
<script>
  import { featureFlags } from '$lib/stores/featureFlags';
  import OldSwap from '$lib/components/swap/Swap.svelte';
  import SwapContainer from '$lib/features/swap/components/SwapContainer.svelte';
</script>

{#if $featureFlags.newSwapArchitecture}
  <SwapContainer />
{:else}
  <OldSwap />
{/if}
```

## API Compatibility

The new architecture maintains compatibility with existing backend APIs:
- Same swap endpoints
- Same token structure
- Same wallet integration

## Support

For issues or questions:
1. Check the error logs in the browser console
2. Verify all dependencies are installed
3. Ensure TypeScript compilation succeeds
4. Review the architecture document for detailed explanations