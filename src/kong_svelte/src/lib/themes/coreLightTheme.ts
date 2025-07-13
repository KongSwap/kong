// Banana Tree Light Theme - Kong-inspired light theme with banana cream and tree greens
// Natural tree greens and warm banana tones with excellent readability

import type { CoreTheme } from './coreTypes';

export const coreLightTheme: CoreTheme = {
  id: 'core-light',
  name: 'Banana Tree Light', 
  colorScheme: 'light',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  
  // 15 banana tree-inspired colors for natural hierarchy
  colors: {
    // Background hierarchy - banana cream and tree greens
    bg: {
      primary: '#FFFEF7',      // Warm banana cream like sunlight
      secondary: '#F7F9F2',    // Soft tree green for cards/panels  
      tertiary: '#F0F4E8'      // Fresh leaf green for inputs
    },
    
    // Text hierarchy - forest-inspired dark tones
    text: {
      primary: '#1B2E1F',      // Deep forest green primary text
      secondary: '#4A5C4E',    // Medium jungle green secondary
      disabled: '#78A085',     // Muted jungle green for disabled
      inverse: '#FFFEF7'       // Banana cream text for dark backgrounds
    },
    
    // Brand colors - Kong tree and banana identity
    brand: {
      primary: '#2D7A2D',      // Rich jungle green (Kong's signature)
      secondary: '#F4D03F'     // Warm banana yellow accent
    },
    
    // Semantic colors - tree and banana inspired status colors
    semantic: {
      success: '#228B22',      // Forest green for success (healthy trees)
      error: '#B22222',        // Deep red for errors (warning leaves)
      warning: '#F1C40F',      // Ripe banana yellow for warnings
      info: '#27AE60'          // Fresh leaf green for information
    },
    
    // UI elements - natural definition
    ui: {
      border: '#C8D5CB',       // Soft green-gray borders
      focus: '#2D7A2D'         // Kong green focus rings
    }
  },
  
  // Design tokens for consistency
  styles: {
    borderRadius: 'lg',
    font: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      scale: 1.0
    }
  },
  
  // Component overrides optimized for banana and tree theme
  overrides: {
    button: {
      primary: {
        background: '#2D7A2D',
        hover: '#228B22',
        text: '#FFFEF7'
      },
      secondary: {
        background: '#F0F4E8',
        hover: '#E8F0DC',
        text: '#1B2E1F'
      }
    },
    panel: {
      background: '#F7F9F2',
      border: '#C8D5CB',
      radius: 'xl'
    },
    swap: {
      container: {
        background: '#FFFEF7',
        radius: 'xl',
        rounded: 'rounded-full'
      },
      button: {
        background: '#2D7A2D',
        hover: '#228B22',
        disabled: '#78A085',
        error: '#B22222'
      }
    }
  },
  
  // Banana cream and tree gradient background
  background: {
    type: 'gradient',
    gradient: 'linear-gradient(135deg, #FFFEF7 0%, #F7F9F2 25%, #F0F4E8 50%, #F7F9F2 75%, #FFFEF7 100%)'
  },
  
  // Visual effects
  effects: {
    enableNebula: false,
    enableStars: false,
    nebulaOpacity: 0.1
  },
  
  // Swap page jungle background
  swapPageBg: {
    image: '/backgrounds/jungle.png',
    opacity: 1,
    height: '192px',
    css: 'background-size: cover; background-position: center bottom; background-repeat: no-repeat;'
  },
  
  // Branding configuration for light backgrounds
  branding: {
    logoBrightness: 0.9,
    logoInvert: 1,           // Invert logo for light background
    logoHoverBrightness: 0.8
  }
};