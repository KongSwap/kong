// Base theme definition with types and default values
export interface ThemeColors {
  // Background colors
  bgDark: string;
  bgLight: string;
  hoverBgLight?: string;
  
  // Primary and secondary colors
  primary: string;
  primaryHover: string;
  secondary: string;
  secondaryHover: string;
  
  // Accent colors
  accentBlue: string;
  accentRed: string;
  accentGreen: string;
  accentYellow: string;
  accentPurple: string;
  accentCyan: string;
  
  // Hover variants
  accentGreenHover: string;
  accentBlueHover: string;
  accentRedHover: string;
  accentYellowHover?: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  textLight?: string;
  textDark?: string;
  textOnPrimary?: string;
  textAccentGreen?: string;
  textAccentBlue?: string;
  textAccentRed?: string;
  
  // Font settings
  fontFamily?: string;
  
  // UI Settings
  panelRoundness?: "rounded-none" | "rounded-sm" | "rounded" | "rounded-md" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full";
  swapPanelRoundness?: "rounded-none" | "rounded-sm" | "rounded" | "rounded-md" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full";
  swapPanelBorder?: string;
  swapPanelShadow?: string;
  swapPanelInputsRounded?: boolean;
  transparentSwapPanel?: boolean;
  transparentPanel?: boolean;
  swapPanelBorderStyle?: 'default' | 'win95' | 'none'; // Special border style presets
  statsTableTransparent?: boolean;   // Whether the stats table panel should be transparent or solid
  
  // Borders
  border: string;
  borderLight: string;
  kongBorder?: string;
  
  // Surface colors
  surfaceDark: string;
  surfaceLight: string;
  
  // Logo properties
  logoBrightness: number;
  logoInvert: number;
  logoHoverBrightness: number;
  logoPath?: string; // Custom logo path, defaults to standard app logo if not set
  
  // Token selector dropdown colors
  tokenSelectorBg?: string;
  tokenSelectorHeaderBg?: string;
  tokenSelectorItemBg?: string;
  tokenSelectorItemHoverBg?: string;
  tokenSelectorItemActiveBg?: string;
  tokenSelectorSearchBg?: string;
  tokenSelectorBorder?: string;
  tokenSelectorRoundness?: "rounded-none" | "rounded-sm" | "rounded" | "rounded-md" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full";
  tokenSelectorShadow?: string;
  
  // Plugin Manager colors
  pmDark: string;
  pmBorder: string;
  pmAccent: string;
  pmTextSecondary: string;
  
  // Switch button styling
  switchButtonBg?: string;         // Background color for the switch button
  switchButtonHoverBg?: string;    // Background color for the switch button on hover
  switchButtonBorder?: string;     // Border style for the switch button
  switchButtonShadow?: string;     // Shadow style for the switch button
  
  // Chart text color
  chartTextColor?: string;
  
  // Token ticker styling
  tokenTickerBg?: string;          // Background color for token tickers
  tokenTickerText?: string;        // Text color for token tickers
  tokenTickerBorder?: string;      // Border style for token tickers
  tokenTickerBorderStyle?: 'default' | 'win95' | 'none'; // Special border style presets
  tokenTickerRoundness?: "rounded-none" | "rounded-sm" | "rounded" | "rounded-md" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full";
  tokenTickerHoverBg?: string;     // Background color on hover
  tokenTickerShadow?: string;      // Shadow style for token tickers
  tokenTickerUpColor?: string;     // Color for positive price changes
  tokenTickerDownColor?: string;   // Color for negative price changes
  tokenTickerBgOpacity?: number;   // Background opacity (0-100)
  
  // Button styling
  buttonBg?: string;               // Standard button background color
  buttonHoverBg?: string;          // Button hover background color
  buttonText?: string;             // Button text color
  buttonBorder?: string;           // Button border width and style
  buttonBorderColor?: string;      // Button border color
  buttonShadow?: string;           // Button shadow
  buttonRoundness?: "rounded-none" | "rounded-sm" | "rounded" | "rounded-md" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full";
  
  // Primary button styling
  primaryButtonBg?: string;        // Primary button background color
  primaryButtonHoverBg?: string;   // Primary button hover background color
  primaryButtonText?: string;      // Primary button text color
  primaryButtonBorder?: string;    // Primary button border width and style
  primaryButtonBorderColor?: string; // Primary button border color
  
  // Swap Button styling
  swapButtonPrimaryGradientStart?: string; // Start color for the primary gradient
  swapButtonPrimaryGradientEnd?: string;   // End color for the primary gradient
  swapButtonErrorGradientStart?: string;   // Start color for the error gradient
  swapButtonErrorGradientEnd?: string;     // End color for the error gradient
  swapButtonProcessingGradientStart?: string; // Start color for the processing gradient
  swapButtonProcessingGradientEnd?: string;   // End color for the processing gradient
  swapButtonBorderColor?: string;          // Border color for the swap button
  swapButtonGlowColor?: string;            // Glow effect color
  swapButtonShineColor?: string;           // Shine animation color
  swapButtonReadyGlowStart?: string;       // Start color for the ready glow effect
  swapButtonReadyGlowEnd?: string;         // End color for the ready glow effect
  swapButtonTextColor?: string;            // Text color for the swap button
  swapButtonRoundness?: "rounded-none" | "rounded-sm" | "rounded" | "rounded-md" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full";
  swapButtonShadow?: string;               // Shadow for the swap button
  
  // Background configuration
  backgroundType: 'gradient' | 'solid' | 'pattern' | 'custom';
  backgroundGradient?: string;
  backgroundSolid?: string;
  backgroundImage?: string;
  backgroundOpacity?: number;
  
  // Expanded background configuration for more flexibility
  backgroundSize?: string;        // CSS background-size (e.g., 'cover', 'contain', '100% 100%')
  backgroundPosition?: string;    // CSS background-position (e.g., 'center', 'top left')
  backgroundRepeat?: string;      // CSS background-repeat (e.g., 'no-repeat', 'repeat')
  backgroundWidth?: string;       // Width of background element (e.g., '100%', '500px')
  backgroundHeight?: string;      // Height of background element (e.g., '100%', '500px')
  backgroundTop?: string;         // Top position of background element (e.g., '0', '10px')
  backgroundLeft?: string;        // Left position of background element (e.g., '0', '10px')
  backgroundRight?: string;       // Right position of background element (e.g., '0', 'auto')
  backgroundBottom?: string;      // Bottom position of background element (e.g., '0', 'auto')
  
  // Parallax effect
  enableParallax?: boolean;       // Whether to enable parallax effect on the background
  parallaxStrength?: number;      // Strength of parallax effect (0.0-1.0, default 0.2)
  
  // Special effects
  enableNebula?: boolean;
  enableStars?: boolean;
  nebulaOpacity?: number;
  starsOpacity?: number;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  colors: ThemeColors;
  colorScheme: 'light' | 'dark';
  author?: string;
  authorLink?: string;
}

// Base theme default values (dark theme)
export const baseTheme: ThemeDefinition = {
  id: 'dark',
  name: 'Dark',
  colorScheme: 'dark',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  colors: {
    // Background colors
    bgDark: '#090c17',       // Even deeper navy for more contrast
    bgLight: '#1a2032',      // Lighter, more distinct navy for more contrast
    hoverBgLight: '#141826', // Same as bgLight by default in dark theme
    
    // Primary and secondary colors
    primary: '#1A8FE3',      // Refined Kong blue with better contrast
    primaryHover: '#0D7DCB', // Deeper hover variant
    secondary: '#38BEC9',    // Refined teal with better visibility
    secondaryHover: '#2EA8B3', // Deeper teal for hover state
    
    // Accent colors
    accentBlue: '#3B82F6',   // Vibrant accessible blue
    accentRed: '#F43F5E',    // Refined red with better contrast
    accentGreen: '#00D68F',  // Brighter green with more contrast
    accentYellow: '#F59E0B', // Warmer, more accessible yellow
    accentPurple: '#8B5CF6', // Refined purple with better visibility
    accentCyan: '#06B6D4',   // Brighter cyan for better highlights
    
    // Hover variants
    accentGreenHover: '#00B778',
    accentBlueHover: '#2563EB',
    accentRedHover: '#E11D48',
    accentYellowHover: '#D97706', // Darker amber
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#B0B6C5', // Brighter secondary text
    textDisabled: '#6B7280',
    textLight: '#ffffff',
    textDark: '#0D111F',
    textOnPrimary: '#0D111F',
    textAccentGreen: '#00D68F', // Same as accent-green
    textAccentRed: '#F43F5E',   // Same as accent-red
    textAccentBlue: '#3B82F6',
    
    // Font settings
    fontFamily: "'Exo 2', 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-lg', // Default panel roundness
    swapPanelRoundness: 'rounded-xl', // Swap panels are slightly more rounded
    swapPanelBorder: '1px solid rgba(255, 255, 255, 0.1)',
    swapPanelShadow: 'shadow-sm',
    swapPanelInputsRounded: true,
    transparentSwapPanel: true, // Default to transparent swap panels
    transparentPanel: true,
    swapPanelBorderStyle: 'default',
    statsTableTransparent: true, // Default to transparent stats table for modern look
    
    // Borders
    border: '#1C202E',
    borderLight: '#232735',
    
    // Surface colors
    surfaceDark: '#111523',
    surfaceLight: '#181C2A',
    
    // Logo properties
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 0.9,
    
    // Token selector dropdown colors
    tokenSelectorBg: '#111523',
    tokenSelectorHeaderBg: '#181C2A',
    tokenSelectorItemBg: '#1C202E',
    tokenSelectorItemHoverBg: '#232735',
    tokenSelectorItemActiveBg: '#282C3A',
    tokenSelectorSearchBg: '#232735',
    tokenSelectorBorder: '1px solid rgba(255, 255, 255, 0.1)',
    tokenSelectorRoundness: 'rounded-lg',
    tokenSelectorShadow: '0 8px 32px rgba(0, 0, 0, 0.32)',
    
    // Plugin Manager colors
    pmDark: '#171923',
    pmBorder: '#282C3A',
    pmAccent: '#8B5CF6', // Same as accent-purple
    pmTextSecondary: '#9EA4BA',
    
    // Switch button styling
    switchButtonBg: '#111523',
    switchButtonHoverBg: '#232735',
    switchButtonBorder: '1px solid rgba(255, 255, 255, 0.1)',
    switchButtonShadow: '0 8px 32px rgba(0, 0, 0, 0.32)',
    
    // Chart text color
    chartTextColor: '#FFFFFF',
    
    // Token ticker styling
    tokenTickerBg: '#111523',
    tokenTickerText: '#FFFFFF',
    tokenTickerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    tokenTickerBorderStyle: 'default',
    tokenTickerRoundness: 'rounded-lg',
    tokenTickerHoverBg: '#232735',
    tokenTickerShadow: '0 8px 32px rgba(0, 0, 0, 0.32)',
    tokenTickerUpColor: '#00D68F',
    tokenTickerDownColor: '#F43F5E',
    tokenTickerBgOpacity: 100,
    
    // Button styling
    buttonBg: '#111523',
    buttonHoverBg: '#232735',
    buttonText: '#FFFFFF',
    buttonBorder: '1px solid rgba(255, 255, 255, 0.1)',
    buttonBorderColor: '#FFFFFF',
    buttonShadow: '0 8px 32px rgba(0, 0, 0, 0.32)',
    buttonRoundness: 'rounded-lg',
    
    // Primary button styling
    primaryButtonBg: '#1A8FE3',
    primaryButtonHoverBg: '#0D7DCB',
    primaryButtonText: '#FFFFFF',
    primaryButtonBorder: '1px solid rgba(255, 255, 255, 0.1)',
    primaryButtonBorderColor: '#FFFFFF',
    
    // Swap Button styling
    swapButtonPrimaryGradientStart: '#1A8FE3',
    swapButtonPrimaryGradientEnd: '#0D6EAF',
    swapButtonErrorGradientStart: '#F43F5E',
    swapButtonErrorGradientEnd: '#BE123C',
    swapButtonProcessingGradientStart: '#8B5CF6',
    swapButtonProcessingGradientEnd: '#6D28D9',
    swapButtonBorderColor: 'rgba(255, 255, 255, 0.15)',
    swapButtonGlowColor: '#1A8FE3',
    swapButtonShineColor: '#38BDC9',
    swapButtonReadyGlowStart: '#1A8FE3',
    swapButtonReadyGlowEnd: '#0D6EAF',
    swapButtonTextColor: '#FFFFFF',
    swapButtonRoundness: 'rounded-full',
    swapButtonShadow: '0 8px 32px rgba(0, 0, 0, 0.32)',
    
    // Background configuration
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(180deg, rgb(2, 6, 23) 0%, rgb(10, 15, 35) 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundWidth: '100%',
    backgroundHeight: '100%',
    backgroundTop: '0',
    backgroundLeft: '0',
    backgroundRight: 'auto',
    backgroundBottom: '0',
    enableParallax: false,
    enableNebula: true,
    enableStars: false,
    nebulaOpacity: 0.4,
    starsOpacity: 0.2
  }
}; 