// Theme migration utilities - convert old format to new format

import type { ThemeDefinition } from './baseTheme';
import type { Theme, ThemePalette, ThemeBackground } from './types';
import { defaultStyles, borders, shadows } from './defaults';

/**
 * Migrate an old theme definition to the new simplified format
 */
export function migrateTheme(oldTheme: ThemeDefinition): Theme {
  const { colors } = oldTheme;
  
  // Build the core palette
  const palette: ThemePalette = {
    background: {
      primary: colors.bgPrimary,
      secondary: colors.bgSecondary,
      tertiary: colors.bgTertiary || colors.bgSecondary
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textDisabled,
      inverse: colors.textDark || colors.textOnPrimary || '#000000'
    },
    brand: {
      primary: colors.primary,
      secondary: colors.secondary
    },
    semantic: {
      success: colors.success,
      error: colors.error,
      warning: colors.warning,
      info: colors.info
    },
    ui: {
      border: colors.border,
      borderLight: colors.borderLight,
              focus: colors.info || colors.accent,
      hover: colors.hoverBgSecondary || colors.bgSecondary
    }
  };
  
  // Migrate background configuration
  let backgroundType: 'solid' | 'gradient' | 'image' | 'custom' = 'solid';
  if (colors.backgroundType === 'pattern') {
    backgroundType = 'custom'; // Map pattern to custom
  } else if (colors.backgroundType === 'gradient' || colors.backgroundType === 'solid' || colors.backgroundType === 'custom') {
    backgroundType = colors.backgroundType;
  } else if (colors.backgroundImage) {
    backgroundType = 'image';
  }
  
  const background: ThemeBackground | undefined = colors.backgroundType ? {
    type: backgroundType,
    value: colors.backgroundGradient || colors.backgroundSolid || colors.backgroundImage || '',
    effects: {
      nebula: colors.enableNebula,
      stars: colors.enableStars,
      opacity: colors.backgroundOpacity
    },
    image: colors.backgroundImage ? {
      size: colors.backgroundSize,
      position: colors.backgroundPosition,
      repeat: colors.backgroundRepeat
    } : undefined
  } : undefined;
  
  // Build the new theme object
  const newTheme: Theme = {
    id: oldTheme.id,
    name: oldTheme.name,
    author: oldTheme.author,
    colorScheme: oldTheme.colorScheme,
    palette,
    styles: {
      ...defaultStyles,
      font: {
        family: colors.fontFamily || defaultStyles.font.family
      }
    },
    background,
    logo: {
      brightness: colors.logoBrightness,
      invert: colors.logoInvert === 1,
      customPath: colors.logoPath
    },
    components: {
      button: {
        primary: {
          background: colors.primaryButtonBg || colors.primary,
          color: colors.primaryButtonText || colors.textPrimary,
          border: colors.primaryButtonBorder,
          borderColor: colors.primaryButtonBorderColor,
          hoverBackground: colors.primaryButtonHoverBg || colors.primaryHover
        },
        secondary: {
          background: colors.buttonBg || 'transparent',
          color: colors.buttonText || colors.textPrimary,
          border: colors.buttonBorder,
          borderColor: colors.buttonBorderColor,
          shadow: colors.buttonShadow,
          radius: colors.buttonRoundness,
          hoverBackground: colors.buttonHoverBg
        }
      },
      panel: {
        default: {
          radius: colors.panelRoundness,
          transparent: colors.transparentPanel
        },
        swap: {
          border: colors.swapPanelBorder,
          shadow: colors.swapPanelShadow,
          radius: colors.swapPanelRoundness,
          transparent: colors.transparentSwapPanel
        },
        stats: {
          transparent: colors.statsTableTransparent
        }
      },
      swapButton: {
        background: colors.swapButtonPrimaryGradientStart && colors.swapButtonPrimaryGradientEnd
          ? { start: colors.swapButtonPrimaryGradientStart, end: colors.swapButtonPrimaryGradientEnd }
          : colors.primary,
        color: colors.swapButtonTextColor || colors.textPrimary,
        border: colors.swapButtonBorderColor ? `1px solid ${colors.swapButtonBorderColor}` : undefined,
        shadow: colors.swapButtonShadow,
        radius: colors.swapButtonRoundness,
        glow: colors.swapButtonGlowColor,
        errorBackground: colors.swapButtonErrorGradientStart && colors.swapButtonErrorGradientEnd
          ? { start: colors.swapButtonErrorGradientStart, end: colors.swapButtonErrorGradientEnd }
          : colors.error,
        processingBackground: colors.swapButtonProcessingGradientStart && colors.swapButtonProcessingGradientEnd
          ? { start: colors.swapButtonProcessingGradientStart, end: colors.swapButtonProcessingGradientEnd }
          : colors.accent
      },
      tokenTicker: {
        background: colors.tokenTickerBg || colors.bgPrimary,
        color: colors.tokenTickerText || colors.textPrimary,
        border: colors.tokenTickerBorder,
        radius: colors.tokenTickerRoundness,
        upColor: colors.tokenTickerUpColor,
        downColor: colors.tokenTickerDownColor,
        opacity: colors.tokenTickerBgOpacity ? colors.tokenTickerBgOpacity / 100 : 1
      }
    }
  };
  
  return newTheme;
}

/**
 * Convert new theme format back to old format for backwards compatibility
 */
export function unmigrateTheme(theme: Theme): ThemeDefinition {
  // This would be the reverse operation if needed
  // For now, we'll focus on forward migration
  throw new Error('Unmigration not yet implemented');
} 