# Theme System Migration Guide

This guide helps you migrate from the old theme system to the new simplified theme structure.

## Color Class Mapping

### Text Colors

| Old Class | New Class | Notes |
|-----------|-----------|-------|
| `text-kong-success` | `text-kong-success` | Uses semantic color |
| `text-kong-accent-green` | `text-kong-success` | Uses semantic color |
| `text-kong-error` | `text-kong-error` | Uses semantic color |
| `text-kong-accent-red` | `text-kong-error` | Uses semantic color |
| `text-kong-text-accent-blue` | `text-kong-info` | Uses semantic color |
| `text-kong-accent-blue` | `text-kong-info` | Uses semantic color |
| `text-kong-accent-yellow` | `text-kong-warning` | Uses semantic color |
| `text-kong-primary` | `text-kong-primary` | Use brand primary |
| `text-kong-accent-cyan` | `text-kong-secondary` | Use brand secondary |
| `text-kong-text-on-primary` | `text-kong-text-inverse` | Text on colored backgrounds |
| `text-kong-text-light` | `text-kong-text-inverse` | Light text variant |
| `text-kong-text-dark` | `text-kong-text-primary` | Dark text variant |

### Background Colors

| Old Class | New Class | Notes |
|-----------|-----------|-------|
| `bg-kong-accent-green` | `bg-kong-success` | Uses semantic color |
| `bg-kong-accent-red` | `bg-kong-error` | Uses semantic color |
| `bg-kong-accent-blue` | `bg-kong-info` | Uses semantic color |
| `bg-kong-accent-yellow` | `bg-kong-warning` | Uses semantic color |
| `bg-kong-bg-tertiary` | `bg-kong-bg-tertiary` | Higher elevation |
| `bg-kong-bg-secondary` | `bg-kong-bg-secondary` | Elevated surface |

### Border Colors

| Old Class | New Class | Notes |
|-----------|-----------|-------|
| `border-kong-accent-green` | `border-kong-success` | Uses semantic color |
| `border-kong-accent-red` | `border-kong-error` | Uses semantic color |
| `border-kong-accent-blue` | `border-kong-info` | Uses semantic color |

## CSS Variable Mapping

### Direct Replacements

```css
/* Old */
--accent-green → --semantic-success
--accent-red → --semantic-error
--accent-blue → --semantic-info
--accent-yellow → --semantic-warning
--accent-purple → --brand-primary
--accent-cyan → --brand-secondary

--bg-dark → --bg-primary
--bg-light → --bg-secondary
--surface-dark → --bg-tertiary
--surface-light → --bg-secondary

--primary → --brand-primary
--secondary → --brand-secondary
--primary-hover → --brand-primary (use opacity/lighten)
--secondary-hover → --brand-secondary (use opacity/lighten)

--text-accent-green → --semantic-success
--text-accent-red → --semantic-error
--text-accent-blue → --semantic-info
```

## Component Updates

### Button Classes

```html
<!-- Old -->
<button class="bg-kong-accent-green text-white">

<!-- New -->
<button class="btn-primary">
<!-- OR -->
<button class="bg-kong-success text-white">
```

### Status Indicators

```html
<!-- Old -->
<span class="text-kong-success">+5%</span>
<span class="text-kong-accent-red">-3%</span>

<!-- New -->
<span class="text-kong-success">+5%</span>
<span class="text-kong-error">-3%</span>
```

### Alerts/Notifications

```html
<!-- Old -->
<div class="bg-kong-accent-red/10 text-kong-accent-red border-kong-accent-red">

<!-- New -->
<div class="bg-kong-error/10 text-kong-error border-kong-error">
```

## JavaScript/TypeScript Updates

### Conditional Classes

```typescript
// Old
const colorClass = isPositive ? 'text-kong-success' : 'text-kong-accent-red';

// New
const colorClass = isPositive ? 'text-kong-success' : 'text-kong-error';
```

### Theme Colors in Code

```typescript
// Old
import { theme } from '$lib/stores/theme';
const greenColor = $theme.colors.accentGreen;

// New
import { getTheme } from '$lib/themes';
const theme = getTheme('dark');
const greenColor = theme.palette.semantic.success;
```

## Migration Script

To help automate the migration, you can use this find-and-replace script:

```bash
# Text colors
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/text-kong-success/text-kong-success/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/text-kong-accent-green/text-kong-success/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/text-kong-error/text-kong-error/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/text-kong-accent-red/text-kong-error/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/text-kong-text-accent-blue/text-kong-info/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/text-kong-accent-blue/text-kong-info/g'

# Background colors
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/bg-kong-accent-green/bg-kong-success/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/bg-kong-accent-red/bg-kong-error/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/bg-kong-accent-blue/bg-kong-info/g'

# Border colors
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/border-kong-accent-green/border-kong-success/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/border-kong-accent-red/border-kong-error/g'
find . -name "*.svelte" -o -name "*.ts" -o -name "*.css" | xargs sed -i '' 's/border-kong-accent-blue/border-kong-info/g'
```

## Manual Review Areas

After running the migration script, manually review these areas:

1. **Hover States**: Old hover variants like `accent-green-hover` need manual updates
2. **Opacity Classes**: Classes like `text-kong-accent-green/80` need to become `text-kong-success/80`
3. **Complex Conditionals**: Review any complex color logic in components
4. **Custom CSS**: Check any custom CSS files for hardcoded color values
5. **Theme-Specific Logic**: Update any code that directly accesses theme properties

## Testing Checklist

After migration, test these key areas:

- [ ] Price change indicators (positive/negative)
- [ ] Status badges and alerts
- [ ] Form validation messages
- [ ] Charts and data visualizations
- [ ] Hover and focus states
- [ ] Dark/light theme switching
- [ ] Custom theme creation (if applicable)

## Rollback Plan

If you need to rollback:

1. The old theme system is still available in `baseTheme.ts`
2. Tailwind config maintains backward compatibility aliases
3. You can use both old and new classes during migration

## Getting Help

If you encounter issues:

1. Check the browser console for CSS warnings
2. Use browser DevTools to inspect computed styles
3. Refer to the new theme documentation in `themes/README.md`
4. Test with a minimal theme first to isolate issues 