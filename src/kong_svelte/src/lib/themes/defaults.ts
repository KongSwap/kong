// Default theme values and constants

import type { ThemeStyles } from './types';

// Default style values that can be reused across themes
export const defaultStyles: ThemeStyles = {
  font: {
    family: "'Exo 2', 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  radius: {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full'
  },
  shadow: {
    none: 'shadow-none',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl'
  },
  opacity: {
    panel: 0.95,
    blur: 8
  }
};

// Default border styles
export const borders = {
  default: '1px solid rgba(255, 255, 255, 0.1)',
  light: '1px solid rgba(255, 255, 255, 0.05)',
  dark: '1px solid rgba(0, 0, 0, 0.1)',
  none: 'none'
};

// Default shadow styles
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  dark: '0 8px 32px rgba(0, 0, 0, 0.32)'
};

// Color utilities
export const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : '0 0 0';
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

// Opacity utilities
export const withOpacity = (color: string, opacity: number): string => {
  // If it's already an rgba or has opacity, return as-is
  if (color.includes('rgba') || color.includes('rgb')) return color;
  
  // Convert hex to rgb and add opacity
  const rgb = hexToRgb(color);
  return `rgba(${rgb}, ${opacity})`;
};

// Theme color utilities
export const lighten = (color: string, amount: number = 0.1): string => {
  // Simple lightening by mixing with white
  const rgb = hexToRgb(color).split(' ').map(Number);
  const lightened = rgb.map(val => Math.min(255, val + (255 - val) * amount));
  return rgbToHex(...lightened as [number, number, number]);
};

export const darken = (color: string, amount: number = 0.1): string => {
  // Simple darkening by mixing with black
  const rgb = hexToRgb(color).split(' ').map(Number);
  const darkened = rgb.map(val => Math.max(0, val - val * amount));
  return rgbToHex(...darkened as [number, number, number]);
}; 