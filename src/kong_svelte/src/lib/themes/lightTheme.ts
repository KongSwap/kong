// Modern Light theme definition
import type { ThemeDefinition } from './baseTheme';

export const lightTheme: ThemeDefinition = {
  id: 'light',
  name: 'Modern Light',
  colorScheme: 'light',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  colors: {
    // Background colors - warmer, less bright
    bgPrimary: '#F5F3F0',      // Warmer beige background
    bgSecondary: '#FAF8F5',     // Softer cream for panels (was too white)
    bgTertiary: '#F0EEEB',      // Warm gray for depth
    hoverBgSecondary: '#EBE9E6', // Warm hover state
    
    // Primary and secondary colors - warm, earthy tones
    primary: '#7B6D5D',     // Warm brown - matches the warm theme
    primaryHover: '#6B5D4D', // Darker warm brown
    secondary: '#8B7F71',   // Muted taupe - complementary
    secondaryHover: '#7B6F61', // Darker taupe
    
    // Semantic colors - warm, muted for easier viewing
    accent: '#9B8B7E',  // Warm stone accent
    error: '#D09090',   // Soft terracotta for errors
    success: '#7FA37E', // Muted sage green
    warning: '#D4A056', // Muted amber (kept as is - works well)
    info: '#8B9BAE',    // Muted blue-gray
    muted: '#9B9AA2',   // Warm gray
    
    // Hover variants
    successHover: '#6F936E', // Darker sage green
    accentHover: '#8B7B6E',  // Darker warm stone
    errorHover: '#C08080',   // Darker terracotta
    warningHover: '#B88A4A', // Darker muted amber
    infoHover: '#7B8B9E',    // Darker blue-gray
    mutedHover: '#8B8A92',   // Darker warm gray
    
    // Text colors - warmer, easier on eyes
    textPrimary: '#3D3B37',  // Warm dark gray - easier than cool gray
    textSecondary: '#6B6966', // Warm medium gray
    textDisabled: '#A5A3A0', // Warm light gray
    textSuccess: '#6F936E', // Sage green
    textError: '#C08080',   // Soft terracotta
    textAccent: '#7B6D5D',  // Warm brown (matching primary)
    textOnPrimary: '#FFFFFF', // Pure white for better contrast on primary colors
    textLight: '#FAF8F5',      // Softer cream for light text
    textDark: '#3D3B37',       // Warm dark gray
    transparentSwapPanel: false,
    transparentPanel: false,
    
    // Font settings
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-lg', // Modern rounded corners
    swapPanelRoundness: 'rounded-xl', // Slightly more rounded for swap panels
    swapPanelBorder: '1px solid rgba(232, 230, 227, 0.8)', // Warm border matching new theme
    swapPanelShadow: 'shadow-sm', // Subtle shadow
    swapPanelInputsRounded: true, // Rounded inputs
    
    // Borders - warmer, more subtle
    border: '#E8E6E3',      // Warm gray border
    borderLight: '#F0EFED',  // Very light warm gray
    
    // Logo properties - adjust for light theme
    logoBrightness: 0.9,
    logoInvert: 1,           // Invert for dark logos on light background
    logoHoverBrightness: 0.8,
    
    // Swap Button styling - Professional light theme with depth
    swapButtonPrimaryGradientStart: '#5A9FD4', // Soft blue - more professional for light theme
    swapButtonPrimaryGradientEnd: '#4A8FC4',   // Deeper blue gradient
    swapButtonErrorGradientStart: '#E57373',   // Soft red for errors
    swapButtonErrorGradientEnd: '#D56363',     // Deeper red gradient
    swapButtonProcessingGradientStart: '#7986CB', // Soft indigo for processing
    swapButtonProcessingGradientEnd: '#6976BB',   // Deeper indigo
    swapButtonBorderColor: 'rgba(90, 159, 212, 0.3)', // Soft blue border
    swapButtonGlowColor: 'rgba(90, 159, 212, 0.35)',  // Blue glow for hover
    swapButtonShineColor: 'rgba(255, 255, 255, 0.6)', // Bright white shine
    swapButtonReadyGlowStart: '#66BB6A', // Vibrant green for ready state
    swapButtonReadyGlowEnd: '#56AB5A',   // Deeper green gradient
    swapButtonTextColor: '#FFFFFF', // Pure white text for better contrast
    swapButtonRoundness: 'rounded-full', // Full rounded
    swapButtonShadow: 'none', // No shadow for cleaner look
    
    // Chart text color
    chartTextColor: '#3D3B37',
    
    // Background configuration - warm, neutral gradient
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, rgba(245, 243, 240, 1) 0%, rgba(243, 241, 238, 1) 50%, rgba(241, 239, 236, 1) 100%)',
    backgroundOpacity: 1,
    enableNebula: false,
    enableStars: false,
  }
}; 