// Core Theme System - Simplified and maintainable theme types
// This system provides a streamlined approach while maintaining backwards compatibility

// Design token types
export type RadiusSize = 'sm' | 'md' | 'lg' | 'xl';
export type ColorScheme = 'light' | 'dark';

// Core color structure - only essential colors (15 properties max)
export interface CoreColors {
  // Background hierarchy (3 levels)
  bg: {
    primary: string;    // Main app background
    secondary: string;  // Cards, panels
    tertiary: string;   // Inputs, elevated surfaces
  };
  
  // Text hierarchy (4 levels)
  text: {
    primary: string;    // Main text
    secondary: string;  // Secondary text
    disabled: string;   // Disabled text
    inverse: string;    // Text on dark backgrounds
  };
  
  // Brand colors (2 colors)
  brand: {
    primary: string;    // Primary brand color
    secondary: string;  // Secondary brand color
  };
  
  // Semantic colors (4 colors)
  semantic: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  
  // UI elements (2 colors)
  ui: {
    border: string;     // Default border color
    focus: string;      // Focus state color
  };
}

// Design tokens for consistent styling
export interface CoreStyles {
  borderRadius: RadiusSize;
  radius?: RadiusSize; // Alias for backwards compatibility
  font?: {
    family: string;
    scale?: number;
  };
}

// Component-specific overrides (optional)
export interface ComponentOverrides {
  button?: {
    primary?: {
      background?: string;
      hover?: string;
      text?: string;
    };
    secondary?: {
      background?: string;
      hover?: string;
      text?: string;
    };
  };
  panel?: {
    background?: string;
    border?: string;
    radius?: RadiusSize;
  };
  swap?: {
    container?: {
      background?: string;
      radius?: RadiusSize;
      rounded?: string;
    };
    button?: {
      background?: string;
      hover?: string;
      disabled?: string;
      error?: string;
      radius?: RadiusSize;
    };
    input?: {
      background?: string;
      border?: string;
      borderHover?: string;
      borderFocus?: string;
    };
  };
}

// Swap page background configuration
export interface SwapPageBgConfig {
  css?: string; // Custom CSS for swap page background
  image?: string; // Background image URL
  opacity?: number; // Background opacity (0-1)
  height?: string; // CSS height value (e.g., "192px", "12rem")
}

// Background configuration
export interface BackgroundConfig {
  type?: 'gradient' | 'solid' | 'pattern' | 'custom';
  gradient?: string;
  solid?: string;
  image?: string;
  pattern?: string;
}

// Logo/branding configuration
export interface BrandingConfig {
  logoInvert?: number;
  logoBrightness?: number;
  logoHoverBrightness?: number;
  customPath?: string;
}

// Typography configuration
export interface TypographyConfig {
  fontFamily?: string;
  fontSize?: {
    xs?: string;
    sm?: string;
    base?: string;
    lg?: string;
    xl?: string;
  };
}

// Effects configuration
export interface EffectsConfig {
  enableNebula?: boolean;
  enableStars?: boolean;
  nebulaOpacity?: number;
  starsOpacity?: number;
  animations?: boolean;
  blur?: boolean;
}

// Core theme definition - simplified and focused
export interface CoreTheme {
  id: string;
  name: string;
  colorScheme: ColorScheme;
  author?: string;
  authorLink?: string;
  
  // Core colors (15 properties)
  colors: CoreColors;
  
  // Design tokens
  styles: CoreStyles;
  
  // Optional component overrides
  overrides?: ComponentOverrides;
  
  // Optional background configuration
  background?: BackgroundConfig;
  
  // Optional swap page background
  swapPageBg?: SwapPageBgConfig;
  
  // Optional branding configuration
  branding?: BrandingConfig;
  
  // Optional typography configuration
  typography?: TypographyConfig;
  
  // Optional effects configuration
  effects?: EffectsConfig;
}

// Type guards
export function isCoreTheme(theme: any): theme is CoreTheme {
  return theme && 'colors' in theme && 'bg' in theme.colors && 'text' in theme.colors;
}