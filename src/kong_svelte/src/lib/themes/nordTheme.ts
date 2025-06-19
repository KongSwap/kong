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
    bgPrimary: '#2E3440',      // nord0 - Polar Night darkest
    bgSecondary: '#3B4252',     // nord1 - Polar Night lighter
    bgTertiary: '#434C5E',      // nord2 - Polar Night tertiary
    hoverBgSecondary: '#434C5E', // nord2 - Polar Night hover
    
    // Primary and secondary colors
    primary: '#88C0D0',     // nord8 - Frost light blue
    primaryHover: '#81A1C1', // nord9 - Frost medium blue
    secondary: '#5E81AC',   // nord10 - Frost dark blue
    secondaryHover: '#4C6A92', // Darker variant of nord10
    
    // Semantic colors - using the aurora palette for accents
    accent: '#81A1C1',  // nord9 - Frost medium blue
    error: '#D08770',   // nord12 - Aurora orange (more visible than red)
    success: '#8FBCBB', // nord7 - Frost light (more visible than green)
    warning: '#EBCB8B', // nord13 - Aurora yellow
    info: '#88C0D0',    // nord8 - Frost
    muted: '#4C566A',   // nord3 - Polar Night
    
    // Hover variants - slightly darker shades of the accent colors
    successHover: '#7FA9A8', // Darker frost
    accentHover: '#7393B3',  // Darker blue
    errorHover: '#C17762',   // Darker orange
    warningHover: '#E1C079', // Darker yellow
    infoHover: '#7BAFC0',    // Darker Frost
    mutedHover: '#434C5E',   // nord2 - Darker Polar Night
    
    // Text colors - using Snow Storm palette for text
    textLight: '#ECEFF4',
    textDark: '#2E3440',
    textPrimary: '#ECEFF4',  // nord6 - Snow Storm lightest
    textSecondary: '#D8DEE9', // nord4 - Snow Storm medium
    textDisabled: '#ADB5BD', // Desaturated text
    textOnPrimary: '#2E3440', // nord0 - Dark text on primary color backgrounds
    textSuccess: '#8FBCBB', // nord7 - Same as success
    textError: '#D08770',   // nord12 - Same as error
    textAccent: '#81A1C1',  // nord9 - Same as accent
    
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
    
    // Logo properties
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 0.9,
    
    // Chart text color
    chartTextColor: '#ECEFF4', // nord6 - Snow Storm lightest for chart text
    
    // Swap Button styling - using Nord colors
    swapButtonPrimaryGradientStart: '#88C0D0', // nord8 - Frost light blue
    swapButtonPrimaryGradientEnd: '#81A1C1',   // nord9 - Frost medium blue
    swapButtonErrorGradientStart: '#D08770',   // nord12 - Aurora orange
    swapButtonErrorGradientEnd: '#C17762',     // Darker orange
    swapButtonProcessingGradientStart: '#B48EAD', // nord15 - Aurora purple
    swapButtonProcessingGradientEnd: '#A57A9C',   // Darker purple
    swapButtonBorderColor: 'rgba(216, 222, 233, 0.2)', // nord4 with transparency
    swapButtonGlowColor: 'rgba(136, 192, 208, 0.5)', // nord8 with transparency
    swapButtonShineColor: 'rgba(236, 239, 244, 0.3)', // nord6 with transparency
    swapButtonReadyGlowStart: '#8FBCBB', // nord7 - Frost light
    swapButtonReadyGlowEnd: '#7FA9A8',   // Darker frost
    swapButtonTextColor: '#ECEFF4', // nord0 - Dark text for contrast
    swapButtonRoundness: 'rounded-full', // Matching panel roundness
    swapButtonShadow: '0 4px 12px rgba(46, 52, 64, 0.2)', // nord0 with transparency
    
    // Background configuration
    backgroundType: 'solid',
    backgroundSolid: 'rgb(var(--bg-primary))',
    backgroundOpacity: 1.0,
    enableNebula: false,
    enableStars: false,
  }
}; 