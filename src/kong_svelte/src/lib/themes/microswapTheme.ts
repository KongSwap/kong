// Light theme definition (Windows 98-inspired)
import type { ThemeDefinition } from './baseTheme';

export const microswapTheme: ThemeDefinition = {
  id: 'microswap',
  name: 'Windoge98 Microswap',
  colorScheme: 'light',
  author: 'Shill Gates',
  authorLink: 'https://windoge98.com',
  colors: {
    // Background colors
    bgPrimary: '#C3C3C3',      // Windows 98 light gray (primary)
    bgSecondary: '#e0e0e0',     // Windows 98 highlight color (secondary)
    bgTertiary: '#F0F0F0',      // Even lighter gray for tertiary
    hoverBgSecondary: '#D4D4D4', // Hover state
    
    // Primary and secondary colors
    primary: '#010081',     // Windows 98 blue
    primaryHover: '#000064', // Darker variant of Windows 98 blue
    secondary: '#008080',   // Windows 98 teal
    secondaryHover: '#006464', // Darker variant of teal
    
    // Semantic colors
    accent: '#010081',  // Windows 98 blue
    error: '#FF0081',   // Windows 98 pink/magenta
    success: '#008080', // Windows 98 teal as green
    warning: '#FFFF00', // Windows 98 yellow
    info: '#6F5DFB',    // Purple-blue
    muted: '#94A3B8',   // Gray   
    
    // Hover variants
    successHover: '#006464', // Darker teal
    accentHover: '#000064',  // Darker blue
    errorHover: '#C80064',   // Darker magenta
    warningHover: '#E6E600', // Darker yellow
    infoHover: '#5B4AE5',    // Darker purple-blue
    mutedHover: '#7C8BA1',   // Darker gray
    
    // Text colors
    textPrimary: '#000000',  // Windows 98 text
    textSecondary: '#323232', // Windows 98 dark gray
    textDisabled: '#818181', // Windows 98 dark gray
    textSuccess: '#008000', // More vibrant forest green
    textError: '#B00000',   // More vibrant deep red
    textAccent: '#00008B',  // Darker blue for better contrast on gray
    textOnPrimary: '#ffffff',
    textLight: '#ffffff',
    textDark: '#000000',
    
    // Font settings - Using Windows 98-style font
    fontFamily: "'Comic Sans MS', 'MS Sans Serif', 'Segoe UI', Arial, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-none', // Subtle roundness for the Windows 98 look
    swapPanelRoundness: 'rounded-none', // No rounded corners for Windows 98 style
    swapPanelBorder: 'none', // Turn off standard border - using shadow for 3D effect
    swapPanelShadow: 'shadow-sm', // Win95 3D border effect
    swapPanelInputsRounded: false, // Square inputs for Windows 98 style
    transparentSwapPanel: false, // Solid background for Win98 panels
    transparentPanel: false, // Solid background for Win98 panels
    swapPanelBorderStyle: 'win95', // Use the Win95 border style
    statsTableTransparent: false, // Use solid background for Win98 stats table
    
    // Borders
    border: '#818181',       // Windows 98 dark gray
    borderLight: '#FDFFFF',  // Windows 98 highlight color
    
    // Switch button specific styling - Win98 style
    switchButtonBg: '#C3C3C3',       // Standard Win98 gray for default state
    switchButtonHoverBg: '#D4D0C8',  // Slightly lighter gray for hover state
    switchButtonBorder: '#FDFFFF #818181 #818181 #FDFFFF', // Win98 3D border effect
    switchButtonShadow: 'inset 1px 1px 0 #FFFFFF, inset -1px -1px 0 #808080', // Win98 inner shadow
    
    // Swap Button styling for Win98 theme
    swapButtonPrimaryGradientStart: '#010081', // Windows 98 blue
    swapButtonPrimaryGradientEnd: '#000064',   // Darker Win98 blue
    swapButtonErrorGradientStart: '#FF0000',   // Win98 red
    swapButtonErrorGradientEnd: '#C80000',     // Darker Win98 red
    swapButtonProcessingGradientStart: '#C3C3C3', // Win98 gray
    swapButtonProcessingGradientEnd: '#D4D0C8',   // Lighter Win98 gray
    swapButtonBorderColor: '#FDFFFF #818181 #818181 #FDFFFF', // Win98 3D border colors
    swapButtonGlowColor: 'rgba(0, 0, 0, 0.1)', // Subtle glow effect for Win98
    swapButtonShineColor: 'rgba(255, 255, 255, 0.5)', // Shine effect color
    swapButtonReadyGlowStart: '#008080',  // Win98 teal
    swapButtonReadyGlowEnd: '#006464',    // Darker teal
    swapButtonTextColor: '#FFFFFF',       // White text for contrast
    swapButtonRoundness: 'rounded-none',  // Square corners for Win98 look
    swapButtonShadow: 'inset 1px 1px 0 #FFFFFF, inset -1px -1px 0 #808080', // Win98 inner shadow
    
    // Logo properties
    logoBrightness: 0.9,
    logoInvert: 0,
    logoHoverBrightness: 0.65,
    logoPath: '/images/microswap-logo.webp', // Custom Windows 98 style logo
    
    // Chart text color
    chartTextColor: '#334155', // Darker blue-gray for better contrast
    
    // Token ticker styling
    tokenTickerBg: '#C3C3C3',           // Windows 98 light gray background (same as bgPrimary)
    tokenTickerText: '#000000',         // Black text
    tokenTickerBorder: '1px solid #818181', // Windows 98 gray border
    tokenTickerBorderStyle: 'win95',    // Windows 95 style 3D border
    tokenTickerRoundness: 'rounded-none', // Square corners for Win98 style
    tokenTickerHoverBg: '#E1E6F0',      // Slight highlight on hover
    tokenTickerUpColor: '#008000',      // More vibrant forest green for price increase
    tokenTickerDownColor: '#B00000',    // More vibrant deep red for price decrease
    tokenTickerBgOpacity: 100,          // Solid background (100% opacity)
    
    // Button styling for win98 theme
    buttonBg: '#C3C3C3',               // Standard button background
    buttonHoverBg: '#E1E6F0',          // Button hover background 
    buttonText: '#000000',             // Button text color
    buttonBorder: '2px solid',         // Button border width and style
    buttonBorderColor: '#FDFFFF #818181 #818181 #FDFFFF', // Win98 3D border effect
    buttonShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF', // Win98 inner shadow
    buttonRoundness: 'rounded-none',   // No rounded corners for Win98
    
    // Primary button styling (for important actions)
    primaryButtonBg: '#010081',        // Win98 blue background
    primaryButtonHoverBg: '#000064',   // Darker blue on hover
    primaryButtonText: '#FFFFFF',      // White text for contrast
    primaryButtonBorder: '2px solid',  // Same border width/style
    primaryButtonBorderColor: '#0000A8 #000050 #000050 #0000A8', // 3D effect with matching colors
    
    // Background configuration
    backgroundType: 'pattern',
    backgroundImage: '/backgrounds/cloudbg.jpg', // Windoge splash image in backgrounds directory
    backgroundOpacity: 1.0, // Full opacity
    backgroundFallbackGradient: 'rgb(var(--bg-primary))',
    
    // Enhanced background configuration for Windows 98 sky
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundWidth: '100%',
    backgroundHeight: '100%',
    backgroundTop: '0',
    backgroundLeft: '0',
    backgroundRight: 'auto',
    backgroundBottom: 'auto',
    
    // Disable special effects for authentic Windows 98 look
    enableNebula: false,
    enableStars: false,
  }
}; 