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
    bgDark: '#000000',      // Pure black
    bgLight: '#121212',     // Very dark gray
    hoverBgLight: '#1E1E1E', // Slightly lighter for more prominent hover
    
    // Primary and secondary colors
    primary: '#0095EB',     // Kong's brand blue
    primaryHover: '#0086D3', // Darker variant
    secondary: '#22D3EE',
    secondaryHover: '#0EA5E9',
    
    // Accent colors
    accentBlue: '#00A7FF',  // Brighter blue
    accentRed: '#FF4545',   // Vibrant red
    accentGreen: '#05EC86', // Vibrant green
    accentYellow: '#FFC107', // Material Yellow
    accentPurple: '#6F5DFB', // Vibrant purple
    accentCyan: '#22D3EE',
    
    // Hover variants
    accentGreenHover: '#04CE75',
    accentBlueHover: '#0090DC',
    accentRedHover: '#EB3737',
    accentYellowHover: '#FFA726', // Darker yellow
    
    // Text colors
    textPrimary: '#FFFFFF',  // Pure white
    textSecondary: '#CCCCCC', // Light gray
    textDisabled: '#666666', // Medium gray
    textAccentGreen: '#05EC86', // Same as accent-green
    textAccentRed: '#FF4545',   // Same as accent-red
    textAccentBlue: '#0095EB',
    textLight: '#FFFFFF',      // White for light text needs
    textDark: '#121212',       // Very dark gray for dark text needs
    
    // Font settings
    fontFamily: "'IBM Plex Mono', monospace",
    
    // UI settings
    panelRoundness: 'rounded', // Sharp corners for the brutalist plain-black theme
    swapPanelRoundness: 'rounded', // No rounded corners for brutalist style
    swapPanelBorder: '2px solid rgba(255, 255, 255, 0.3)', // Bright border for contrast
    swapPanelShadow: 'shadow-none', // No shadow for brutalist style
    swapPanelInputsRounded: false, // Sharp corners for all elements
    transparentSwapPanel: false,
    transparentPanel: false,
    
    // Borders
    border: '#333333',
    borderLight: '#232735',
    
    // Surface colors
    surfaceDark: '#121212',
    surfaceLight: '#1A1A1A',
    
    // Logo properties
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 0.9,
    
    // Plugin Manager colors
    pmDark: '#171717',
    pmBorder: '#282828',
    pmAccent: '#6F5DFB', // Same as accent-purple
    pmTextSecondary: '#9EA4BA',
    
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
    backgroundSolid: '#000000', // Pure black background
    enableNebula: false,
    enableStars: true,
    starsOpacity: 0.3 // Higher opacity for stars in pure black theme
  }
}; 