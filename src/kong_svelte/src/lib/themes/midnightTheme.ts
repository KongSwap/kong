// Plain Black theme definition
import type { ThemeDefinition } from './baseTheme';

export const midnightTheme: ThemeDefinition = {
  id: 'plain-black',
  name: 'Midnight',
  colorScheme: 'dark',
  author: 'Shill Gates',
  authorLink: 'https://www.windoge98.com/',
  colors: {
    // Background colors
    bgPrimary: '#000000',      // Pure black
    bgSecondary: '#121212',     // Very dark gray
    bgTertiary: '#1E1E1E',      // Slightly lighter gray for tertiary
    hoverBgSecondary: '#1E1E1E', // Slightly lighter for more prominent hover
    
    // Primary and secondary colors
    primary: '#0095EB',     // Kong's brand blue
    primaryHover: '#0086D3', // Darker variant
    secondary: '#22D3EE',
    secondaryHover: '#0EA5E9',
    
    // Semantic colors
    accent: '#00A7FF',  // Brighter blue
    error: '#FF4545',   // Vibrant red
    success: '#05EC86', // Vibrant green
    warning: '#FFC107', // Material Yellow
    info: '#22D3EE',    // Cyan
    muted: '#4B5563',   // Gray
    
    // Hover variants
    successHover: '#04CE75',
    accentHover: '#0090DC',
    errorHover: '#EB3737',
    warningHover: '#FFA726', // Darker yellow
    infoHover: '#1DBBD8',    // Darker cyan
    mutedHover: '#374151',   // Darker gray
    
    // Text colors
    textPrimary: '#FFFFFF',  // Pure white
    textOnPrimary: '#000000',
    textSecondary: '#CCCCCC', // Light gray
    textDisabled: '#666666', // Medium gray
    textSuccess: '#05EC86', // Same as success
    textError: '#FF4545',   // Same as error
    textAccent: '#0095EB',
    textLight: '#FFFFFF',      // White for light text needs
    textDark: '#121212',       // Very dark gray for dark text needs
    
    // Font settings
    fontFamily: "'IBM Plex Mono', monospace",
    
    // UI settings
    panelRoundness: 'rounded', // Sharp corners for the brutalist plain-black theme
    swapPanelRoundness: 'rounded', // No rounded corners for brutalist style
    swapPanelBorder: '2px solid rgba(0, 0, 0, 1)', // Bright border for contrast
    swapPanelShadow: 'shadow-none', // No shadow for brutalist style
    swapPanelInputsRounded: false, // Sharp corners for all elements
    transparentSwapPanel: false,
    transparentPanel: false,
    
    // Borders
    border: '#000',
    borderLight: '#232735',
    
    // Logo properties
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 0.9,
    
    // Swap Button styling - Brutalist plain black
    swapButtonPrimaryGradientStart: '#0095EB', // Kong's brand blue
    swapButtonPrimaryGradientEnd: '#0086D3',   // Darker blue
    swapButtonErrorGradientStart: '#FF4545',   // Vibrant red
    swapButtonErrorGradientEnd: '#EB3737',     // Darker red
    swapButtonProcessingGradientStart: '#6F5DFB', // Vibrant purple
    swapButtonProcessingGradientEnd: '#5B49D5',   // Darker purple
    swapButtonBorderColor: 'rgba(255, 255, 255, 0.1)', // White border for high contrast
    swapButtonGlowColor: 'rgba(0, 149, 235, 0.6)',  // Blue glow
    swapButtonShineColor: 'rgba(255, 255, 255, 0.3)', // White shine
    swapButtonReadyGlowStart: '#05EC86', // Vibrant green
    swapButtonReadyGlowEnd: '#04CE75',   // Darker green
    swapButtonTextColor: '#FFFFFF', // White text
    swapButtonRoundness: 'rounded-full', // Sharp corners
    swapButtonShadow: 'none', // No shadow
    
    // Background configuration
    backgroundType: 'solid',
    backgroundSolid: '#0f0f0f', // Pure black background
    enableNebula: false,
    enableStars: true,
    starsOpacity: 0.3 // Higher opacity for stars in pure black theme
  }
}; 