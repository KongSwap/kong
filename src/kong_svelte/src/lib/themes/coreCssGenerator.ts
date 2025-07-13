// Core CSS Generator - Simplified CSS variable generation
// Generates clean, maintainable CSS variables from core theme structure

import type { CoreTheme } from './coreTypes';
import { hexToRgb } from './defaults';


/**
 * Generate CSS variables from core theme structure
 * Clean, focused variable generation without legacy complexity
 */
export function generateCoreCssVariables(theme: CoreTheme): string {
  const vars: string[] = [];
  const { colors, styles, overrides } = theme;
  
  // Core background colors
  vars.push(`--bg-primary: ${hexToRgb(colors.bg.primary)}`);
  vars.push(`--bg-secondary: ${hexToRgb(colors.bg.secondary)}`);
  vars.push(`--bg-tertiary: ${hexToRgb(colors.bg.tertiary)}`);
  
  // Core text colors
  vars.push(`--text-primary: ${hexToRgb(colors.text.primary)}`);
  vars.push(`--text-secondary: ${hexToRgb(colors.text.secondary)}`);
  vars.push(`--text-disabled: ${hexToRgb(colors.text.disabled)}`);
  vars.push(`--text-inverse: ${hexToRgb(colors.text.inverse)}`);
  
  // Brand colors
  vars.push(`--brand-primary: ${hexToRgb(colors.brand.primary)}`);
  vars.push(`--brand-secondary: ${hexToRgb(colors.brand.secondary)}`);
  
  // Semantic colors
  vars.push(`--semantic-success: ${hexToRgb(colors.semantic.success)}`);
  vars.push(`--semantic-error: ${hexToRgb(colors.semantic.error)}`);
  vars.push(`--semantic-warning: ${hexToRgb(colors.semantic.warning)}`);
  vars.push(`--semantic-info: ${hexToRgb(colors.semantic.info)}`);
  
  // UI colors
  vars.push(`--ui-border: ${hexToRgb(colors.ui.border)}`);
  vars.push(`--ui-focus: ${hexToRgb(colors.ui.focus)}`);
  
  // Design tokens
  vars.push(`--font-family: ${styles.font.family}`);
  if (styles.font.scale) {
    vars.push(`--font-scale: ${styles.font.scale}`);
  }
  
  // Radius mapping
  const radiusMap = {
    sm: '0.375rem',
    md: '0.5rem', 
    lg: '0.75rem',
    xl: '1rem'
  };
  vars.push(`--radius-default: ${radiusMap[styles.radius]}`);
  
  // Generate hover variants by lightening/darkening base colors
  const generateHover = (color: string, amount: number = 0.1): string => {
    const rgb = hexToRgb(color).split(' ').map(Number);
    const adjusted = theme.colorScheme === 'dark'
      ? rgb.map(val => Math.min(255, val + val * amount)) // Lighten for dark theme
      : rgb.map(val => Math.max(0, val - val * amount));   // Darken for light theme
    return adjusted.join(' ');
  };
  
  // Hover variants
  vars.push(`--brand-primary-hover: ${generateHover(colors.brand.primary)}`);
  vars.push(`--brand-secondary-hover: ${generateHover(colors.brand.secondary)}`);
  vars.push(`--ui-hover: ${generateHover(colors.bg.secondary, 0.05)}`);
  
  // Component overrides
  if (overrides?.button?.primary) {
    const btn = overrides.button.primary;
    if (btn.background) vars.push(`--btn-primary-bg: ${hexToRgb(btn.background)}`);
    if (btn.hover) vars.push(`--btn-primary-hover: ${hexToRgb(btn.hover)}`);
    if (btn.text) vars.push(`--btn-primary-text: ${hexToRgb(btn.text)}`);
  }
  
  if (overrides?.button?.secondary) {
    const btn = overrides.button.secondary;
    if (btn.background) vars.push(`--btn-secondary-bg: ${hexToRgb(btn.background)}`);
    if (btn.hover) vars.push(`--btn-secondary-hover: ${hexToRgb(btn.hover)}`);
    if (btn.text) vars.push(`--btn-secondary-text: ${hexToRgb(btn.text)}`);
  }
  
  if (overrides?.panel) {
    const panel = overrides.panel;
    if (panel.background) vars.push(`--panel-bg: ${hexToRgb(panel.background)}`);
    if (panel.border) vars.push(`--panel-border: ${hexToRgb(panel.border)}`);
    if (panel.radius) vars.push(`--panel-radius: ${radiusMap[panel.radius]}`);
  }
  
  
  // Swap-specific variables with defaults
  // Always generate these for backwards compatibility
  vars.push(`--swap-input-bg: ${hexToRgb(overrides?.swap?.input?.background || colors.bg.tertiary)}`);
  vars.push(`--swap-input-border: ${hexToRgb(overrides?.swap?.input?.border || colors.ui.border)}`);
  vars.push(`--swap-input-hover-border: ${hexToRgb(overrides?.swap?.input?.borderHover || colors.brand.primary)}`);
  vars.push(`--swap-input-focus-border: ${hexToRgb(overrides?.swap?.input?.borderFocus || colors.brand.primary)}`);
  
  // Swap button variables
  vars.push(`--swap-button-bg: ${hexToRgb(overrides?.swap?.button?.background || colors.brand.primary)}`);
  vars.push(`--swap-button-hover-bg: ${hexToRgb(overrides?.swap?.button?.hover || colors.brand.secondary)}`);
  vars.push(`--swap-button-disabled-bg: ${hexToRgb(overrides?.swap?.button?.disabled || colors.ui.border)}`);
  vars.push(`--swap-button-error-bg: ${hexToRgb(overrides?.swap?.button?.error || colors.semantic.error)}`);
  vars.push(`--swap-button-text-color: ${hexToRgb(colors.text.inverse)}`);
  
  // Swap container
  vars.push(`--swap-container-bg: ${hexToRgb(overrides?.swap?.container?.background || colors.bg.secondary)}`);
  vars.push(`--swap-container-roundness: ${radiusMap[overrides?.swap?.container?.radius || styles.borderRadius || styles.radius || 'lg'] || '1rem'}`);
  vars.push(`--swap-button-roundness: ${radiusMap[overrides?.swap?.button?.radius || styles.borderRadius || styles.radius || 'lg'] || '1rem'}`);
  
  // Background configuration
  if (theme.background) {
    if (theme.background.type) {
      vars.push(`--background-type: ${theme.background.type}`);
    }
    if (theme.background.gradient) {
      vars.push(`--background-gradient: ${theme.background.gradient}`);
    }
    if (theme.background.solid) {
      vars.push(`--background-solid: ${theme.background.solid}`);
    }
    if (theme.background.image) {
      vars.push(`--background-image: ${theme.background.image}`);
    }
  }
  
  // Effects configuration
  if (theme.effects) {
    vars.push(`--enable-nebula: ${theme.effects.enableNebula ? 1 : 0}`);
    vars.push(`--enable-stars: ${theme.effects.enableStars ? 1 : 0}`);
    if (theme.effects.nebulaOpacity !== undefined) {
      vars.push(`--nebula-opacity: ${theme.effects.nebulaOpacity}`);
    }
    if (theme.effects.starsOpacity !== undefined) {
      vars.push(`--stars-opacity: ${theme.effects.starsOpacity}`);
    }
  }
  
  // Branding configuration
  if (theme.branding) {
    if (theme.branding.logoBrightness !== undefined) {
      vars.push(`--logo-brightness: ${theme.branding.logoBrightness}`);
    }
    if (theme.branding.logoInvert !== undefined) {
      vars.push(`--logo-invert: ${theme.branding.logoInvert}`);
    }
    if (theme.branding.logoHoverBrightness !== undefined) {
      vars.push(`--logo-hover-brightness: ${theme.branding.logoHoverBrightness}`);
    }
    if (theme.branding.customPath) {
      vars.push(`--logo-path: ${theme.branding.customPath}`);
    }
  }
  
  // Typography configuration
  if (theme.typography?.fontFamily) {
    vars.push(`--font-family: ${theme.typography.fontFamily}`);
  }
  
  // Legacy compatibility mappings
  generateLegacyMappings(vars, colors);
  
  // Color scheme
  vars.push(`color-scheme: ${theme.colorScheme}`);
  
  return vars.join(';\n  ') + ';';
}

/**
 * Generate legacy variable mappings for backwards compatibility
 * Maps new semantic variables to old color-specific variables
 */
function generateLegacyMappings(vars: string[], colors: CoreTheme['colors']): void {
  // Legacy primary/secondary mappings
  vars.push(`--primary: ${hexToRgb(colors.brand.primary)}`);
  vars.push(`--secondary: ${hexToRgb(colors.brand.secondary)}`);
  
  // Legacy color-specific mappings
  vars.push(`--accent-green: ${hexToRgb(colors.semantic.success)}`);
  vars.push(`--accent-red: ${hexToRgb(colors.semantic.error)}`);
  vars.push(`--accent-yellow: ${hexToRgb(colors.semantic.warning)}`);
  vars.push(`--accent-blue: ${hexToRgb(colors.semantic.info)}`);
  vars.push(`--accent-purple: ${hexToRgb(colors.brand.primary)}`);
  vars.push(`--accent-cyan: ${hexToRgb(colors.brand.secondary)}`);
  
  // Legacy border mappings
  vars.push(`--border: ${hexToRgb(colors.ui.border)}`);
  vars.push(`--border-light: ${hexToRgb(colors.ui.border)}`);
  
  // Legacy background mappings
  vars.push(`--bg-dark: ${hexToRgb(colors.bg.primary)}`);
  vars.push(`--bg-light: ${hexToRgb(colors.bg.secondary)}`);
  
  // Legacy text mappings
  vars.push(`--text-on-primary: ${hexToRgb(colors.text.inverse)}`);
  vars.push(`--text-accent-green: ${hexToRgb(colors.semantic.success)}`);
  vars.push(`--text-accent-red: ${hexToRgb(colors.semantic.error)}`);
  vars.push(`--text-accent-blue: ${hexToRgb(colors.semantic.info)}`);
  
  // Legacy hover mappings
  const generateHover = (color: string): string => {
    const rgb = hexToRgb(color).split(' ').map(Number);
    const adjusted = rgb.map(val => Math.min(255, val + val * 0.1));
    return adjusted.join(' ');
  };
  
  vars.push(`--primary-hover: ${generateHover(colors.brand.primary)}`);
  vars.push(`--secondary-hover: ${generateHover(colors.brand.secondary)}`);
  vars.push(`--accent-green-hover: ${generateHover(colors.semantic.success)}`);
  vars.push(`--accent-red-hover: ${generateHover(colors.semantic.error)}`);
  vars.push(`--accent-blue-hover: ${generateHover(colors.semantic.info)}`);
}

/**
 * Generate complete theme stylesheet
 */
export function generateThemeStylesheet(theme: CoreTheme): string {
  const cssVars = generateCoreCssVariables(theme);
  
  return `
/* ${theme.name} Theme Styles */
:root.${theme.colorScheme} {
  ${cssVars}
}

/* Component styles can be added here */
  `.trim();
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: CoreTheme): void {
  if (typeof document === 'undefined') return;
  
  // Remove existing theme classes
  document.documentElement.classList.remove('light', 'dark');
  
  // Add new theme class
  document.documentElement.classList.add(theme.colorScheme);
  
  // Generate and inject styles
  const styleId = 'dynamic-theme-styles';
  let styleElement = document.getElementById(styleId) as HTMLStyleElement;
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  
  styleElement.textContent = generateThemeStylesheet(theme);
  
  // Set data attributes
  document.documentElement.setAttribute('data-theme', theme.id);
  document.documentElement.setAttribute('data-theme-ready', 'true');
}