// CSS generation utilities for themes

import type { Theme } from './types';
import { hexToRgb } from './defaults';

/**
 * Generate CSS variables from a theme
 */
export function generateCssVariables(theme: Theme): string {
  const vars: string[] = [];
  
  // Palette colors - convert to RGB for Tailwind compatibility
  const { palette } = theme;
  
  // Background colors
  vars.push(`--bg-primary: ${hexToRgb(palette.background.primary)}`);
  vars.push(`--bg-secondary: ${hexToRgb(palette.background.secondary)}`);
  vars.push(`--bg-tertiary: ${hexToRgb(palette.background.tertiary)}`);
  
  // Text colors
  vars.push(`--text-primary: ${hexToRgb(palette.text.primary)}`);
  vars.push(`--text-secondary: ${hexToRgb(palette.text.secondary)}`);
  vars.push(`--text-disabled: ${hexToRgb(palette.text.disabled)}`);
  vars.push(`--text-inverse: ${hexToRgb(palette.text.inverse)}`);
  
  // Brand colors
  vars.push(`--brand-primary: ${hexToRgb(palette.brand.primary)}`);
  vars.push(`--brand-secondary: ${hexToRgb(palette.brand.secondary)}`);
  
  // Semantic colors
  vars.push(`--semantic-success: ${hexToRgb(palette.semantic.success)}`);
  vars.push(`--semantic-error: ${hexToRgb(palette.semantic.error)}`);
  vars.push(`--semantic-warning: ${hexToRgb(palette.semantic.warning)}`);
  vars.push(`--semantic-info: ${hexToRgb(palette.semantic.info)}`);
  
  // UI colors
  vars.push(`--ui-border: ${hexToRgb(palette.ui.border)}`);
  vars.push(`--ui-border-light: ${hexToRgb(palette.ui.borderLight)}`);
  vars.push(`--ui-focus: ${hexToRgb(palette.ui.focus)}`);
  vars.push(`--ui-hover: ${hexToRgb(palette.ui.hover)}`);
  
  // Legacy mappings for backward compatibility
  vars.push(`--primary: ${hexToRgb(palette.brand.primary)}`);
  vars.push(`--secondary: ${hexToRgb(palette.brand.secondary)}`);
  vars.push(`--accent-green: ${hexToRgb(palette.semantic.success)}`);
  vars.push(`--accent-red: ${hexToRgb(palette.semantic.error)}`);
  vars.push(`--accent-blue: ${hexToRgb(palette.semantic.info)}`);
  vars.push(`--accent-yellow: ${hexToRgb(palette.semantic.warning)}`);
  vars.push(`--accent-purple: ${hexToRgb(palette.brand.primary)}`);
  vars.push(`--accent-cyan: ${hexToRgb(palette.brand.secondary)}`);
  vars.push(`--border: ${hexToRgb(palette.ui.border)}`);
  vars.push(`--border-light: ${hexToRgb(palette.ui.borderLight)}`);
  vars.push(`--text-accent-green: ${hexToRgb(palette.semantic.success)}`);
  vars.push(`--text-accent-red: ${hexToRgb(palette.semantic.error)}`);
  vars.push(`--text-accent-blue: ${hexToRgb(palette.semantic.info)}`);
  vars.push(`--text-on-primary: ${hexToRgb(palette.text.inverse)}`);
  
  // Also add some legacy hover states
  vars.push(`--primary-hover: ${hexToRgb(palette.brand.primary)}`);
  vars.push(`--secondary-hover: ${hexToRgb(palette.brand.secondary)}`);
  vars.push(`--accent-green-hover: ${hexToRgb(palette.semantic.success)}`);
  vars.push(`--accent-blue-hover: ${hexToRgb(palette.semantic.info)}`);
  vars.push(`--accent-red-hover: ${hexToRgb(palette.semantic.error)}`);
  
  // Styles
  const { styles } = theme;
  vars.push(`--font-family: ${styles.font.family}`);
  if (styles.font.scale) {
    vars.push(`--font-scale: ${styles.font.scale}`);
  }
  
  // Radius values
  Object.entries(styles.radius).forEach(([key, value]) => {
    vars.push(`--radius-${key}: ${value}`);
  });
  
  // Shadow values
  Object.entries(styles.shadow).forEach(([key, value]) => {
    vars.push(`--shadow-${key}: ${value}`);
  });
  
  // Opacity values
  if (styles.opacity.panel !== undefined) {
    vars.push(`--opacity-panel: ${styles.opacity.panel}`);
  }
  if (styles.opacity.blur !== undefined) {
    vars.push(`--opacity-blur: ${styles.opacity.blur}px`);
  }
  
  // Background configuration
  if (theme.background) {
    vars.push(`--background-type: ${theme.background.type}`);
    vars.push(`--background-value: ${theme.background.value}`);
    
    if (theme.background.effects) {
      vars.push(`--enable-nebula: ${theme.background.effects.nebula ? 1 : 0}`);
      vars.push(`--enable-stars: ${theme.background.effects.stars ? 1 : 0}`);
      if (theme.background.effects.opacity !== undefined) {
        vars.push(`--background-opacity: ${theme.background.effects.opacity}`);
      }
    }
    
    if (theme.background.image) {
      if (theme.background.image.size) {
        vars.push(`--background-size: ${theme.background.image.size}`);
      }
      if (theme.background.image.position) {
        vars.push(`--background-position: ${theme.background.image.position}`);
      }
      if (theme.background.image.repeat) {
        vars.push(`--background-repeat: ${theme.background.image.repeat}`);
      }
    }
  }
  
  // Logo configuration
  if (theme.logo) {
    vars.push(`--logo-brightness: ${theme.logo.brightness}`);
    vars.push(`--logo-invert: ${theme.logo.invert ? 1 : 0}`);
    if (theme.logo.customPath) {
      vars.push(`--logo-path: ${theme.logo.customPath}`);
    }
  }
  
  // Component overrides
  if (theme.components) {
    // Add component-specific variables as needed
    // These would be used by component classes
  }
  
  // Color scheme
  vars.push(`color-scheme: ${theme.colorScheme}`);
  
  return vars.join(';\n  ') + ';';
}

/**
 * Generate component-specific CSS classes
 */
export function generateComponentStyles(theme: Theme): string {
  const styles: string[] = [];
  
  if (!theme.components) return '';
  
  // Button styles
  if (theme.components.button) {
    if (theme.components.button.primary) {
      const btn = theme.components.button.primary;
      styles.push(`.btn-primary {
        ${btn.background ? `background-color: ${btn.background};` : ''}
        ${btn.color ? `color: ${btn.color};` : ''}
        ${btn.border ? `border: ${btn.border};` : ''}
        ${btn.borderColor ? `border-color: ${btn.borderColor};` : ''}
        ${btn.shadow ? `box-shadow: ${btn.shadow};` : ''}
        ${btn.radius ? `@apply ${btn.radius};` : ''}
      }`);
      
      if (btn.hoverBackground) {
        styles.push(`.btn-primary:hover {
          background-color: ${btn.hoverBackground};
        }`);
      }
    }
    
    if (theme.components.button.secondary) {
      const btn = theme.components.button.secondary;
      styles.push(`.btn-secondary {
        ${btn.background ? `background-color: ${btn.background};` : ''}
        ${btn.color ? `color: ${btn.color};` : ''}
        ${btn.border ? `border: ${btn.border};` : ''}
        ${btn.borderColor ? `border-color: ${btn.borderColor};` : ''}
        ${btn.shadow ? `box-shadow: ${btn.shadow};` : ''}
        ${btn.radius ? `@apply ${btn.radius};` : ''}
      }`);
      
      if (btn.hoverBackground) {
        styles.push(`.btn-secondary:hover {
          background-color: ${btn.hoverBackground};
        }`);
      }
    }
  }
  
  // Panel styles
  if (theme.components.panel) {
    if (theme.components.panel.swap) {
      const panel = theme.components.panel.swap;
      styles.push(`.panel-swap {
        ${panel.background ? `background-color: ${panel.background};` : ''}
        ${panel.border ? `border: ${panel.border};` : ''}
        ${panel.shadow ? `box-shadow: ${panel.shadow};` : ''}
        ${panel.radius ? `@apply ${panel.radius};` : ''}
        ${panel.transparent ? 'background-color: transparent;' : ''}
      }`);
    }
  }
  
  // Add more component styles as needed
  
  return styles.join('\n\n');
}

/**
 * Generate complete theme stylesheet
 */
export function generateThemeStylesheet(theme: Theme): string {
  const cssVars = generateCssVariables(theme);
  const componentStyles = generateComponentStyles(theme);
  
  return `
/* ${theme.name} Theme Styles */
:root.${theme.colorScheme} {
  ${cssVars}
}

${componentStyles}
  `.trim();
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: Theme): void {
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