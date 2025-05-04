// Synthwave Theme - A retro-futuristic theme inspired by 80s aesthetics and sunset colors
import type { ThemeDefinition } from './baseTheme';

/**
 * Synthwave color palette reference:
 * - Backgrounds: Deep purples and blues
 * - Gradients: Sunset-like transitions (purple to pink to orange)
 * - Accents: Bright neon pink, purple, and teal
 * - Style: 80s retro-futuristic vibes
 */

export const synthwaveTheme: ThemeDefinition = {
  id: 'synthwave',
  name: 'Synthwave Sunset',
  colorScheme: 'dark',
  author: 'Shill Gates',
  authorLink: 'https://windoge98.com',
  colors: {
    // Background colors - deep purple
    bgDark: '#16004A',      // Deep purple
    bgLight: '#2F0B68',     // Medium purple
    hoverBgLight: '#3A1277', // Slightly lighter purple on hover
    
    // Primary and secondary colors
    primary: '#FF36AB',     // Hot pink
    primaryHover: '#E62E98', // Slightly darker pink
    secondary: '#00CCDD',   // Bright teal
    secondaryHover: '#00B6C5', // Darker teal
    
    // Accent colors - vibrant neons for contrast
    accentBlue: '#4D6CFA',  // Bright blue
    accentRed: '#FF3864',   // Bright red/pink
    accentGreen: '#36F9B3', // Bright green
    accentYellow: '#FFB951', // Amber/gold
    accentPurple: '#9D54FF', // Bright purple
    accentCyan: '#00CCDD',   // Bright teal/cyan
    
    // Hover variants - slightly darker versions
    accentGreenHover: '#2BE0A1', // Darker green
    accentBlueHover: '#3555DE',  // Darker blue
    accentRedHover: '#E62954',   // Darker red
    accentYellowHover: '#F5A43A', // Darker amber
    
    // Text colors
    textPrimary: '#FFFFFF',      // Pure white
    textSecondary: '#D1B8FF',    // Light lavender
    textDisabled: '#7E6D9E',     // Muted purple
    textLight: '#FFFFFF',        // White text
    textDark: '#16004A',         // Dark text
    textOnPrimary: '#16004A',    // White text on primary
    textAccentGreen: '#36F9B3',  // Same as accent green
    textAccentRed: '#FF3864',    // Same as accent red
    textAccentBlue: '#4D6CFA',   // Same as accent blue
    
    // Font settings - modern monospace fonts with retro-futuristic feel
    fontFamily: "'Major Mono Display', 'Share Tech Mono', 'Space Mono', 'IBM Plex Mono', monospace",
    
    // UI settings
    panelRoundness: 'rounded-md', // Less rounded corners
    swapPanelRoundness: 'rounded-lg', // Slightly more rounded for swap panels
    swapPanelBorder: '1px solid rgba(255, 54, 171, 0.3)', // Pink border
    swapPanelShadow: 'shadow', // Pink/purple glow
    swapPanelInputsRounded: true,
    transparentSwapPanel: true,
    transparentPanel: true,
    
    // Borders
    border: '#401C7A',      // Dark purple border
    borderLight: '#5C3195', // Light purple border
    
    // Surface colors
    surfaceDark: '#18004F',  // Dark purple for cards
    surfaceLight: '#2F0B68', // Medium purple for panels
    
    // Logo properties - make it pop
    logoBrightness: 1.1,     // Slightly brighter
    logoInvert: 0,           // No inversion
    logoHoverBrightness: 1.3, // Brighter on hover
    
    // Plugin Manager colors
    pmDark: '#16004A',       // Same as bg-dark
    pmBorder: '#5C3195',     // Same as border-light
    pmAccent: '#9D54FF',     // Purple accent
    pmTextSecondary: '#D1B8FF', // Same as text-secondary
    
    // Chart text color
    chartTextColor: '#FFFFFF', // White for chart text
    
    // Button styling
    buttonBg: '#33146E',       // Deep purple button background
    buttonHoverBg: '#471D8A',  // Slightly lighter purple on hover
    buttonText: '#D1B8FF',     // Light lavender text
    buttonBorder: '1px solid', // Standard border width
    buttonBorderColor: 'rgba(255, 54, 171, 0.4)', // Pink border with transparency
    buttonShadow: '0 0 10px rgba(255, 54, 171, 0.2)', // Subtle pink glow
    buttonRoundness: 'rounded-md', // Matching panel roundness
    
    // Primary button styling - hot pink with glow
    primaryButtonBg: '#FF36AB',     // Hot pink background
    primaryButtonHoverBg: '#FF45B5', // Brighter pink on hover
    primaryButtonText: '#FFFFFF',   // White text
    primaryButtonBorder: '1px solid', // Standard border width
    primaryButtonBorderColor: 'rgba(255, 54, 171, 0.7)', // More pronounced pink border
    
    // Swap Button styling - refined retro-futuristic neon style
    swapButtonPrimaryGradientStart: '#FF36AB', // Hot pink start
    swapButtonPrimaryGradientEnd: '#E62E98',   // Slightly darker pink end for more cohesive look
    swapButtonErrorGradientStart: '#FF3864',   // Bright red/pink start
    swapButtonErrorGradientEnd: '#E62954',     // Darker red end
    swapButtonProcessingGradientStart: '#9D54FF', // Purple start
    swapButtonProcessingGradientEnd: '#7A1F7C',   // Darker purple end
    swapButtonBorderColor: 'rgba(255, 54, 171, 0.6)', // More visible pink border
    swapButtonGlowColor: 'rgba(255, 54, 171, 0.8)', // Softer pink glow
    swapButtonShineColor: 'rgba(255, 255, 255, 0.3)', // White shine for better contrast
    swapButtonReadyGlowStart: '#9D54FF', // Bright purple start
    swapButtonReadyGlowEnd: '#7A1F7C',   // Darker purple end
    swapButtonTextColor: '#FFFFFF', // White text
    swapButtonRoundness: 'rounded-md', // Matching panel roundness
    swapButtonShadow: '0 0 20px rgba(255, 54, 171, 0.5), 0 0 10px rgba(157, 84, 255, 0.3)', // Enhanced pink/purple glow
    
    // Background configuration - sunset gradient
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #16004A 0%, #2F0B68 25%, #5B1A9A 50%, #7A1F7C 75%, #AA307F 100%)',
    backgroundOpacity: 1,
    enableNebula: true,      // Enable nebula effect
    enableStars: true,       // Enable stars
    enableSkyline: true,     // Enable skyline for 80s city vibe
    nebulaOpacity: 0.4,      // Subtle nebula
    starsOpacity: 0.7        // Visible stars
  }
}; 