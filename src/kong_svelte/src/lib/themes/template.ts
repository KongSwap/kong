// Theme template - use this as a starting point for creating new themes

import type { Theme } from './types';
import { defaultStyles, borders, shadows, lighten, darken } from './defaults';

/**
 * Example theme template
 * 
 * To create a new theme:
 * 1. Copy this template
 * 2. Replace 'template' with your theme ID
 * 3. Update the colors in the palette
 * 4. Optionally customize styles and components
 * 5. Import and register in the theme registry
 */
export const templateTheme: Theme = {
  id: 'template',
  name: 'Template Theme',
  colorScheme: 'dark', // or 'light'
  author: 'Your Name',
  
  // Core color palette - Required
  palette: {
    // Background hierarchy (darkest to lightest for dark themes, lightest to darkest for light themes)
    background: {
      primary: '#000000',    // Main background
      secondary: '#111111',  // Elevated surfaces (cards, panels)
      tertiary: '#222222'    // Higher elevation (dropdowns, tooltips)
    },
    
    // Text hierarchy
    text: {
      primary: '#FFFFFF',    // Main text
      secondary: '#AAAAAA',  // Muted text (descriptions, labels)
      disabled: '#666666',   // Disabled state
      inverse: '#000000'     // Text on inverted backgrounds
    },
    
    // Brand colors - your main theme colors
    brand: {
      primary: '#0095EB',    // Primary brand color
      secondary: '#00D68F'   // Secondary brand color
    },
    
    // Semantic colors for states
    semantic: {
      success: '#00D68F',    // Success states
      error: '#FF4545',      // Error states
      warning: '#FFB800',    // Warning states
      info: '#0095EB'        // Info states
    },
    
    // UI colors for borders and interactions
    ui: {
      border: '#333333',     // Default borders
      borderLight: '#444444', // Light borders
      focus: '#0095EB',      // Focus outlines
      hover: '#222222'       // Hover backgrounds
    }
  },
  
  // Visual styles - Optional, defaults will be used if not specified
  styles: {
    ...defaultStyles, // Spread defaults and override as needed
    
    // Custom font
    font: {
      family: defaultStyles.font.family,
      scale: 1 // Font size multiplier
    },
    
    // Opacity for glass effects
    opacity: {
      panel: 0.95,  // Panel background opacity
      blur: 8       // Backdrop blur amount
    }
  },
  
  // Background configuration - Optional
  background: {
    type: 'gradient', // 'solid' | 'gradient' | 'image' | 'custom'
    value: 'linear-gradient(180deg, #000000 0%, #111111 100%)',
    
    // Visual effects
    effects: {
      nebula: true,      // Animated nebula effect
      stars: false,      // Animated stars
      opacity: 0.4       // Effect opacity
    }
  },
  
  // Logo configuration - Optional
  logo: {
    brightness: 1,      // Logo brightness (0-2)
    invert: false,      // Invert logo colors
    customPath: undefined // Custom logo path
  },
  
  // Component customizations - Optional
  components: {
    // Button variants
    button: {
      primary: {
        background: '#0095EB',
        color: '#FFFFFF',
        hoverBackground: lighten('#0095EB', 0.1),
        border: 'none',
        shadow: shadows.md,
        radius: 'rounded-lg'
      },
      secondary: {
        background: 'transparent',
        color: '#0095EB',
        hoverBackground: 'rgba(0, 149, 235, 0.1)',
        border: '1px solid #0095EB',
        radius: 'rounded-lg'
      }
    },
    
    // Panel styles
    panel: {
      default: {
        transparent: true,
        border: borders.default,
        radius: 'rounded-lg',
        shadow: shadows.md
      },
      swap: {
        transparent: true,
        border: borders.default,
        radius: 'rounded-xl',
        shadow: shadows.lg
      }
    },
    
    // Swap button (special component)
    swapButton: {
      // Can be a solid color or gradient
      background: { start: '#0095EB', end: darken('#0095EB', 0.2) },
      color: '#FFFFFF',
      border: 'none',
      radius: 'rounded-full',
      shadow: shadows.lg,
      glow: '#0095EB',
      
      // Error state
      errorBackground: { start: '#FF4545', end: darken('#FF4545', 0.2) },
      
      // Processing state
      processingBackground: { start: '#8B5CF6', end: darken('#8B5CF6', 0.2) }
    },
    
    // Token ticker component
    tokenTicker: {
      background: 'rgba(0, 0, 0, 0.5)',
      color: '#FFFFFF',
      border: borders.default,
      radius: 'rounded-lg',
      shadow: shadows.md,
      upColor: '#00D68F',   // Positive price change
      downColor: '#FF4545', // Negative price change
      opacity: 0.8
    },
    
    // Token selector dropdown
    tokenSelector: {
      background: '#111111',
      itemBackground: '#222222',
      itemHoverBackground: '#333333',
      border: borders.default,
      radius: 'rounded-lg',
      shadow: shadows.xl
    }
  }
};

/**
 * Tips for creating themes:
 * 
 * 1. Color Harmony:
 *    - Use a color wheel to find complementary colors
 *    - Maintain sufficient contrast for accessibility (WCAG AA)
 *    - Test your theme in both light and dark environments
 * 
 * 2. Consistency:
 *    - Use a consistent color ramp (equal steps between shades)
 *    - Keep border and shadow styles consistent
 *    - Match hover states to your color scheme
 * 
 * 3. Branding:
 *    - The brand.primary color should be your main accent
 *    - Use brand colors sparingly for maximum impact
 *    - Consider your logo colors when choosing the palette
 * 
 * 4. Testing:
 *    - Test all interactive states (hover, focus, active)
 *    - Check readability of all text combinations
 *    - Verify the theme works with all components
 */ 