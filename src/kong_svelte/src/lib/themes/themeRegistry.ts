// Theme Registry - Central place to manage all available themes
import type { ThemeDefinition } from './baseTheme';
import { baseTheme } from './baseTheme';
import { win98Theme } from './win98Theme';
import { plainBlackTheme } from './plainBlackTheme';
import { nordTheme } from './nordTheme';
import { lightTheme } from './lightTheme';
import { synthwaveTheme } from './synthwaveTheme';

// Collection of all available themes
const themes: ThemeDefinition[] = [
  lightTheme, // Modern light theme
  baseTheme,      // Default dark theme
  win98Theme,     // Windows 98 light theme
  plainBlackTheme, // Plain black theme
  nordTheme,       // Nord-inspired theme
  synthwaveTheme,  // Synthwave sunset theme
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
 * Generate CSS variables from a theme definition
 * @param theme The theme to generate CSS variables for
 * @returns CSS variables as a string
 */
export function generateThemeVariables(theme: ThemeDefinition): string {
  const colors = theme.colors;
  const hexToRGB = (hex: string): string => {
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
  css += `--bg-dark: ${hexToRGB(colors.bgDark)};\n`;
  css += `--bg-light: ${hexToRGB(colors.bgLight)};\n`;
  if (colors.hoverBgLight) {
    css += `--hover-bg-light: ${hexToRGB(colors.hoverBgLight)};\n`;
  }
  
  // Primary and secondary colors
  css += `--primary: ${hexToRGB(colors.primary)};\n`;
  css += `--primary-hover: ${hexToRGB(colors.primaryHover)};\n`;
  css += `--secondary: ${hexToRGB(colors.secondary)};\n`;
  css += `--secondary-hover: ${hexToRGB(colors.secondaryHover)};\n`;
  
  // Accent colors
  css += `--accent-blue: ${hexToRGB(colors.accentBlue)};\n`;
  css += `--accent-red: ${hexToRGB(colors.accentRed)};\n`;
  css += `--accent-green: ${hexToRGB(colors.accentGreen)};\n`;
  css += `--accent-yellow: ${hexToRGB(colors.accentYellow)};\n`;
  css += `--accent-purple: ${hexToRGB(colors.accentPurple)};\n`;
  css += `--accent-cyan: ${hexToRGB(colors.accentCyan)};\n`;
  
  // Hover variants
  css += `--accent-green-hover: ${hexToRGB(colors.accentGreenHover)};\n`;
  css += `--accent-blue-hover: ${hexToRGB(colors.accentBlueHover)};\n`;
  css += `--accent-red-hover: ${hexToRGB(colors.accentRedHover)};\n`;
  if (colors.accentYellowHover) {
    css += `--accent-yellow-hover: ${hexToRGB(colors.accentYellowHover)};\n`;
  }
  
  // Text colors
  css += `--text-primary: ${hexToRGB(colors.textPrimary)};\n`;
  css += `--text-secondary: ${hexToRGB(colors.textSecondary)};\n`;
  css += `--text-disabled: ${hexToRGB(colors.textDisabled)};\n`;
  if (colors.textLight) {
    css += `--text-light: ${hexToRGB(colors.textLight)};\n`;
  }
  if (colors.textDark) {
    css += `--text-dark: ${hexToRGB(colors.textDark)};\n`;
  }
  if (colors.textOnPrimary) {
    css += `--text-on-primary: ${hexToRGB(colors.textOnPrimary)};\n`;
  }
  if (colors.textAccentGreen) {
    css += `--text-accent-green: ${hexToRGB(colors.textAccentGreen)};\n`;
  }
  if (colors.textAccentBlue) {
    css += `--text-accent-blue: ${hexToRGB(colors.textAccentBlue)};\n`;
  }
  if (colors.textAccentRed) {
    css += `--text-accent-red: ${hexToRGB(colors.textAccentRed)};\n`;
  }
  
  // Borders
  css += `--border: ${hexToRGB(colors.border)};\n`;
  css += `--border-light: ${hexToRGB(colors.borderLight)};\n`;
  
  // Surface colors
  css += `--surface-dark: ${hexToRGB(colors.surfaceDark)};\n`;
  css += `--surface-light: ${hexToRGB(colors.surfaceLight)};\n`;
  
  // Logo properties
  css += `--logo-brightness: ${colors.logoBrightness};\n`;
  css += `--logo-invert: ${colors.logoInvert};\n`;
  css += `--logo-hover-brightness: ${colors.logoHoverBrightness};\n`;
  
  // Plugin Manager colors
  css += `--pm-dark: ${hexToRGB(colors.pmDark)};\n`;
  css += `--pm-border: ${hexToRGB(colors.pmBorder)};\n`;
  css += `--pm-accent: ${hexToRGB(colors.pmAccent)};\n`;
  css += `--pm-text-secondary: ${hexToRGB(colors.pmTextSecondary)};\n`;
  
  // Token selector dropdown colors
  if (colors.tokenSelectorBg) {
    css += `--token-selector-bg: ${colors.tokenSelectorBg};\n`;
  }
  if (colors.tokenSelectorHeaderBg) {
    css += `--token-selector-header-bg: ${colors.tokenSelectorHeaderBg};\n`;
  }
  if (colors.tokenSelectorItemBg) {
    css += `--token-selector-item-bg: ${colors.tokenSelectorItemBg};\n`;
  }
  if (colors.tokenSelectorItemHoverBg) {
    css += `--token-selector-item-hover-bg: ${colors.tokenSelectorItemHoverBg};\n`;
  }
  if (colors.tokenSelectorItemActiveBg) {
    css += `--token-selector-item-active-bg: ${colors.tokenSelectorItemActiveBg};\n`;
  }
  if (colors.tokenSelectorSearchBg) {
    css += `--token-selector-search-bg: ${colors.tokenSelectorSearchBg};\n`;
  }
  if (colors.tokenSelectorBorder) {
    css += `--token-selector-border: ${colors.tokenSelectorBorder};\n`;
  }
  if (colors.tokenSelectorShadow) {
    css += `--token-selector-shadow: ${colors.tokenSelectorShadow};\n`;
  }
  
  // Chart text color (if provided)
  if (colors.chartTextColor) {
    css += `--chart-text-color: ${colors.chartTextColor};\n`;
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
  css += `--enable-skyline: ${colors.enableSkyline ? 1 : 0};\n`;
  
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
  
  // Color scheme
  css += `color-scheme: ${theme.colorScheme};\n`;
  
  return css;
} 