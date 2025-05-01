// Gladiator theme definition
import type { ThemeDefinition } from './baseTheme';

export const gladiatorTheme: ThemeDefinition = {
  id: 'gladiator',
  name: 'Gladiator',
  colorScheme: 'dark',
  author: 'AI Assistant', // Or user's name if preferred
  authorLink: '', // Optional link
  colors: {
    // Background colors - Stone and earth tones
    bgDark: '#2C2A2A',      // Dark stone grey
    bgLight: '#4A4646',     // Lighter stone grey
    hoverBgLight: '#5A5656', // Slightly lighter for hover

    // Primary and secondary colors - Bronze and deep red
    primary: '#CD7F32',     // Bronze
    primaryHover: '#B8732E', // Darker bronze
    secondary: '#8B0000',   // Deep red (like dried blood)
    secondaryHover: '#7A0000', // Darker red

    // Accent colors - Metals and highlights
    accentBlue: '#A0AEC0',  // Steel grey
    accentRed: '#DC2626',   // Brighter red for accents
    accentGreen: '#689F38', // Olive green
    accentYellow: '#FBC02D', // Gold/Yellow accent
    accentPurple: '#7B1FA2', // Deep purple (like royalty/emperors)
    accentCyan: '#4DD0E1',   // Lighter blue accent

    // Hover variants
    accentGreenHover: '#558B2F',
    accentBlueHover: '#718096',
    accentRedHover: '#B91C1C',
    accentYellowHover: '#F9A825',

    // Text colors
    textPrimary: '#E2E8F0',  // Off-white (like parchment)
    textSecondary: '#A0AEC0', // Steel grey
    textDisabled: '#718096', // Lighter grey
    textLight: '#F7FAFC',      // Very light grey/white
    textDark: '#1A202C',       // Very dark grey/black
    textOnPrimary: '#1A202C',  // Dark text on bronze
    textAccentGreen: '#AED581', // Lighter olive
    textAccentRed: '#EF5350',   // Lighter red
    textAccentBlue: '#E2E8F0',  // Off-white

    // Font settings - Maybe something slightly rugged or classic?
    fontFamily: "'Trajan Pro', Georgia, serif", // Example, might need web font import

    // UI settings - Rugged, less rounded
    panelRoundness: 'rounded-sm',
    swapPanelRoundness: 'rounded',
    swapPanelBorder: '2px solid #7A5C2F', // Thicker bronze-like border
    swapPanelShadow: '0 6px 15px rgba(0, 0, 0, 0.4)', // Stronger shadow
    swapPanelInputsRounded: false, // Square inputs
    transparentSwapPanel: false, // Solid panels
    transparentPanel: false,
    swapPanelBorderStyle: 'default',
    statsTableTransparent: false,

    // Borders
    border: '#4A4646',      // Stone grey
    borderLight: '#5A5656',  // Lighter stone grey

    // Surface colors
    surfaceDark: '#3A3737',  // Darker surface
    surfaceLight: '#4A4646', // Stone grey surface

    // Logo properties
    logoBrightness: 0.9,
    logoInvert: 0.1, // Slight invert if needed
    logoHoverBrightness: 0.8,

    // Token selector dropdown colors
    tokenSelectorBg: '#3A3737',
    tokenSelectorHeaderBg: '#2C2A2A',
    tokenSelectorItemBg: '#4A4646',
    tokenSelectorItemHoverBg: '#5A5656',
    tokenSelectorItemActiveBg: '#6A6666',
    tokenSelectorSearchBg: '#4A4646',
    tokenSelectorBorder: '1px solid #7A5C2F',
    tokenSelectorRoundness: 'rounded-sm',
    tokenSelectorShadow: '0 6px 15px rgba(0, 0, 0, 0.4)',

    // Plugin Manager colors
    pmDark: '#3A3737',
    pmBorder: '#5A5656',
    pmAccent: '#CD7F32', // Bronze
    pmTextSecondary: '#A0AEC0',

    // Chart text color
    chartTextColor: '#E2E8F0',

    // Swap Button styling - Gladiator theme
    swapButtonPrimaryGradientStart: '#CD7F32', // Bronze
    swapButtonPrimaryGradientEnd: '#B8732E',   // Darker bronze
    swapButtonErrorGradientStart: '#8B0000',   // Deep red
    swapButtonErrorGradientEnd: '#7A0000',     // Darker red
    swapButtonProcessingGradientStart: '#A0AEC0', // Steel grey
    swapButtonProcessingGradientEnd: '#718096',   // Darker steel grey
    swapButtonBorderColor: 'rgba(205, 127, 50, 0.5)', // Bronze border
    swapButtonGlowColor: 'rgba(205, 127, 50, 0.3)',  // Bronze glow
    swapButtonShineColor: 'rgba(255, 215, 0, 0.4)', // Gold shine
    swapButtonReadyGlowStart: '#689F38', // Olive green
    swapButtonReadyGlowEnd: '#558B2F',   // Darker olive
    swapButtonTextColor: '#1A202C', // Dark text on bronze
    swapButtonRoundness: 'rounded', // Match swap panel
    swapButtonShadow: '0 4px 10px rgba(0, 0, 0, 0.5)', // Strong shadow

    // Background configuration - Maybe a stone texture or arena sand?
    backgroundType: 'solid', // Simple solid for now
    backgroundSolid: '#2C2A2A', // Dark stone grey
    // Example for texture:
    // backgroundType: 'pattern',
    // backgroundImage: 'url("/images/themes/gladiator/stone_texture.png")',
    // backgroundSize: 'auto',
    // backgroundRepeat: 'repeat',
    backgroundOpacity: 1,
    enableNebula: false,
    enableStars: false,
    enableSkyline: false
  }
};
