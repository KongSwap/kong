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
    bgDark: '#F5F7FA',      // Light gray/blue
    bgLight: '#FFFFFF',     // White
    hoverBgLight: '#EEF1F5', // Slightly darker for hover
    
    // Primary and secondary colors
    primary: '#2563EB',     // Modern blue
    primaryHover: '#1D4ED8', // Darker blue
    secondary: '#0EA5E9',   // Sky blue
    secondaryHover: '#0284C7', // Darker sky blue
    
    // Accent colors
    accentBlue: '#3B82F6',  // Modern blue
    accentRed: '#EF4444',   // Modern red
    accentGreen: '#10B981', // Modern green
    accentYellow: '#F59E0B', // Modern amber
    accentPurple: '#8B5CF6', // Modern purple
    accentCyan: '#06B6D4',   // Modern cyan
    
    // Hover variants
    accentGreenHover: '#059669', // Darker green
    accentBlueHover: '#2563EB',  // Darker blue
    accentRedHover: '#DC2626',   // Darker red
    accentYellowHover: '#D97706', // Darker amber
    
    // Text colors
    textPrimary: '#1E293B',  // Slate 800
    textSecondary: '#475569', // Slate 600
    textDisabled: '#94A3B8', // Slate 400
    textAccentGreen: '#059669', // Green 600
    textAccentRed: '#DC2626',   // Red 600
    textAccentBlue: '#2563EB',  // Blue 600
    textOnPrimary: '#fff',
    
    // Font settings
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    
    // UI settings
    panelRoundness: 'rounded-lg', // Modern rounded corners
    swapPanelRoundness: 'rounded-xl', // Slightly more rounded for swap panels
    swapPanelBorder: '1px solid rgba(203, 213, 225, 0.5)', // Light border
    swapPanelShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)', // Modern shadow
    swapPanelInputsRounded: true, // Rounded inputs
    
    // Borders
    border: '#E2E8F0',      // Slate 200
    borderLight: '#F1F5F9',  // Slate 100
    
    // Surface colors
    surfaceDark: '#F8FAFC',  // Slate 50
    surfaceLight: '#FFFFFF',  // White
    
    // Logo properties - adjust for light theme
    logoBrightness: 0.9,
    logoInvert: 1,           // Invert for dark logos on light background
    logoHoverBrightness: 0.8,
    
    // Token selector dropdown colors
    tokenSelectorBg: '#FFFFFF',
    tokenSelectorHeaderBg: '#F8FAFC',
    tokenSelectorItemBg: '#F8FAFC',
    tokenSelectorItemHoverBg: '#F1F5F9',
    tokenSelectorItemActiveBg: '#E2E8F0',
    tokenSelectorSearchBg: '#FFFFFF',
    tokenSelectorBorder: '1px solid rgba(203, 213, 225, 0.5)',
    tokenSelectorRoundness: 'rounded-lg',
    tokenSelectorShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
    
    // Plugin Manager colors
    pmDark: '#F8FAFC',
    pmBorder: '#E2E8F0',
    pmAccent: '#8B5CF6',     // Modern purple
    pmTextSecondary: '#475569',
    
    // Chart text color
    chartTextColor: '#1E293B',
    
    // Background configuration
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(180deg, rgb(241, 245, 249) 0%, rgb(248, 250, 252) 100%)',
    backgroundOpacity: 1,
    enableNebula: false,
    enableStars: false,
    enableSkyline: false
  }
}; 