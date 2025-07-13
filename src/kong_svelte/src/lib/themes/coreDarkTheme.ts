// Core Dark Theme - Modern, professional dark theme using simplified core system
// Optimized for readability, accessibility, and visual hierarchy

import type { CoreTheme } from './coreTypes';

export const coreDarkTheme: CoreTheme = {
  id: 'core-dark',
  name: 'Core Dark',
  colorScheme: 'dark',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  
  // 15 carefully chosen colors for optimal hierarchy and contrast
  colors: {
    // Background hierarchy - slate-based for professional look
    bg: {
      primary: '#0D1117',      // Deep charcoal primary
      secondary: '#161B22',    // Cards and panels
      tertiary: '#21262D'      // Inputs and elevated surfaces
    },
    
    // Text hierarchy - high contrast for accessibility
    text: {
      primary: '#F0F6FC',      // Primary text (WCAG AAA)
      secondary: '#8B949E',    // Secondary text
      disabled: '#484F58',     // Disabled states
      inverse: '#24292F'       // Text on light backgrounds
    },
    
    // Brand colors - KongSwap signature colors
    brand: {
      primary: '#238636',      // Kong green primary
      secondary: '#1F6FEB'     // Accent blue
    },
    
    // Semantic colors - clear status communication
    semantic: {
      success: '#2EA043',      // Success actions
      error: '#F85149',        // Error states
      warning: '#D29922',      // Warning states
      info: '#58A6FF'          // Information
    },
    
    // UI elements - subtle but clear
    ui: {
      border: '#30363D',       // Default borders
      focus: '#1F6FEB'         // Focus rings and active states
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
  
  // Component overrides for enhanced UX
  overrides: {
    button: {
      primary: {
        background: '#238636',
        hover: '#2EA043',
        text: '#FFFFFF'
      },
      secondary: {
        background: '#21262D',
        hover: '#30363D',
        text: '#F0F6FC'
      }
    },
    panel: {
      background: '#161B22',
      border: '#30363D',
      radius: 'xl'
    },
    swap: {
      container: {
        background: '#161B22',
        radius: 'xl',
        rounded: 'rounded-3xl',
      },
      button: {
        background: '#238636',
        hover: '#2EA043',
        disabled: '#484F58',
        error: '#F85149'
      }
    }
  },
  
  // Atmospheric background
  background: {
    type: 'gradient',
    gradient: 'linear-gradient(135deg, #0D1117 0%, #161B22 50%, #0D1117 100%)'
  },
  
  // Visual effects
  effects: {
    enableNebula: true,
    enableStars: false,
    nebulaOpacity: 0.08
  },
  
  // Optional swap page background (can be customized)
  swapPageBg: {
    css: 'background: linear-gradient(135deg, rgba(13, 17, 23, 0.9) 0%, rgba(22, 27, 34, 0.8) 50%, rgba(13, 17, 23, 0.9) 100%);',
    height: '160px',
    opacity: 0.8
  },
  
  // Branding configuration
  branding: {
    logoBrightness: 1,
    logoInvert: 0,
    logoHoverBrightness: 1.1
  }
};