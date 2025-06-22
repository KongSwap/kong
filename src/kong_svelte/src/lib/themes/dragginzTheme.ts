// Dragginz Theme - Fantasy-inspired theme with mystical forest colors
import type { ThemeDefinition } from './baseTheme';

export const dragginzTheme: ThemeDefinition = {
  id: 'dragginz',
  name: 'Dragginz',
  colorScheme: 'dark',
  author: 'Shill Gates',
  authorLink: 'https://windoge98.com',
  colors: {
    // Background colors
    bgPrimary: '#0A1F19',       // Deep forest green
    bgSecondary: '#122925',      // Lighter forest green
    bgTertiary: '#173631',       // Even lighter for tertiary
    hoverBgSecondary: '#173631', // Slightly lighter for hover states
    
    // Primary and secondary colors
    primary: '#FF5722',      // Dragon orange from logo
    primaryHover: '#E64A19', // Darker orange variant
    secondary: '#22C9D3',    // Cyan blue (from character's hair)
    secondaryHover: '#1BA8B1',
    
    // Semantic colors
    accent: '#22C9D3',   // Cyan blue
    error: '#FF1744',    // Brighter, cooler red for contrast
    success: '#1FA754',  // Darker green for better contrast with white text
    warning: '#FFB74D', // Warm yellow
    info: '#26C6DA',    // Cyan
    muted: '#5D6673',   // Dark gray   
    
    // Hover variants
    successHover: '#198F46',
    accentHover: '#1BA8B1',
    errorHover: '#D50000',   // Darker version of the brighter red
    warningHover: '#FFA726',
    infoHover: '#1FB3C5',    // Darker cyan
    mutedHover: '#4B5560',   // Darker gray
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#B8E6DD', // Brighter greenish-white for better readability
    textDisabled: '#7A8D89',
    textLight: '#E0F7FA',
    textDark: '#0A1F19',
    textOnPrimary: '#FFFFFF',
    textSuccess: '#4BEA80',
    textError: '#FF5722',
    textAccent: '#22C9D3',
    
    // Font settings - updating to a more fantasy-style font that fits the MMO theme
    fontFamily: "'Caudex', 'Almendra', 'Exo 2', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings - more rounded panels for a softer fantasy feel
    panelRoundness: 'rounded',
    swapPanelRoundness: 'rounded',
    swapPanelBorder: '1px solid rgba(255, 255, 255, 0.2)',
    swapPanelShadow: 'shadow-sm',
    swapPanelInputsRounded: true,
    transparentSwapPanel: true,
    transparentPanel: true,
    swapPanelBorderStyle: 'default',
    statsTableTransparent: true,
    
    // Borders - subtly enhanced for better visibility
    border: '#1E3B35',
    borderLight: '#2C534A',
    
    // Logo properties
    logoBrightness: 1.05,
    logoInvert: 0,
    logoHoverBrightness: 1.15,
    logoPath: '/images/logo-white-wide.webp', // Using the dragon logo
    
    // Switch button styling - more fantasy-themed
    switchButtonBg: '#112420',
    switchButtonHoverBg: '#2C534A',
    switchButtonBorder: '1px solid rgba(255, 255, 255, 0.25)',
    switchButtonShadow: '0 8px 32px rgba(0, 0, 0, 0.32), 0 0 10px rgba(75, 234, 128, 0.15)',
    
    // Chart text color
    chartTextColor: '#FFFFFF',
    
    // Token ticker styling - enhanced with more "magical" appearance
    tokenTickerBg: 'rgba(17, 36, 32, 0.85)',
    tokenTickerText: '#FFFFFF',
    tokenTickerBorder: '1px solid rgba(255, 255, 255, 0.25)',
    tokenTickerBorderStyle: 'default',
    tokenTickerRoundness: 'rounded-xl',
    tokenTickerHoverBg: 'rgba(44, 83, 74, 0.9)',
    tokenTickerUpColor: '#4BEA80',
    tokenTickerDownColor: '#FF5722',
    tokenTickerBgOpacity: 85,
    
    // Button styling - more magical-looking buttons
    buttonBg: 'rgba(17, 36, 32, 0.9)',
    buttonHoverBg: 'rgba(44, 83, 74, 0.95)',
    buttonText: '#FFFFFF',
    buttonBorder: '1px solid rgba(255, 255, 255, 0.25)',
    buttonBorderColor: 'rgba(255, 255, 255, 0.3)',
    buttonShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 0 10px rgba(34, 201, 211, 0.15)',
    buttonRoundness: 'rounded',
    
    // Primary button styling - vibrant orange like the dragon
    primaryButtonBg: 'rgba(255, 87, 34, 0.95)',
    primaryButtonHoverBg: 'rgba(230, 74, 25, 0.98)',
    primaryButtonText: '#FFFFFF',
    primaryButtonBorder: '1px solid rgba(255, 255, 255, 0.3)',
    primaryButtonBorderColor: 'rgba(255, 255, 255, 0.4)',
    
    // Swap Button styling - more magical glow effects
    swapButtonPrimaryGradientStart: '#FF5722',
    swapButtonPrimaryGradientEnd: '#E64A19',
    swapButtonErrorGradientStart: '#F44336',
    swapButtonErrorGradientEnd: '#D32F2F',
    swapButtonProcessingGradientStart: '#9C64A6',
    swapButtonProcessingGradientEnd: '#7B4F83',
    swapButtonBorderColor: 'rgba(255, 255, 255, 0.3)',
    swapButtonGlowColor: 'rgba(255, 112, 67, 0.7)',
    swapButtonShineColor: 'rgba(255, 87, 34, 0.8)',
    swapButtonReadyGlowStart: 'rgba(75, 234, 128, 0.7)',
    swapButtonReadyGlowEnd: 'rgba(58, 217, 112, 0.8)',
    swapButtonTextColor: '#FFFFFF',
    swapButtonRoundness: 'rounded',
    swapButtonShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 87, 34, 0.25)',
    
    // Background configuration
    backgroundType: 'pattern',
    backgroundImage: '/backgrounds/dragginzbg1.jpg',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundOpacity: 100,
    enableNebula: false,
    enableStars: false,
  }
}; 