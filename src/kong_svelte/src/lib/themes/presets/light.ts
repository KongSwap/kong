// Default light theme preset

import type { Theme } from '../types';
import { defaultStyles, borders, shadows } from '../defaults';

export const lightTheme: Theme = {
  id: 'light',
  name: 'Light',
  colorScheme: 'light',
  author: 'Kong Team',
  
  palette: {
    background: {
      primary: '#F8FAFC',    // Light background
      secondary: '#FFFFFF',  // Elevated surfaces
      tertiary: '#F1F5F9'    // Higher elevation
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
      disabled: '#CBD5E1',
      inverse: '#FFFFFF'
    },
    brand: {
      primary: '#0095EB',    // Bright blue for light mode
      secondary: '#2DD4BF'   // Bright teal for light mode
    },
    semantic: {
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6'
    },
    ui: {
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      focus: '#3B82F6',
      hover: '#F1F5F9'
    }
  },
  
  styles: {
    ...defaultStyles,
    font: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    },
    opacity: {
      panel: 1,
      blur: 0
    }
  },
  
  background: {
    type: 'gradient',
    value: 'linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%)',
    effects: {
      nebula: true,
      stars: false,
      opacity: 0.06
    }
  },
  
  logo: {
    brightness: 0.8,
    invert: true
  },
  
  components: {
    button: {
      primary: {
        background: '#0095EB',
        color: '#FFFFFF',
        hoverBackground: '#0077C5',
        border: 'none',
        shadow: shadows.sm
      }
    },
    panel: {
      default: {
        transparent: false,
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        radius: 'rounded-lg'
      },
      swap: {
        transparent: false,
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        radius: 'rounded-xl',
        shadow: shadows.md
      }
    },
    swapButton: {
      background: { start: '#0095EB', end: '#0077C5' },
      color: '#FFFFFF',
      border: 'none',
      radius: 'rounded-full',
      shadow: shadows.lg,
      glow: '#0095EB',
      errorBackground: { start: '#EF4444', end: '#DC2626' },
      processingBackground: { start: '#8B5CF6', end: '#7C3AED' }
    },
    tokenTicker: {
      background: '#FFFFFF',
      color: '#0F172A',
      border: '1px solid #E2E8F0',
      radius: 'rounded-lg',
      shadow: shadows.sm,
      upColor: '#10B981',
      downColor: '#EF4444',
      opacity: 1
    }
  }
}; 