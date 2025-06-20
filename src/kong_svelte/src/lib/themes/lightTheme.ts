// Modern Light theme definition
import type { ThemeDefinition } from './baseTheme';

export const lightTheme: ThemeDefinition = {
  id: 'light',
  name: 'Modern Light',
  colorScheme: 'light',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  colors: {
    // Background colors - darker warm creams and soft yellows
    bgPrimary: '#F5F1E8',      // Darker warm cream background
    bgSecondary: '#F8F5ED',     // Darker muted ivory for panels
    bgTertiary: '#F2EDE0',      // Darker warm yellow tint for depth
    hoverBgSecondary: '#EDDEC8', // Darker honey hover state
    
    // Primary and secondary colors - softer warmer greens and yellows
    primary: '#8BC269',     // Lighter soft green - KongSwap primary
    primaryHover: '#7AB559', // Slightly deeper soft green
    secondary: '#E6BC35',   // Muted golden yellow - Kong's banana
    secondaryHover: '#D6AC25', // Deeper muted gold on hover
    
    // Semantic colors - softer warmer tropical palette
    accent: '#A6C255',  // Softer lime green accent
    error: '#D68973',   // Softer peach-coral for errors
    success: '#70B56A', // Softer success green
    warning: '#E6A628', // Muted amber yellow
    info: '#82A653',    // Softer leaf green for info
    muted: '#B8C4A0',   // Softer sage green
    
    // Hover variants
    successHover: '#60A55A', // Softer success green hover
    accentHover: '#96B245',  // Softer lime green hover
    errorHover: '#C67963',   // Softer peach-coral hover
    warningHover: '#D69618', // Muted amber yellow hover
    infoHover: '#729643',    // Softer leaf green hover
    mutedHover: '#A8B490',   // Softer sage green hover
    
    // Text colors - softer and more readable
    textPrimary: '#3A4A2A',  // Softer deep green
    textSecondary: '#6A7B5A', // Softer forest green
    textDisabled: '#A6B29E', // Softer pale green-gray
    textSuccess: '#568B38', // Softer sage green for success
    textError: '#C67963',   // Softer peach-coral
    textAccent: '#467B28',  // Softer green accent
    textOnPrimary: '#FDFBF6', // Soft ivory for contrast
    textLight: '#FAF8F3',      // Muted cream for light text
    textDark: '#3A4A2A',       // Softer deep green
    transparentSwapPanel: false,
    transparentPanel: false,
    
    // Font settings
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-lg', // Modern rounded corners
    swapPanelRoundness: 'rounded-xl', // Slightly more rounded for swap panels
    swapPanelBorder: '1px solid rgba(184, 214, 94, 0.25)', // Warm lime border
    swapPanelShadow: 'shadow-md', // Medium shadow for depth
    swapPanelInputsRounded: true, // Rounded inputs
    
    // Borders - softer warm accents
    border: '#DED8C8',      // Softer warm border
    borderLight: '#F0EBE0',  // Softer light border
    
    // Logo properties - adjust for light theme
    logoBrightness: 0.9,
    logoInvert: 1,           // Invert for dark logos on light background
    logoHoverBrightness: 0.8,
    
    // Swap Button styling - Softer Kong theme
    swapButtonPrimaryGradientStart: '#70B56A', // Softer green
    swapButtonPrimaryGradientEnd: '#568B38',   // Softer sage green gradient
    swapButtonErrorGradientStart: '#E69B8A',   // Softer coral for errors
    swapButtonErrorGradientEnd: '#D68973',     // Softer peach-coral gradient
    swapButtonProcessingGradientStart: '#E6BC35', // Muted gold for processing
    swapButtonProcessingGradientEnd: '#D6AC25',   // Muted amber yellow
    swapButtonBorderColor: 'rgba(166, 194, 85, 0.3)', // Softer lime border
    swapButtonGlowColor: 'rgba(166, 194, 85, 0.4)',  // Softer lime glow for hover
    swapButtonShineColor: 'rgba(255, 255, 255, 0.5)', // Softer white shine
    swapButtonReadyGlowStart: '#A6C255', // Softer lime for ready state
    swapButtonReadyGlowEnd: '#82A653',   // Softer leaf green gradient
    swapButtonTextColor: '#FDFBF6', // Soft ivory text for better contrast
    swapButtonRoundness: 'rounded-full', // Full rounded
    swapButtonShadow: '0 4px 12px rgba(166, 194, 85, 0.25)', // Softer lime shadow
    
    // Chart text color
    chartTextColor: '#3A4A2A',
    
    // Background configuration - darker warm gradient
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, rgba(245, 241, 232, 1) 0%, rgba(242, 237, 224, 1) 25%, rgba(245, 241, 232, 1) 75%, rgba(248, 245, 237, 1) 100%)',
    backgroundOpacity: 1,
    enableNebula: false,
    enableStars: false,
  }
}; 