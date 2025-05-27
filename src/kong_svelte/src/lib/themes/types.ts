// Simplified theme type definitions

// Core color palette - the essential colors that define a theme
export interface ThemePalette {
  // Background hierarchy
  background: {
    primary: string;    // Main background (darkest/lightest)
    secondary: string;  // Elevated surfaces
    tertiary: string;   // Higher elevation
  };
  
  // Text hierarchy
  text: {
    primary: string;    // Main text
    secondary: string;  // Muted text
    disabled: string;   // Disabled state
    inverse: string;    // Text on inverted backgrounds
  };
  
  // Brand colors
  brand: {
    primary: string;    // Primary brand color
    secondary: string;  // Secondary brand color
  };
  
  // Semantic colors
  semantic: {
    success: string;    // Success/positive states
    error: string;      // Error/negative states
    warning: string;    // Warning states
    info: string;       // Informational states
  };
  
  // UI colors
  ui: {
    border: string;     // Default border
    borderLight: string; // Light border variant
    focus: string;      // Focus states
    hover: string;      // Hover backgrounds
  };
}

// Visual styling properties
export interface ThemeStyles {
  // Typography
  font: {
    family: string;
    scale?: number;     // Base font size scale
  };
  
  // Border radius scale
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  
  // Shadows
  shadow: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  
  // Opacity values
  opacity: {
    panel?: number;     // Panel background opacity (0-1)
    blur?: number;      // Backdrop blur amount
  };
}

// Component-specific overrides
export interface ThemeComponents {
  // Button variations
  button?: {
    primary?: Partial<ButtonStyle>;
    secondary?: Partial<ButtonStyle>;
    ghost?: Partial<ButtonStyle>;
  };
  
  // Panel variations
  panel?: {
    default?: Partial<PanelStyle>;
    swap?: Partial<PanelStyle>;
    stats?: Partial<PanelStyle>;
  };
  
  // Special components
  swapButton?: Partial<SwapButtonStyle>;
  tokenTicker?: Partial<TokenTickerStyle>;
  tokenSelector?: Partial<TokenSelectorStyle>;
}

// Background configuration
export interface ThemeBackground {
  type: 'solid' | 'gradient' | 'image' | 'custom';
  value: string;      // Color, gradient string, or image URL
  
  // Optional effects
  effects?: {
    nebula?: boolean;
    stars?: boolean;
    opacity?: number;
  };
  
  // Image-specific options
  image?: {
    size?: string;
    position?: string;
    repeat?: string;
  };
}

// Logo configuration
export interface ThemeLogo {
  brightness: number;     // 0-2
  invert: boolean;       // Invert colors
  customPath?: string;   // Optional custom logo
}

// Complete theme definition
export interface Theme {
  id: string;
  name: string;
  author?: string;
  colorScheme: 'light' | 'dark';
  
  // Core theme properties
  palette: ThemePalette;
  styles: ThemeStyles;
  
  // Optional customizations
  components?: ThemeComponents;
  background?: ThemeBackground;
  logo?: ThemeLogo;
}

// Component style interfaces
interface ButtonStyle {
  background: string;
  color: string;
  border?: string;
  borderColor?: string;
  shadow?: string;
  radius?: string;
  hoverBackground?: string;
}

interface PanelStyle {
  background?: string;
  border?: string;
  shadow?: string;
  radius?: string;
  transparent?: boolean;
}

interface SwapButtonStyle {
  background: string | { start: string; end: string };
  color: string;
  border?: string;
  shadow?: string;
  radius?: string;
  glow?: string;
  errorBackground?: string | { start: string; end: string };
  processingBackground?: string | { start: string; end: string };
}

interface TokenTickerStyle {
  background: string;
  color: string;
  border?: string;
  shadow?: string;
  radius?: string;
  upColor?: string;
  downColor?: string;
  opacity?: number;
}

interface TokenSelectorStyle {
  background: string;
  itemBackground: string;
  itemHoverBackground: string;
  border?: string;
  shadow?: string;
  radius?: string;
} 