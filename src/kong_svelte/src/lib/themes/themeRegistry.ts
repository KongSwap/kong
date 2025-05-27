// Theme Registry - Central place to manage all available themes
import type { ThemeDefinition } from './baseTheme';
import { baseTheme } from './baseTheme';
import { microswapTheme } from './microswapTheme';
import { midnightTheme } from './midnightTheme';
import { nordTheme } from './nordTheme';
import { lightTheme } from './lightTheme';
import { synthwaveTheme } from './synthwaveTheme';
import { dragginzTheme } from './dragginzTheme';

// Collection of all available themes
const themes: ThemeDefinition[] = [
  lightTheme, // Modern light theme
  baseTheme,      // Default dark theme
  microswapTheme,     // Windows 98 light theme
  midnightTheme, // Plain black theme
  nordTheme,       // Nord-inspired theme
  synthwaveTheme,  // Synthwave sunset theme
  dragginzTheme,   // Dragginz fantasy theme
];

/**
 * Get a theme by its ID
 * @param id The theme ID to look up
 * @returns The theme definition or the base theme if not found
 */
export function getThemeById(id: string): ThemeDefinition {
  return themes.find(theme => theme.id === id) || baseTheme;
}

/**
 * Get all available themes
 * @returns Array of all theme definitions
 */
export function getAllThemes(): ThemeDefinition[] {
  return [...themes];
}

/**
 * Add a new theme to the registry
 * @param theme The theme definition to add
 * @returns Whether the theme was successfully added
 */
export function registerTheme(theme: ThemeDefinition): boolean {
  // Check if a theme with this ID already exists
  if (themes.some(t => t.id === theme.id)) {
    console.warn(`Theme with ID "${theme.id}" already exists. Did not register.`);
    return false;
  }
  
  themes.push(theme);
  return true;
}

/**
 * Convert Tailwind rounded class to CSS value
 */
function getRoundedValue(roundedClass: string | undefined): string {
  const roundedMap: Record<string, string> = {
    'rounded-none': '0',
    'rounded-sm': '0.125rem',
    'rounded': '0.25rem',
    'rounded-md': '0.375rem',
    'rounded-lg': '0.5rem',
    'rounded-xl': '0.75rem',
    'rounded-2xl': '1rem',
    'rounded-3xl': '1.5rem',
    'rounded-full': '9999px'
  };
  
  return roundedMap[roundedClass || 'rounded-lg'] || '0.5rem';
}

/**
 * Generate CSS variables from a theme definition
 * @param theme The theme to generate CSS variables for
 * @returns CSS variables as a string
 */
export function generateThemeVariables(theme: ThemeDefinition): string {
  const colors = theme.colors;
  const hexToRGB = (hex: string | undefined): string => {
    if (!hex) return '0 0 0'; // fallback to black if undefined
    
    // Remove the hash at the start if it exists
    hex = hex.replace(/^#/, '');
    
    // Parse the hex values
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
    
    return `${r} ${g} ${b}`;
  };

  // Build the CSS variables
  let css = '';
  
  // Background colors
  css += `--bg-dark: ${hexToRGB(colors.bgPrimary)};\n`;  // Legacy mapping for backward compatibility
  css += `--bg-light: ${hexToRGB(colors.bgSecondary)};\n`;  // Legacy mapping for backward compatibility

  // New semantic background mappings
  css += `--bg-primary: ${hexToRGB(colors.bgPrimary)};\n`;
  css += `--bg-secondary: ${hexToRGB(colors.bgSecondary)};\n`;
  css += `--bg-tertiary: ${hexToRGB(colors.bgTertiary)};\n`;
  
  // Primary and secondary colors
  css += `--primary: ${hexToRGB(colors.primary)};\n`;
  css += `--primary-hover: ${hexToRGB(colors.primaryHover)};\n`;
  css += `--secondary: ${hexToRGB(colors.secondary)};\n`;
  css += `--secondary-hover: ${hexToRGB(colors.secondaryHover)};\n`;
  
  // Brand colors (mapped from primary/secondary)
  css += `--brand-primary: ${hexToRGB(colors.primary)};\n`;
  css += `--brand-secondary: ${hexToRGB(colors.secondary)};\n`;
  
  // Accent colors - map semantic colors to legacy color-specific variables
  css += `--accent-blue: ${hexToRGB(colors.info || colors.accent)};\n`;
  css += `--accent-red: ${hexToRGB(colors.error)};\n`;
  css += `--accent-green: ${hexToRGB(colors.success)};\n`;
  css += `--accent-yellow: ${hexToRGB(colors.warning)};\n`;
  css += `--accent-purple: ${hexToRGB(colors.accent)};\n`;
  css += `--accent-cyan: ${hexToRGB(colors.info)};\n`;
  
  // Semantic colors
  css += `--semantic-success: ${hexToRGB(colors.success)};\n`;
  css += `--semantic-error: ${hexToRGB(colors.error)};\n`;
  css += `--semantic-warning: ${hexToRGB(colors.warning)};\n`;
  css += `--semantic-info: ${hexToRGB(colors.info)};\n`;
  
  // Hover variants - map semantic hover colors to legacy color-specific variables
  css += `--accent-green-hover: ${hexToRGB(colors.successHover)};\n`;
  css += `--accent-blue-hover: ${hexToRGB(colors.infoHover || colors.accentHover)};\n`;
  css += `--accent-red-hover: ${hexToRGB(colors.errorHover)};\n`;
  css += `--accent-yellow-hover: ${hexToRGB(colors.warningHover)};\n`;
  
  // Semantic hover variants
  css += `--semantic-success-hover: ${hexToRGB(colors.successHover)};\n`;
  css += `--semantic-error-hover: ${hexToRGB(colors.errorHover)};\n`;
  css += `--semantic-info-hover: ${hexToRGB(colors.infoHover)};\n`;
  css += `--semantic-warning-hover: ${hexToRGB(colors.warningHover)};\n`;
  
  // Text colors
  css += `--text-primary: ${hexToRGB(colors.textPrimary)};\n`;
  css += `--text-secondary: ${hexToRGB(colors.textSecondary)};\n`;
  css += `--text-success: ${hexToRGB(colors.textSuccess)};\n`;
  css += `--text-error: ${hexToRGB(colors.textError)};\n`;
  css += `--text-warning: ${hexToRGB(colors.textWarning)};\n`;
  css += `--text-info: ${hexToRGB(colors.textInfo)};\n`;
  css += `--text-muted: ${hexToRGB(colors.textMuted)};\n`;
  css += `--text-disabled: ${hexToRGB(colors.textDisabled)};\n`;
  
  // Semantic text mappings
  css += `--text-inverse: ${hexToRGB(colors.textLight || colors.textPrimary)};\n`;
  css += `--text-on-primary: ${hexToRGB(colors.textOnPrimary || colors.textDark || '#000000')};\n`;
  
  // UI colors
  css += `--ui-border: ${hexToRGB(colors.border)};\n`;
  css += `--ui-border-light: ${hexToRGB(colors.borderLight)};\n`;
  css += `--ui-focus: ${hexToRGB(colors.info || colors.accent)};\n`;
  css += `--ui-hover: ${hexToRGB(colors.hoverBgSecondary || colors.bgSecondary)};\n`;
  
  // Borders
  css += `--border: ${hexToRGB(colors.border)};\n`;
  css += `--border-light: ${hexToRGB(colors.borderLight)};\n`;
  
  // Logo properties
  css += `--logo-brightness: ${colors.logoBrightness};\n`;
  css += `--logo-invert: ${colors.logoInvert};\n`;
  css += `--logo-hover-brightness: ${colors.logoHoverBrightness};\n`;
  
  if (colors.kongBorder) {
    css += `--kong-border: ${colors.kongBorder};\n`;
  }

  // Background configuration
  css += `--background-type: ${colors.backgroundType};\n`;
  if (colors.backgroundGradient) {
    css += `--background-gradient: ${colors.backgroundGradient};\n`;
  }
  if (colors.backgroundSolid) {
    css += `--background-solid: ${colors.backgroundSolid};\n`;
  }
  if (colors.backgroundImage) {
    css += `--background-image: ${colors.backgroundImage};\n`;
  }
  if (colors.backgroundOpacity !== undefined) {
    css += `--background-opacity: ${colors.backgroundOpacity};\n`;
  }
  css += `--enable-nebula: ${colors.enableNebula ? 1 : 0};\n`;
  css += `--enable-stars: ${colors.enableStars ? 1 : 0};\n`;
  
  if (colors.nebulaOpacity !== undefined) {
    css += `--nebula-opacity: ${colors.nebulaOpacity};\n`;
  }
  if (colors.starsOpacity !== undefined) {
    css += `--stars-opacity: ${colors.starsOpacity};\n`;
  }
  
  // Font family (if provided)
  if (colors.fontFamily) {
    css += `--font-family: ${colors.fontFamily};\n`;
  }

  // Panel roundness
  css += `--panel-roundness: ${getRoundedValue(colors.panelRoundness)};\n`;
  css += `--swap-panel-roundness: ${getRoundedValue(colors.swapPanelRoundness)};\n`;
  css += `--swap-button-roundness: ${getRoundedValue(colors.swapButtonRoundness)};\n`;
  css += `--button-roundness: ${getRoundedValue(colors.buttonRoundness)};\n`;
  
  // Color scheme
  css += `color-scheme: ${theme.colorScheme};\n`;
  
  return css;
}