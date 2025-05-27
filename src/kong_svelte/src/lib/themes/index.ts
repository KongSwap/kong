// Theme system exports

// Types
export type { 
  Theme, 
  ThemePalette, 
  ThemeStyles, 
  ThemeComponents,
  ThemeBackground,
  ThemeLogo 
} from './types';

// Utilities
export { 
  hexToRgb, 
  rgbToHex, 
  withOpacity,
  lighten,
  darken,
  defaultStyles,
  borders,
  shadows
} from './defaults';

// CSS generation
export {
  generateCssVariables,
  generateComponentStyles,
  generateThemeStylesheet,
  applyTheme
} from './cssGenerator';

// Migration utilities
export { migrateTheme, unmigrateTheme } from './migration';

// Preset themes
export { darkTheme } from './presets/dark';
export { lightTheme } from './presets/light';

// Theme registry
import { darkTheme } from './presets/dark';
import { lightTheme } from './presets/light';
import type { Theme } from './types';

// Theme collection
const themes = new Map<string, Theme>([
  ['dark', darkTheme],
  ['light', lightTheme]
]);

/**
 * Get a theme by ID
 */
export function getTheme(id: string): Theme | undefined {
  return themes.get(id);
}

/**
 * Get all themes
 */
export function getAllThemes(): Theme[] {
  return Array.from(themes.values());
}

/**
 * Register a new theme
 */
export function registerTheme(theme: Theme): void {
  themes.set(theme.id, theme);
}

/**
 * Check if a theme exists
 */
export function hasTheme(id: string): boolean {
  return themes.has(id);
} 