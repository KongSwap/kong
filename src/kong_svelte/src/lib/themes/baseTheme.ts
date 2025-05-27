// Base theme definition with types and default values
export interface ThemeColors {
  // Background colors
  bgPrimary: string;      // Primary background (darkest)
  bgSecondary: string;    // Secondary background (medium)
  bgTertiary: string;     // Tertiary background (lightest)
  hoverBgSecondary?: string;  // Hover state for secondary background
  
  // Primary and secondary colors
  primary: string;
  primaryHover: string;
  secondary: string;
  secondaryHover: string;
  
  // Accent colors
  accent: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  muted: string;
  
  // Hover variants
  successHover: string;
  accentHover: string;
  errorHover: string;
  warningHover: string;
  infoHover: string;
  mutedHover: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  textLight?: string;
  textDark?: string;
  textOnPrimary?: string;
  textSuccess?: string;
  textAccent?: string;
  textError?: string;
  
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
  
  // Logo properties
  logoBrightness: number;
  logoInvert: number;
  logoHoverBrightness: number;
  logoPath?: string; // Custom logo path, defaults to standard app logo if not set
  
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
    bgPrimary: '#050813',       // Very deep navy, almost black for maximum contrast
    bgSecondary: '#0f1523',      // Noticeably lighter for clear panel separation
    bgTertiary: '#1a2335',      // Even lighter for nested elements
    hoverBgSecondary: '#1f2940', // Distinct hover state
    
    // Primary and secondary colors
    primary: '#1A8FE3',      // Refined Kong blue with better contrast
    primaryHover: '#0D7DCB', // Deeper hover variant
    secondary: '#38BEC9',    // Refined teal with better visibility
    secondaryHover: '#2EA8B3', // Deeper teal for hover state
    
    // Accent colors
    accent: '#3B82F6',   // Vibrant accessible blue
    error: '#F43F5E',    // Refined red with better contrast
    success: '#00D68F',  // Brighter green with more contrast
    warning: '#F59E0B', // Warmer, more accessible yellow
    info: '#3B82F6',    // Same as accent (blue)
    muted: '#6B7280',   // Gray color for muted elements
    
    // Hover variants
    successHover: '#00B778',
    accentHover: '#2563EB',
    errorHover: '#E11D48',
    warningHover: '#D97706', // Darker amber
    infoHover: '#2563EB',    // Same as accentHover
    mutedHover: '#4B5563',   // Darker gray
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#B0B6C5', // Brighter secondary text
    textDisabled: '#6B7280',
    textLight: '#ffffff',
    textDark: '#0D111F',
    textOnPrimary: '#0D111F',
    textSuccess: '#00D68F', // Same as accent-green
    textError: '#F43F5E',   // Same as accent-red
    textAccent: '#3B82F6',
    
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
    border: '#1f2940',
    borderLight: '#2a3650',
    
    // Logo properties
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 0.9,
    
    // Switch button styling
    switchButtonBg: '#0f1523',
    switchButtonHoverBg: '#1a2335',
    switchButtonBorder: '1px solid rgba(255, 255, 255, 0.1)',
    switchButtonShadow: '0 8px 32px rgba(0, 0, 0, 0.32)',
    
    // Chart text color
    chartTextColor: '#FFFFFF',
    
    // Token ticker styling
    tokenTickerBg: '#0f1523',
    tokenTickerText: '#FFFFFF',
    tokenTickerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    tokenTickerBorderStyle: 'default',
    tokenTickerRoundness: 'rounded-lg',
    tokenTickerHoverBg: '#1a2335',
    tokenTickerUpColor: '#00D68F',
    tokenTickerDownColor: '#F43F5E',
    tokenTickerBgOpacity: 100,
    
    // Button styling
    buttonBg: '#0f1523',
    buttonHoverBg: '#1a2335',
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
    backgroundGradient: 'linear-gradient(135deg, #050813 0%, #080b18 25%, #0a0e1b 50%, #080b18 75%, #050813 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundWidth: '100%',
    backgroundHeight: '100%',
    backgroundTop: '0',
    backgroundLeft: '0',
    backgroundRight: 'auto',
    backgroundBottom: '0',
    enableNebula: true,
    enableStars: false,
    nebulaOpacity: 0.3,
    starsOpacity: 0.2
  }
}; 