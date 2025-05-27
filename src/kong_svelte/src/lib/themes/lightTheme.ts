// Modern Light theme definition
import type { ThemeDefinition } from './baseTheme';

export const lightTheme: ThemeDefinition = {
  id: 'light',
  name: 'Modern Light',
  colorScheme: 'light',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  colors: {
    // Background colors
    bgPrimary: '#f5f5f5',      // Light gray/blue (lightest for light theme)
    bgSecondary: '#F5F7FA',     // White
    bgTertiary: '#EEF1F5',      // Slightly darker for tertiary
    hoverBgSecondary: '#EEF1F5', // Slightly darker for hover
    
    // Primary and secondary colors
    primary: '#2563EB',     // Modern blue
    primaryHover: '#1D4ED8', // Darker blue
    secondary: '#0EA5E9',   // Sky blue
    secondaryHover: '#0284C7', // Darker sky blue
    
    // Semantic colors
    accent: '#3B82F6',  // Modern blue
    error: '#EF4444',   // Modern red
    success: '#10B981', // Modern green
    warning: '#F59E0B', // Modern amber
    info: '#3B82F6',    // Modern blue (same as accent)
    muted: '#94A3B8',   // Slate 400
    
    // Hover variants
    successHover: '#059669', // Darker green
    accentHover: '#2563EB',  // Darker blue
    errorHover: '#DC2626',   // Darker red
    warningHover: '#D97706', // Darker amber
    infoHover: '#2563EB',    // Darker blue
    mutedHover: '#64748B',   // Slate 500
    
    // Text colors
    textPrimary: '#1E293B',  // Slate 800
    textSecondary: '#475569', // Slate 600
    textDisabled: '#94A3B8', // Slate 400
    textSuccess: '#059669', // Green 600
    textError: '#DC2626',   // Red 600
    textAccent: '#2563EB',  // Blue 600
    textOnPrimary: '#fff',
    textLight: '#FFFFFF',      // White for light text needs
    textDark: '#1E293B',       // Slate 800 for dark text needs
    transparentSwapPanel: false,
    transparentPanel: false,
    
    // Font settings
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-lg', // Modern rounded corners
    swapPanelRoundness: 'rounded-xl', // Slightly more rounded for swap panels
    swapPanelBorder: '1px solid rgba(203, 213, 225, 0.5)', // Light border
    swapPanelShadow: 'shadow-sm', // Modern shadow
    swapPanelInputsRounded: true, // Rounded inputs
    
    // Borders
    border: '#E2E8F0',      // Slate 200
    borderLight: '#F1F5F9',  // Slate 100
    
    // Logo properties - adjust for light theme
    logoBrightness: 0.9,
    logoInvert: 1,           // Invert for dark logos on light background
    logoHoverBrightness: 0.8,
    
    // Swap Button styling - Modern Light theme
    swapButtonPrimaryGradientStart: '#2563EB', // Modern blue
    swapButtonPrimaryGradientEnd: '#1D4ED8',   // Darker blue
    swapButtonErrorGradientStart: '#EF4444',   // Modern red
    swapButtonErrorGradientEnd: '#DC2626',     // Darker red
    swapButtonProcessingGradientStart: '#8B5CF6', // Modern purple
    swapButtonProcessingGradientEnd: '#7C3AED',   // Darker purple
    swapButtonBorderColor: 'rgba(59, 130, 246, 0.3)', // Blue border with transparency
    swapButtonGlowColor: 'rgba(37, 99, 235, 0.4)',  // Primary blue glow
    swapButtonShineColor: 'rgba(255, 255, 255, 0.6)', // White shine
    swapButtonReadyGlowStart: '#10B981', // Modern green
    swapButtonReadyGlowEnd: '#059669',   // Darker green
    swapButtonTextColor: '#FFFFFF', // White text for contrast
    swapButtonRoundness: 'rounded-full', // Match swap panel roundness
    swapButtonShadow: '0 4px 8px rgba(37, 99, 235, 0.2)', // Subtle blue shadow
    
    // Chart text color
    chartTextColor: '#1E293B',
    
    // Background configuration
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, rgba(235, 241, 250, 1) 0%, rgba(229, 237, 248, 1) 50%, rgba(242, 247, 255, 1) 100%)',
    backgroundOpacity: 1,
    enableNebula: false,
    enableStars: false,
  }
}; 