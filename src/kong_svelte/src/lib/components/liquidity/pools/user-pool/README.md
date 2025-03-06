# UserPool Component Structure

This directory contains the components that make up the UserPool functionality, which has been refactored from a single large component into multiple smaller, more maintainable components.

## Component Overview

- **UserPoolMain.svelte**: The main container component that coordinates the other components and manages the modal state.
- **PoolOverview.svelte**: Displays the pool overview information, including total value, APY, token holdings, and estimated earnings.
- **AddLiquidity.svelte**: Handles the functionality for adding liquidity to a pool.
- **RemoveLiquidity.svelte**: Handles the functionality for removing liquidity from a pool.
- **TokenInput.svelte**: A reusable component for token input fields with balance display and percentage buttons.

## Component Relationships

```
UserPool.svelte
    └── UserPoolMain.svelte
        ├── PoolOverview.svelte
        ├── AddLiquidity.svelte
        │   └── TokenInput.svelte (used twice, for each token)
        └── RemoveLiquidity.svelte
```

## Benefits of This Structure

1. **Improved Maintainability**: Each component has a single responsibility, making the code easier to understand and maintain.
2. **Better Code Organization**: Related functionality is grouped together in separate files.
3. **Reusable Components**: The TokenInput component can be reused across different parts of the application.
4. **Easier Testing**: Smaller components are easier to test in isolation.
5. **Performance Optimization**: Components can be optimized individually, and only the necessary components are rendered based on the active tab. 