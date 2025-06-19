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
  textWarning?: string;
  textInfo?: string;
  textMuted?: string;
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
  backgroundFallbackGradient?: string; // Gradient to use on non-swap pages when using pattern background
  
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
    // Background colors - Professional slate-based palette
    bgPrimary: '#0C0F17',       // Deep charcoal with subtle blue undertone
    bgSecondary: '#141925',      // Slightly lighter for clear visual hierarchy
    bgTertiary: '#1D2433',      // Elevated surface color
    hoverBgSecondary: '#242B3D', // Clear interactive state
    
    // Primary and secondary colors - Sophisticated blue palette
    primary: '#4A7CFF',      // Professional bright blue
    primaryHover: '#3B6CE6', // Deeper blue on interaction
    secondary: '#00D4AA',    // Vibrant teal accent
    secondaryHover: '#00B896', // Deeper teal for hover
    
    // Accent colors - Balanced and accessible
    accent: '#4F46E5',   // Darker indigo for better contrast with white text
    error: '#DC2626',    // Darker red for better contrast with white text
    success: '#059669',  // Darker green for better contrast with white text
    warning: '#D97706',  // Darker amber for better contrast with white text
    info: '#2563EB',     // Darker blue for better contrast with white text
    muted: '#6B7280',    // Neutral gray
    
    // Hover variants
    successHover: '#047857',
    accentHover: '#4338CA',
    errorHover: '#B91C1C',
    warningHover: '#B45309',
    infoHover: '#1D4ED8',
    mutedHover: '#4B5563',
    
    // Text colors - High contrast and readable
    textPrimary: '#F9FAFB',      // Almost white for primary text
    textSecondary: '#9CA3AF',    // Softer gray for secondary
    textDisabled: '#6B7280',     // Muted for disabled states
    textLight: '#F9FAFB',
    textDark: '#111827',
    textOnPrimary: '#FFFFFF',
    textSuccess: '#ECFDF5',
    textError: '#FEF2F2',
    textAccent: '#FFFFFF',
    textWarning: '#FFFBEB',
    textInfo: '#EFF6FF',
    textMuted: '#F3F4F6',

    // Font settings
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings - Modern and clean
    panelRoundness: 'rounded-xl',
    swapPanelRoundness: 'rounded-2xl',
    swapPanelBorder: '1px solid rgba(255, 255, 255, 0.08)',
    swapPanelShadow: 'shadow-xl',
    swapPanelInputsRounded: true,
    transparentSwapPanel: false,
    transparentPanel: false,
    swapPanelBorderStyle: 'default',
    statsTableTransparent: false,
    
    // Borders - Subtle definition
    border: '#1F2937',
    borderLight: '#374151',
    
    // Logo properties
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 1.1,
    
    // Switch button styling
    switchButtonBg: '#1D2433',
    switchButtonHoverBg: '#242B3D',
    switchButtonBorder: '1px solid rgba(255, 255, 255, 0.06)',
    switchButtonShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
    
    // Chart text color
    chartTextColor: '#F9FAFB',
    
    // Token ticker styling
    tokenTickerBg: '#141925',
    tokenTickerText: '#F9FAFB',
    tokenTickerBorder: '1px solid rgba(255, 255, 255, 0.06)',
    tokenTickerBorderStyle: 'default',
    tokenTickerRoundness: 'rounded-xl',
    tokenTickerHoverBg: '#1D2433',
    tokenTickerUpColor: '#10B981',
    tokenTickerDownColor: '#EF4444',
    tokenTickerBgOpacity: 100,
    
    // Button styling - Clean and modern
    buttonBg: '#1D2433',
    buttonHoverBg: '#242B3D',
    buttonText: '#F9FAFB',
    buttonBorder: '1px solid rgba(255, 255, 255, 0.06)',
    buttonBorderColor: 'rgba(255, 255, 255, 0.06)',
    buttonShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    buttonRoundness: 'rounded-xl',
    
    // Primary button styling
    primaryButtonBg: '#4A7CFF',
    primaryButtonHoverBg: '#3B6CE6',
    primaryButtonText: '#FFFFFF',
    primaryButtonBorder: 'none',
    primaryButtonBorderColor: 'transparent',
    
    // Swap Button styling - Premium feel
    swapButtonPrimaryGradientStart: '#4A7CFF',
    swapButtonPrimaryGradientEnd: '#3B6CE6',
    swapButtonErrorGradientStart: '#EF4444',
    swapButtonErrorGradientEnd: '#DC2626',
    swapButtonProcessingGradientStart: '#8B5CF6',
    swapButtonProcessingGradientEnd: '#7C3AED',
    swapButtonBorderColor: 'rgba(255, 255, 255, 0.1)',
    swapButtonGlowColor: '#4A7CFF',
    swapButtonShineColor: '#60A5FA',
    swapButtonReadyGlowStart: '#4A7CFF',
    swapButtonReadyGlowEnd: '#3B6CE6',
    swapButtonTextColor: '#FFFFFF',
    swapButtonRoundness: 'rounded-2xl',
    swapButtonShadow: '0 8px 32px rgba(74, 124, 255, 0.25)',
    
    // Background configuration - Subtle gradient
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(180deg, #0C0F17 0%, #0F1219 50%, #0C0F17 100%)',
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
    nebulaOpacity: 0.15,
    starsOpacity: 0.1
  }
}; 