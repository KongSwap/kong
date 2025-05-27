# Kong Swap Theme System

A simplified, maintainable theme system for Kong Swap with clear structure and easy customization.

## Overview

The theme system has been redesigned to be:
- **Simpler** - Fewer, more logical properties
- **Type-safe** - Full TypeScript support
- **Maintainable** - Clear organization and defaults
- **Flexible** - Easy to create new themes
- **Performant** - Efficient CSS generation

## Theme Structure

### Core Components

1. **Palette** - Essential colors organized by purpose
2. **Styles** - Visual properties (fonts, radii, shadows)
3. **Components** - Optional component-specific overrides
4. **Background** - Background configuration and effects
5. **Logo** - Logo appearance settings

### Color Palette

The palette is organized into logical groups:

```typescript
palette: {
  background: {
    primary: string,    // Main background
    secondary: string,  // Elevated surfaces
    tertiary: string    // Higher elevation
  },
  text: {
    primary: string,    // Main text
    secondary: string,  // Muted text
    disabled: string,   // Disabled state
    inverse: string     // Inverted backgrounds
  },
  brand: {
    primary: string,    // Primary brand color
    secondary: string   // Secondary brand color
  },
  semantic: {
    success: string,    // Success states
    error: string,      // Error states
    warning: string,    // Warning states
    info: string        // Info states
  },
  ui: {
    border: string,     // Default borders
    borderLight: string,// Light borders
    focus: string,      // Focus states
    hover: string       // Hover backgrounds
  }
}
```

## Creating a New Theme

### Method 1: Using the Template

1. Copy `template.ts` to a new file
2. Update the theme properties:
   ```typescript
   export const myTheme: Theme = {
     id: 'my-theme',
     name: 'My Theme',
     colorScheme: 'dark',
     palette: {
       // Your colors here
     }
   };
   ```
3. Register the theme:
   ```typescript
   import { registerTheme } from '$lib/themes';
   import { myTheme } from './myTheme';
   
   registerTheme(myTheme);
   ```

### Method 2: Minimal Theme

For a minimal theme, only the palette is required:

```typescript
const minimalTheme: Theme = {
  id: 'minimal',
  name: 'Minimal',
  colorScheme: 'dark',
  palette: {
    background: {
      primary: '#000000',
      secondary: '#111111',
      tertiary: '#222222'
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#AAAAAA',
      disabled: '#666666',
      inverse: '#000000'
    },
    brand: {
      primary: '#0095EB',
      secondary: '#00D68F'
    },
    semantic: {
      success: '#00D68F',
      error: '#FF4545',
      warning: '#FFB800',
      info: '#0095EB'
    },
    ui: {
      border: '#333333',
      borderLight: '#444444',
      focus: '#0095EB',
      hover: '#222222'
    }
  },
  styles: defaultStyles // Use defaults
};
```

## Migrating Old Themes

Use the migration utility to convert old theme formats:

```typescript
import { migrateTheme } from '$lib/themes';
import { oldThemeDefinition } from './oldTheme';

const newTheme = migrateTheme(oldThemeDefinition);
registerTheme(newTheme);
```

## CSS Variable Mapping

The theme system generates CSS variables automatically:

| Theme Property | CSS Variable | Example Usage |
|----------------|--------------|---------------|
| `palette.background.primary` | `--bg-primary` | `bg-kong-bg-primary` |
| `palette.text.primary` | `--text-primary` | `text-kong-text-primary` |
| `palette.brand.primary` | `--brand-primary` | `text-kong-primary` |
| `palette.semantic.success` | `--semantic-success` | `text-kong-success` |
| `palette.ui.border` | `--ui-border` | `border-kong-border` |

## Component Customization

Customize specific components without affecting the global palette:

```typescript
components: {
  button: {
    primary: {
      background: '#0095EB',
      color: '#FFFFFF',
      hoverBackground: '#0077C5',
      border: 'none',
      shadow: 'shadow-md'
    }
  },
  panel: {
    swap: {
      transparent: true,
      border: '1px solid rgba(255,255,255,0.1)',
      radius: 'rounded-xl'
    }
  }
}
```

## Utility Functions

### Color Manipulation

```typescript
import { lighten, darken, withOpacity } from '$lib/themes';

// Lighten a color by 10%
const lighter = lighten('#0095EB', 0.1);

// Darken a color by 20%
const darker = darken('#0095EB', 0.2);

// Add opacity to a color
const transparent = withOpacity('#0095EB', 0.5);
```

### Theme Application

```typescript
import { applyTheme, getTheme } from '$lib/themes';

// Apply a theme by ID
const theme = getTheme('dark');
if (theme) {
  applyTheme(theme);
}
```

## Best Practices

1. **Color Contrast**: Ensure sufficient contrast between text and backgrounds (WCAG AA minimum)
2. **Consistency**: Use the same color ramp increments across your palette
3. **Semantic Naming**: Use semantic colors for states rather than hardcoding
4. **Testing**: Test your theme with all components and states
5. **Documentation**: Document any special considerations for your theme

## File Structure

```
themes/
├── index.ts           # Main exports
├── types.ts           # TypeScript definitions
├── defaults.ts        # Default values and utilities
├── cssGenerator.ts    # CSS generation logic
├── migration.ts       # Migration utilities
├── template.ts        # Theme template
├── presets/          # Built-in themes
│   ├── dark.ts
│   └── light.ts
└── README.md         # This file
```

## Examples

### Gradient Background

```typescript
background: {
  type: 'gradient',
  value: 'linear-gradient(180deg, #000428 0%, #004e92 100%)',
  effects: {
    nebula: true,
    opacity: 0.3
  }
}
```

### Image Background

```typescript
background: {
  type: 'image',
  value: '/backgrounds/space.jpg',
  image: {
    size: 'cover',
    position: 'center',
    repeat: 'no-repeat'
  }
}
```

### Custom Logo

```typescript
logo: {
  brightness: 1.2,
  invert: false,
  customPath: '/logos/custom-logo.svg'
}
```

## Troubleshooting

### Theme not applying?
- Ensure the theme is registered: `registerTheme(myTheme)`
- Check that the theme ID is unique
- Verify CSS variables are being generated in DevTools

### Colors look wrong?
- Colors must be in hex format (#RRGGBB)
- Check color contrast ratios
- Verify the colorScheme matches your intended appearance

### Components not styled?
- Component overrides are optional
- Check that component classes match the theme structure
- Use browser DevTools to inspect applied styles 