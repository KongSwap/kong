// Modern Light theme definition
import type { ThemeDefinition } from './baseTheme';

export const lightTheme: ThemeDefinition = {
  id: 'light',
  name: 'Modern Light',
  colorScheme: 'light',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  colors: {
    // Background colors - fresh greens and warm yellows
    bgPrimary: '#FAFEF5',      // Soft mint cream background
    bgSecondary: '#FFFFF9',     // Clean ivory for panels
    bgTertiary: '#F0F8E8',      // Pale green tint for depth
    hoverBgSecondary: '#E8F5E0', // Fresh green hover state
    
    // Primary and secondary colors - vibrant Kong theme
    primary: '#4A8F2D',     // Rich jungle green - KongSwap primary
    primaryHover: '#3A7F1D', // Deeper jungle green
    secondary: '#FFD700',   // Pure gold yellow - Kong's banana
    secondaryHover: '#F0C800', // Richer gold on hover
    
    // Semantic colors - tropical palette
    accent: '#A4D65E',  // Fresh lime green accent
    error: '#E57373',   // Coral red for errors (more vibrant)
    success: '#66BB6A', // Vibrant success green
    warning: '#FFB300', // Bright banana yellow
    info: '#7CB342',    // Fresh leaf green for info
    muted: '#B8D4A8',   // Soft mint green
    
    // Hover variants
    successHover: '#5CAF5A', // Richer success green
    accentHover: '#94C64E',  // Deeper lime green
    errorHover: '#D56363',   // Deeper coral
    warningHover: '#FFA000', // Deeper banana yellow
    infoHover: '#6CA332',    // Richer leaf green
    mutedHover: '#A8C498',   // Deeper mint green
    
    // Text colors - crisp and readable
    textPrimary: '#1A3409',  // Deep jungle green
    textSecondary: '#4A6B3A', // Soft forest green
    textDisabled: '#9CB894', // Pale green-gray
    textSuccess: '#4A8F2D', // Primary green for success
    textError: '#D56363',   // Coral red
    textAccent: '#3A7F1D',  // Rich green accent
    textOnPrimary: '#FFFFFF', // Pure white for contrast
    textLight: '#FFFFF9',      // Clean ivory for light text
    textDark: '#1A3409',       // Deep jungle green
    transparentSwapPanel: false,
    transparentPanel: false,
    
    // Font settings
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-lg', // Modern rounded corners
    swapPanelRoundness: 'rounded-xl', // Slightly more rounded for swap panels
    swapPanelBorder: '1px solid rgba(164, 214, 94, 0.25)', // Soft lime border
    swapPanelShadow: 'shadow-md', // Medium shadow for depth
    swapPanelInputsRounded: true, // Rounded inputs
    
    // Borders - vibrant green accents
    border: '#D4E8C4',      // Soft green border
    borderLight: '#E8F5E0',  // Very light mint border
    
    // Logo properties - adjust for light theme
    logoBrightness: 0.9,
    logoInvert: 1,           // Invert for dark logos on light background
    logoHoverBrightness: 0.8,
    
    // Swap Button styling - Vibrant Kong theme
    swapButtonPrimaryGradientStart: '#66BB6A', // Fresh green
    swapButtonPrimaryGradientEnd: '#4A8F2D',   // Rich jungle green gradient
    swapButtonErrorGradientStart: '#FF6B6B',   // Bright coral for errors
    swapButtonErrorGradientEnd: '#E57373',     // Deeper coral gradient
    swapButtonProcessingGradientStart: '#FFD700', // Pure gold for processing
    swapButtonProcessingGradientEnd: '#FFB300',   // Rich banana yellow
    swapButtonBorderColor: 'rgba(164, 214, 94, 0.4)', // Lime border
    swapButtonGlowColor: 'rgba(164, 214, 94, 0.5)',  // Bright lime glow for hover
    swapButtonShineColor: 'rgba(255, 255, 255, 0.7)', // Bright white shine
    swapButtonReadyGlowStart: '#A4D65E', // Fresh lime for ready state
    swapButtonReadyGlowEnd: '#7CB342',   // Leaf green gradient
    swapButtonTextColor: '#FFFFFF', // Pure white text for better contrast
    swapButtonRoundness: 'rounded-full', // Full rounded
    swapButtonShadow: '0 4px 15px rgba(164, 214, 94, 0.3)', // Soft lime shadow
    
    // Chart text color
    chartTextColor: '#1A3409',
    
    // Background configuration - tropical gradient
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, rgba(250, 254, 245, 1) 0%, rgba(240, 248, 232, 1) 25%, rgba(255, 253, 235, 1) 75%, rgba(255, 255, 249, 1) 100%)',
    backgroundOpacity: 1,
    enableNebula: false,
    enableStars: false,
  }
}; 