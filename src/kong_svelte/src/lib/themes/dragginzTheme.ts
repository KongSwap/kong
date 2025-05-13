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
    bgDark: '#0A1F19',       // Deep forest green
    bgLight: '#122925',      // Lighter forest green
    hoverBgLight: '#173631', // Slightly lighter for hover states
    
    // Primary and secondary colors
    primary: '#FF5722',      // Dragon orange from logo
    primaryHover: '#E64A19', // Darker orange variant
    secondary: '#22C9D3',    // Cyan blue (from character's hair)
    secondaryHover: '#1BA8B1',
    
    // Accent colors
    accentBlue: '#22C9D3',   // Cyan blue
    accentRed: '#FF1744',    // Brighter, cooler red for contrast
    accentGreen: '#4BEA80',  // Brighter mystical green (like the baby dragon)
    accentYellow: '#FFB74D', // Warm yellow
    accentPurple: '#9C64A6', // Mystical purple
    accentCyan: '#26C6DA',   
    
    // Hover variants
    accentGreenHover: '#3AD970',
    accentBlueHover: '#1BA8B1',
    accentRedHover: '#D50000',   // Darker version of the brighter red
    accentYellowHover: '#FFA726',
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#B8E6DD', // Brighter greenish-white for better readability
    textDisabled: '#7A8D89',
    textLight: '#E0F7FA',
    textDark: '#0A1F19',
    textOnPrimary: '#FFFFFF',
    textAccentGreen: '#4BEA80',
    textAccentRed: '#FF5722',
    textAccentBlue: '#22C9D3',
    
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
    
    // Surface colors - slightly more vibrant
    surfaceDark: '#112420',
    surfaceLight: '#183A35',
    
    // Logo properties
    logoBrightness: 1.05,
    logoInvert: 0,
    logoHoverBrightness: 1.15,
    logoPath: '/images/dkp.png', // Using the dragon logo
    
    // Token selector dropdown colors - more distinct with fantasy theme colors
    tokenSelectorBg: '#0F201C',
    tokenSelectorHeaderBg: '#183A35',
    tokenSelectorItemBg: '#1E3B35',
    tokenSelectorItemHoverBg: '#2C534A',
    tokenSelectorItemActiveBg: '#346259',
    tokenSelectorSearchBg: '#2C534A',
    tokenSelectorBorder: '1px solid rgba(255, 255, 255, 0.2)',
    tokenSelectorRoundness: 'rounded',
    tokenSelectorShadow: '0 12px 35px rgba(0, 0, 0, 0.45), 0 0 15px rgba(34, 201, 211, 0.15)',
    
    // Plugin Manager colors
    pmDark: '#0F2019',
    pmBorder: '#2C534A',
    pmAccent: '#9C64A6', // Purple accent
    pmTextSecondary: '#B8E6DD',
    
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
    tokenTickerShadow: '0 8px 32px rgba(0, 0, 0, 0.32), 0 0 15px rgba(34, 201, 211, 0.15)',
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
    enableParallax: false,
    parallaxStrength: 0, // Slightly reduced for subtlety
    enableNebula: false,
    enableStars: true,
    starsOpacity: 0.4
  }
}; 