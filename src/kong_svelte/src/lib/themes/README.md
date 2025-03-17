# Kong Theme System

This folder contains the modular theme system for Kong Svelte. It provides a flexible way to define, manage, and apply themes throughout the application.

## Theme Structure

The theme system consists of several key components:

1. **Base Theme Definition**: Defines the TypeScript interface and default values for themes.
2. **Theme Registry**: Central place to register and retrieve themes.
3. **Individual Theme Files**: Separate files for each theme, making it easy to add new ones.
4. **Theme Store**: Svelte store that handles theme persistence and application.
5. **Theme Creator Component**: UI for creating and applying custom themes.

## How to Use Themes

### Applying a Theme

To apply a theme programmatically:

```typescript
import { themeStore } from '$lib/stores/themeStore';

// Apply an existing theme
themeStore.setTheme('light');
themeStore.setTheme('dark');
themeStore.setTheme('plain-black');
themeStore.setTheme('nord');

// Toggle through themes (cycles: light → dark → plain-black → light)
themeStore.toggleTheme();
```

### Creating a New Theme

#### Option 1: Define a Theme Programmatically

1. Create a new file in the `themes` folder (e.g., `myTheme.ts`):

```typescript
import type { ThemeDefinition } from './baseTheme';

export const myTheme: ThemeDefinition = {
  id: 'my-theme',
  name: 'My Custom Theme',
  colorScheme: 'dark light', // or 'light dark'
  colors: {
    // Define all color values...
    bgDark: '#1A1A1A',
    bgLight: '#2A2A2A',
    // ...and other required properties
  }
};
```

2. Register the theme in `themeRegistry.ts`:

```typescript
import { myTheme } from './myTheme';

// Add to the themes array
const themes: ThemeDefinition[] = [
  // ...existing themes
  myTheme
];
```

3. Update the `ThemeId` type in `themeStore.ts`:

```typescript
export type ThemeId = 'dark' | 'light' | 'plain-black' | 'nord' | 'my-theme';
```

#### Option 2: Use the Theme Creator Component

Add the `ThemeCreator` component to any page to allow users to create custom themes through a UI:

```svelte
<script>
  import ThemeCreator from '$lib/components/ThemeCreator.svelte';
</script>

<ThemeCreator />
```

#### Option 3: Register a Theme at Runtime

```typescript
import { themeStore } from '$lib/stores/themeStore';

const myDynamicTheme = {
  id: 'runtime-theme',
  name: 'Runtime Created Theme',
  colorScheme: 'dark light',
  colors: {
    // ... all required colors
  }
};

themeStore.registerAndApplyTheme(myDynamicTheme);
```

## Available Themes

The system comes with several pre-defined themes:

1. **Dark Theme (default)**: Modern dark theme with Kong's brand colors
2. **Light Theme**: Windows 98-inspired light theme
3. **Plain Black Theme**: Pure black background for OLED screens
4. **Nord Theme**: Cool blue theme based on the Nord color palette

## Theme Color Properties

A theme consists of the following color properties:

- Background colors (`bgDark`, `bgLight`, `hoverBgLight`)
- Primary/secondary colors (`primary`, `primaryHover`, `secondary`, `secondaryHover`)
- Accent colors for various UI elements
- Text colors for different states
- Border colors
- Surface colors for layering components
- Logo display properties
- Plugin Manager specific colors

See the `ThemeColors` interface in `baseTheme.ts` for the complete list of required properties.

## How It Works

1. The theme store loads the user's saved theme preference from localStorage
2. It applies the theme by adding CSS classes to the root element
3. Theme-specific CSS variables are dynamically generated and applied
4. Tailwind CSS uses these variables via the `kong-*` color utilities

This approach allows for seamless theme switching without page reloads. 