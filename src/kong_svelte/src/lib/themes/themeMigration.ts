// Theme migration utility: Convert legacy themes to modern format
import type { ThemeDefinition } from './baseTheme';
import type { ModernThemeDefinition } from './modernTheme';

export function migrateLegacyTheme(legacyTheme: ThemeDefinition): ModernThemeDefinition {
  const { colors } = legacyTheme;
  
  return {
    id: `modern-${legacyTheme.id}`,
    name: `Modern ${legacyTheme.name}`,
    colorScheme: legacyTheme.colorScheme,
    author: legacyTheme.author,
    authorLink: legacyTheme.authorLink,
    colors: {
      background: {
        primary: colors.bgPrimary,
        secondary: colors.bgSecondary,
        elevated: colors.bgTertiary,
      },
      semantic: {
        success: colors.success,
        error: colors.error,
        warning: colors.warning,
        info: colors.info,
      },
      brand: {
        primary: colors.primary,
        secondary: colors.secondary,
      },
      text: {
        primary: colors.textPrimary,
        secondary: colors.textSecondary,
        disabled: colors.textDisabled,
      },
      border: {
        default: colors.border,
        subtle: colors.borderLight,
      },
      scheme: legacyTheme.colorScheme
    }
  };
}

// Migrate multiple themes
export function migrateLegacyThemes(legacyThemes: ThemeDefinition[]): ModernThemeDefinition[] {
  return legacyThemes.map(migrateLegacyTheme);
}

// Generate migration report
export function generateMigrationReport(legacyTheme: ThemeDefinition): {
  originalProperties: number;
  modernProperties: number;
  reductionPercentage: number;
  removedProperties: string[];
} {
  const originalProps = Object.keys(legacyTheme.colors).length;
  const modernProps = 15; // Our target count
  
  const removedProperties = Object.keys(legacyTheme.colors).filter(key => 
    ![
      'bgPrimary', 'bgSecondary', 'bgTertiary',
      'success', 'error', 'warning', 'info',
      'primary', 'secondary',
      'textPrimary', 'textSecondary', 'textDisabled',
      'border', 'borderLight'
    ].includes(key)
  );

  return {
    originalProperties: originalProps,
    modernProperties: modernProps,
    reductionPercentage: Math.round(((originalProps - modernProps) / originalProps) * 100),
    removedProperties
  };
}