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
    // Background colors
    bgPrimary: '#16004A',      // Deep purple
    bgSecondary: '#2F0B68',     // Medium purple
    bgTertiary: '#3A1277',      // Lighter purple for tertiary
    hoverBgSecondary: '#3A1277', // Slightly lighter purple on hover
    
    // Primary and secondary colors
    primary: '#FF36AB',     // Hot pink
    primaryHover: '#E62E98', // Slightly darker pink
    secondary: '#00CCDD',   // Bright teal
    secondaryHover: '#00B6C5', // Darker teal
    
    // Semantic colors - vibrant neons for contrast
    accent: '#4D6CFA',  // Bright blue
    error: '#FF3864',   // Bright red/pink
    success: '#36F9B3', // Bright green
    warning: '#FFB951', // Amber/gold
    info: '#00CCDD',    // Bright teal/cyan
    muted: '#7E57C2',   // Muted purple
    
    // Hover variants - slightly darker versions
    successHover: '#2BE0A1', // Darker green
    accentHover: '#3555DE',  // Darker blue
    errorHover: '#E62954',   // Darker red
    warningHover: '#F5A43A', // Darker amber
    infoHover: '#00B3CC',    // Darker cyan
    mutedHover: '#6B47B2',   // Darker muted purple
    
    // Text colors
    textPrimary: '#FFFFFF',      // Pure white
    textSecondary: '#D1B8FF',    // Light lavender
    textDisabled: '#7E6D9E',     // Muted purple
    textLight: '#FFFFFF',        // White text
    textDark: '#16004A',         // Dark text
    textOnPrimary: '#16004A',    // White text on primary
    textSuccess: '#36F9B3',  // Same as success
    textError: '#FF3864',    // Same as error
    textAccent: '#4D6CFA',   // Same as accent
    
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
    
    // Logo properties - make it pop
    logoBrightness: 1.1,     // Slightly brighter
    logoInvert: 0,           // No inversion
    logoHoverBrightness: 1.3, // Brighter on hover
    
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
    nebulaOpacity: 0.4,      // Subtle nebula
    starsOpacity: 0.4       // Visible stars
  }
}; 