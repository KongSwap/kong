// Default dark theme preset

import type { Theme } from '../types';
import { defaultStyles, borders, shadows } from '../defaults';

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  colorScheme: 'dark',
  author: 'Kong Team',
  
  palette: {
    background: {
      primary: '#090c17',    // Deep navy background
      secondary: '#1a2032',  // Elevated surfaces
      tertiary: '#181C2A'    // Higher elevation
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B6C5',
      disabled: '#6B7280',
      inverse: '#0D111F'
    },
    brand: {
      primary: '#1A8FE3',    // Kong blue
      secondary: '#38BEC9'   // Kong teal
    },
    semantic: {
      success: '#00D68F',
      error: '#F43F5E',
      warning: '#F59E0B',
      info: '#3B82F6'
    },
    ui: {
      border: '#1C202E',
      borderLight: '#232735',
      focus: '#3B82F6',
      hover: '#232735'
    }
  },
  
  styles: {
    ...defaultStyles,
    opacity: {
      panel: 0.95,
      blur: 8
    }
  },
  
  background: {
    type: 'gradient',
    value: 'linear-gradient(180deg, rgb(2, 6, 23) 0%, rgb(10, 15, 35) 100%)',
    effects: {
      nebula: true,
      stars: false,
      opacity: 0.4
    }
  },
  
  logo: {
    brightness: 1,
    invert: false
  },
  
  components: {
    button: {
      primary: {
        background: '#1A8FE3',
        color: '#FFFFFF',
        hoverBackground: '#0D7DCB',
        border: borders.default,
        shadow: shadows.md
      }
    },
    panel: {
      default: {
        transparent: true,
        border: borders.default,
        radius: 'rounded-lg'
      },
      swap: {
        transparent: true,
        border: borders.default,
        radius: 'rounded-xl',
        shadow: shadows.md
      }
    },
    swapButton: {
      background: { start: '#1A8FE3', end: '#0D6EAF' },
      color: '#FFFFFF',
      border: borders.default,
      radius: 'rounded-full',
      glow: '#1A8FE3',
      errorBackground: { start: '#F43F5E', end: '#BE123C' },
      processingBackground: { start: '#8B5CF6', end: '#6D28D9' }
    },
    tokenTicker: {
      background: '#111523',
      color: '#FFFFFF',
      border: borders.default,
      radius: 'rounded-lg',
      shadow: shadows.dark,
      upColor: '#00D68F',
      downColor: '#F43F5E',
      opacity: 1
    }
  }
}; 