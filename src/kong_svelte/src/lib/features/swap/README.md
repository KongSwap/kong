# New Swap Architecture

## Overview

This is the new, improved swap architecture for KongSwap. It features:

- **State Machine**: Predictable state transitions using XState
- **Separation of Concerns**: Business logic in services, UI in components
- **Type Safety**: Full TypeScript coverage
- **Error Boundaries**: Comprehensive error handling
- **Performance**: Built-in caching and optimizations

## Quick Start

### 1. Enable the New Architecture

The new swap is behind a feature flag. To enable it:

**Option A: Use the UI Toggle (Development only)**
- Look for the gear icon in the bottom-right corner
- Toggle "New Swap Architecture"

**Option B: Use Console**
```javascript
// Enable
localStorage.setItem('kongswap-feature-flags', JSON.stringify({ newSwapArchitecture: true }));

// Disable
localStorage.setItem('kongswap-feature-flags', JSON.stringify({ newSwapArchitecture: false }));
```

**Option C: Programmatically**
```typescript
import { featureFlags } from '$lib/stores/featureFlags';

// Enable
featureFlags.enable('newSwapArchitecture');

// Disable
featureFlags.disable('newSwapArchitecture');
```

### 2. Architecture Components

```
features/swap/
├── components/           # UI Components
│   ├── SwapContainer.svelte      # Main container
│   ├── SwapForm/                 # Form components
│   ├── SwapSummary/              # Summary components
│   └── Modals                    # Confirmation, success modals
├── services/            # Business Logic
│   ├── SwapOrchestrator.ts      # Coordinates swap operations
│   ├── SwapValidator.ts         # Input validation
│   └── SwapStateMachine.ts      # State management
├── hooks/               # Custom Hooks
│   └── useSwapForm.svelte.ts    # Form state management
└── types/               # TypeScript Types
    └── swap.types.ts            # All swap-related types
```

## Key Differences from Legacy

### State Management
- **Old**: Multiple stores with complex interactions
- **New**: Single state machine with clear transitions

### Error Handling
- **Old**: Scattered try-catch blocks
- **New**: Centralized error boundary + orchestrator

### Component Size
- **Old**: 600+ line monolithic component
- **New**: <200 lines per component

### Validation
- **Old**: Inline validation throughout
- **New**: Centralized SwapValidator with Zod schemas

## Development

### Running Tests
```bash
npm test
```

### Debugging
The new architecture includes comprehensive logging:
- State transitions are logged
- All errors are caught and logged
- Performance metrics available in console

### Adding Features
1. Update types in `swap.types.ts`
2. Add validation rules in `SwapValidator.ts`
3. Update state machine if needed
4. Implement UI changes in components

## Migration Path

1. **Phase 1**: Both architectures run side-by-side (current)
2. **Phase 2**: Gradual rollout to users
3. **Phase 3**: Remove legacy code

## Performance Improvements

- Quote caching (30s TTL)
- Debounced quote fetching
- Optimized re-renders
- Parallel API calls

## Known Issues

- Feature flag requires page refresh to take effect
- Some theme-specific styles may need adjustment

## Contributing

When contributing to the new swap:
1. Follow the established patterns
2. Keep components small and focused
3. Add tests for new services
4. Update types as needed