// Theme Registry - Central place to manage all available themes
// Now uses only the core theme format
import type { CoreTheme } from './coreTypes';
import { coreDarkTheme } from './coreDarkTheme';
import { coreLightTheme } from './coreLightTheme';
import { generateCoreCssVariables } from './coreCssGenerator';

// Collection of core themes
const coreThemes: CoreTheme[] = [
  coreDarkTheme,    // Modern core dark theme (default)
  coreLightTheme,   // Modern core light theme  
];

/**
 * Get a theme by its ID
 * @param id The theme ID to look up
 * @returns The theme or the default dark theme if not found
 */
export function getThemeById(id: string): CoreTheme {
  return coreThemes.find(theme => theme.id === id) || coreDarkTheme;
}

/**
 * Get a theme by its ID (alias for getThemeById)
 * @param id The theme ID to look up
 * @returns The theme or the default dark theme if not found
 */
export function getCoreThemeById(id: string): CoreTheme {
  return getThemeById(id);
}

/**
 * Get all available themes
 * @returns Array of all theme definitions
 */
export function getAllThemes(): CoreTheme[] {
  return [...coreThemes];
}

/**
 * Get all available themes (alias for getAllThemes)
 * @returns Array of all theme definitions
 */
export function getAllCoreThemes(): CoreTheme[] {
  return getAllThemes();
}

/**
 * Add a new theme to the registry
 * @param theme The theme definition to add
 * @returns Whether the theme was successfully added
 */
export function registerTheme(theme: CoreTheme): boolean {
  // Check if a theme with this ID already exists
  if (coreThemes.some(t => t.id === theme.id)) {
    console.warn(`Theme with ID "${theme.id}" already exists. Did not register.`);
    return false;
  }
  
  coreThemes.push(theme);
  return true;
}

/**
 * Register a core theme (alias for registerTheme)
 * @param theme The core theme definition to add
 * @returns Whether the theme was successfully added
 */
export function registerCoreTheme(theme: CoreTheme): boolean {
  return registerTheme(theme);
}

/**
 * Generate CSS variables from a theme definition
 * @param theme The theme to generate CSS variables for
 * @returns CSS variables as a string
 */
export function generateThemeVariables(theme: CoreTheme): string {
  return generateCoreCssVariables(theme);
}