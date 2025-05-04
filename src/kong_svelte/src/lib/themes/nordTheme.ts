// Example Custom Theme - Demonstrates how to create a new theme programmatically
import type { ThemeDefinition } from './baseTheme';

/**
 * Nord color palette reference:
 * Polar Night (dark)
 * - nord0: #2E3440
 * - nord1: #3B4252
 * - nord2: #434C5E
 * - nord3: #4C566A
 * 
 * Snow Storm (light)
 * - nord4: #D8DEE9
 * - nord5: #E5E9F0
 * - nord6: #ECEFF4
 * 
 * Frost (blues)
 * - nord7: #8FBCBB
 * - nord8: #88C0D0
 * - nord9: #81A1C1
 * - nord10: #5E81AC
 * 
 * Aurora (accent)
 * - nord11: #BF616A (red)
 * - nord12: #D08770 (orange)
 * - nord13: #EBCB8B (yellow)
 * - nord14: #A3BE8C (green)
 * - nord15: #B48EAD (purple)
 */

// Nord-inspired theme with cool blues and soft contrasts
export const nordTheme: ThemeDefinition = {
  id: 'nord',
  name: 'Nordic',
  colorScheme: 'dark',
  author: 'Shill Gates',
  authorLink: 'https://www.windoge98.com/',
  colors: {
    // Background colors
    bgDark: '#2E3440',      // nord0 - Polar Night darkest
    bgLight: '#3B4252',     // nord1 - Polar Night lighter
    hoverBgLight: '#434C5E', // nord2 - Polar Night hover
    
    // Primary and secondary colors
    primary: '#88C0D0',     // nord8 - Frost light blue
    primaryHover: '#81A1C1', // nord9 - Frost medium blue
    secondary: '#5E81AC',   // nord10 - Frost dark blue
    secondaryHover: '#4C6A92', // Darker variant of nord10
    
    // Accent colors - using the aurora palette for accents
    accentBlue: '#81A1C1',  // nord9 - Frost medium blue
    accentRed: '#BF616A',   // nord11 - Aurora red
    accentGreen: '#A3BE8C', // nord14 - Aurora green
    accentYellow: '#EBCB8B', // nord13 - Aurora yellow
    accentPurple: '#B48EAD', // nord15 - Aurora purple
    accentCyan: '#8FBCBB',   // nord7 - Frost cyan
    
    // Hover variants - slightly darker shades of the accent colors
    accentGreenHover: '#97B67E', // Darker green
    accentBlueHover: '#7393B3',  // Darker blue
    accentRedHover: '#B3555E',   // Darker red
    accentYellowHover: '#E1C079', // Darker yellow
    
    // Text colors - using Snow Storm palette for text
    textLight: '#ECEFF4',
    textDark: '#2E3440',
    textPrimary: '#ECEFF4',  // nord6 - Snow Storm lightest
    textSecondary: '#D8DEE9', // nord4 - Snow Storm medium
    textDisabled: '#ADB5BD', // Desaturated text
    textOnPrimary: '#2E3440', // nord0 - Dark text on primary color backgrounds
    textAccentGreen: '#A3BE8C', // nord14 - Same as accent green
    textAccentRed: '#BF616A',   // nord11 - Same as accent red
    textAccentBlue: '#81A1C1',  // nord9 - Same as accent blue
    
    // Font settings - Using a clean font that complements the Nord theme
    fontFamily: "'Inter', 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-md', // Slightly less rounded corners for Nord's minimalist style
    swapPanelRoundness: 'rounded-lg', // Slightly more rounded for swap panels
    swapPanelBorder: '1px solid #4C566A', // Nord's border color
    swapPanelShadow: 'shadow-sm',
    swapPanelInputsRounded: true,
    transparentSwapPanel: false,
    transparentPanel: false,
    
    // Borders - using Polar Night palette for borders
    border: '#4C566A',       // nord3 - Polar Night light
    borderLight: '#434C5E',  // nord2 - Polar Night medium
    
    // Surface colors - similar to background colors but can be used for cards and containers
    surfaceDark: '#2E3440',  // nord0 - Same as bg-dark
    surfaceLight: '#3B4252', // nord1 - Same as bg-light
    
    // Logo properties
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 0.9,
    
    // Chart text color
    chartTextColor: '#ECEFF4', // nord6 - Snow Storm lightest for chart text
    
    // Plugin Manager colors
    pmDark: '#292E39',       // Slightly darker than bg-dark
    pmBorder: '#4C566A',     // nord3 - Same as border
    pmAccent: '#B48EAD',     // nord15 - Aurora purple
    pmTextSecondary: '#D8DEE9', // nord4 - Snow Storm medium
    
    // Swap Button styling - using Nord colors
    swapButtonPrimaryGradientStart: '#88C0D0', // nord8 - Frost light blue
    swapButtonPrimaryGradientEnd: '#81A1C1',   // nord9 - Frost medium blue
    swapButtonErrorGradientStart: '#BF616A',   // nord11 - Aurora red
    swapButtonErrorGradientEnd: '#B3555E',     // Darker red
    swapButtonProcessingGradientStart: '#B48EAD', // nord15 - Aurora purple
    swapButtonProcessingGradientEnd: '#A57A9C',   // Darker purple
    swapButtonBorderColor: 'rgba(216, 222, 233, 0.2)', // nord4 with transparency
    swapButtonGlowColor: 'rgba(136, 192, 208, 0.5)', // nord8 with transparency
    swapButtonShineColor: 'rgba(236, 239, 244, 0.3)', // nord6 with transparency
    swapButtonReadyGlowStart: '#A3BE8C', // nord14 - Aurora green
    swapButtonReadyGlowEnd: '#97B67E',   // Darker green
    swapButtonTextColor: '#ECEFF4', // nord0 - Dark text for contrast
    swapButtonRoundness: 'rounded-md', // Matching panel roundness
    swapButtonShadow: '0 4px 12px rgba(46, 52, 64, 0.2)', // nord0 with transparency
    
    // Background configuration
    backgroundType: 'pattern',
    backgroundOpacity: 0.2, // Reduced opacity so it doesn't overpower the UI
    enableNebula: false,
    enableStars: false,
    nebulaOpacity: 0.2,
  }
}; 