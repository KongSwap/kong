# Swap Service Architecture Analysis

## Current Architecture

```
┌─────────────────────┐
│   Swap Component    │
│  (Swap.svelte)      │
└──────────┬──────────┘
           │ Uses
           ├─────────────────┬────────────────┬──────────────────┐
           │                 │                │                  │
           ▼                 ▼                ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────────┐
│ SwapStateService │ │ SwapService  │ │SwapButtonSvc   │ │ SwapLogicService │
│ (Store + Logic)  │ │ (Core Logic) │ │(UI Logic)      │ │ (Event Handlers) │
└──────────────────┘ └──────────────┘ └────────────────┘ └──────────────────┘
           │                 │                                      │
           │                 ├──────────────────────────────────────┤
           │                 ▼                                      │
           │         ┌──────────────┐                              │
           │         │ SwapMonitor  │ ◄────────────────────────────┘
           │         │ (Tx Monitor) │
           │         └──────────────┘
           │
           ▼
┌──────────────────┐
│useSwapQuote Hook │
│ (Quote Updates)  │
└──────────────────┘
```

## Service Analysis

### 1. **SwapService** (Core Business Logic)
**Primary Responsibility**: Core swap execution, quote fetching, and data conversion
**Key Methods**:
- `swap_amounts()` - Get quotes from backend
- `getSwapQuote()` - Get formatted quote with fees
- `executeSwap()` - Execute complete swap flow
- `toBigInt()` / `fromBigInt()` - Number conversions

**Dependencies**: 
- Backend actors (`swapActor`)
- `IcrcService` for token transfers
- `SwapMonitor` for transaction monitoring

### 2. **SwapStateService** (State Management)
**Primary Responsibility**: Managing swap UI state and derived values
**Key Features**:
- Writable store for swap state
- Derived store for balance checking
- Methods to update state (setPayAmount, setReceiveToken, etc.)
- Token initialization logic

**Dependencies**:
- `SwapService` for quote fetching (circular dependency!)
- Various stores (balances, pools)

### 3. **SwapButtonService** (UI Logic)
**Primary Responsibility**: Button text and state logic
**Key Methods**:
- `getButtonText()` - Determine button label
- `isButtonDisabled()` - Determine button state

**Dependencies**: None (pure functions)

### 4. **SwapLogicService** (Event Handlers)
**Primary Responsibility**: Event handling and orchestration
**Key Methods**:
- `handleSwapSuccess()` - Post-swap cleanup
- `handleSelectToken()` - Token selection logic
- `executeSwap()` - Wraps SwapService.executeSwap

**Dependencies**:
- `SwapService` for execution
- `SwapStateService` for state updates
- `SwapMonitor` for monitoring

### 5. **SwapMonitor** (Transaction Monitoring)
**Primary Responsibility**: Poll backend for transaction status
**Key Features**:
- Fast polling (100ms intervals)
- Status updates via toasts
- Balance refresh on completion

**Dependencies**:
- `SwapService` for status requests
- Various stores for updates

### 6. **SwapQuoteService** (Quote Updates)
**Primary Responsibility**: Quote update logic
**Note**: This service appears to be unused - its logic is duplicated in `useSwapQuote` hook

**Dependencies**:
- `SwapService` for quotes
- `SwapStateService` for state

## Identified Issues

### 1. **Circular Dependencies**
- `SwapStateService` depends on `SwapService` (in `setPayAmount()`)
- This creates tight coupling and makes testing difficult

### 2. **Redundant Services**
- `SwapQuoteService` is completely unused
- `SwapLogicService.executeSwap()` is a thin wrapper around `SwapService.executeSwap()`
- `SwapButtonService` could be simple utility functions

### 3. **Overlapping Responsibilities**
- Quote fetching logic exists in:
  - `SwapService.getSwapQuote()`
  - `SwapStateService.setPayAmount()`
  - `useSwapQuote` hook
  - `SwapQuoteService` (unused)

### 4. **Inconsistent Patterns**
- Some services are classes with static methods
- Some are just collections of functions
- State management mixed with business logic

## Simplification Recommendations

### 1. **Merge SwapService and SwapLogicService**
These two services have overlapping responsibilities. Merge them into a single `SwapService`:
```typescript
// SwapService.ts - Combined core logic
class SwapService {
  // From current SwapService
  static async getQuote() { }
  static async executeSwap() { }
  static toBigInt() { }
  static fromBigInt() { }
  
  // From SwapLogicService
  static handleTokenSelection() { }
  static handleSwapSuccess() { }
}
```

### 2. **Remove SwapQuoteService**
This service is completely unused. Delete it.

### 3. **Convert SwapButtonService to Utils**
These are pure functions that don't need a service:
```typescript
// utils/swapButtonUtils.ts
export function getSwapButtonText() { }
export function isSwapButtonDisabled() { }
```

### 4. **Separate State from Business Logic**
Remove the circular dependency by moving quote logic out of SwapStateService:
```typescript
// SwapStateService.ts - Pure state management
const swapState = createSwapStore(); // Just state, no business logic

// In components/hooks
async function updateQuote() {
  const quote = await SwapService.getQuote();
  swapState.update(state => ({ ...state, ...quote }));
}
```

### 5. **Make SwapMonitor Part of SwapService**
Since monitoring is part of the swap flow:
```typescript
// SwapService.ts
class SwapService {
  static async executeSwap() {
    // ... execution logic
    this.monitorTransaction(requestId);
  }
  
  private static monitorTransaction() {
    // Current SwapMonitor logic
  }
}
```

## Proposed Simplified Architecture

```
┌─────────────────────┐
│   Swap Component    │
└──────────┬──────────┘
           │ Uses
           ├────────────────┬─────────────────┐
           ▼                ▼                 ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
│   SwapService    │ │ swapState   │ │   Utils      │
│ - getQuote       │ │ (Pure Store)│ │- buttonText  │
│ - executeSwap    │ └─────────────┘ │- validation  │
│ - monitorTx      │                  └──────────────┘
│ - conversions    │
└──────────────────┘
```

## Implementation Steps

1. **Delete `SwapQuoteService.ts`** - It's unused
2. **Move button logic to `utils/swapButtonUtils.ts`**
3. **Merge `SwapLogicService` into `SwapService`**
4. **Refactor `SwapStateService`** to remove business logic
5. **Integrate `SwapMonitor` into `SwapService`**
6. **Update component imports** and usage

This would reduce 6 services to 2 (SwapService + swapState store) plus some utility functions, making the architecture much cleaner and easier to understand.