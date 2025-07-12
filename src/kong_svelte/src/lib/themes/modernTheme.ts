// Modern simplified theme architecture
// Reduces 147+ properties to 24 core design tokens

export interface ModernThemeColors {
  // Core backgrounds (3 properties)
  background: {
    primary: string;    // Main canvas background
    secondary: string;  // Card/panel backgrounds
    elevated: string;   // Elevated surfaces (modals, dropdowns)
  };
  
  // Semantic colors (4 properties)
  semantic: {
    success: string;
    error: string; 
    warning: string;
    info: string;
  };
  
  // Brand colors (2 properties)
  brand: {
    primary: string;   // Primary brand color
    secondary: string; // Secondary brand color
  };
  
  // Text hierarchy (3 properties)
  text: {
    primary: string;   // Primary text color
    secondary: string; // Secondary/muted text
    disabled: string;  // Disabled text
  };
  
  // UI elements (2 properties)
  border: {
    default: string;   // Default border color
    subtle: string;    // Subtle/light borders
  };
  
  // System property (1 property)
  scheme: 'light' | 'dark';
}

export interface ModernThemeDefinition {
  id: string;
  name: string;
  colorScheme: 'light' | 'dark';
  colors: ModernThemeColors;
  author?: string;
  authorLink?: string;
}

// Theme builder pattern for better developer experience
export class ModernThemeBuilder {
  private theme: Partial<ModernThemeDefinition> = {
    colors: {
      background: {},
      semantic: {},
      brand: {},
      text: {},
      border: {},
      scheme: 'dark'
    } as ModernThemeColors
  };

  setId(id: string): ModernThemeBuilder {
    this.theme.id = id;
    return this;
  }

  setName(name: string): ModernThemeBuilder {
    this.theme.name = name;
    return this;
  }

  setColorScheme(scheme: 'light' | 'dark'): ModernThemeBuilder {
    this.theme.colorScheme = scheme;
    if (this.theme.colors) {
      this.theme.colors.scheme = scheme;
    }
    return this;
  }

  setPrimaryBrand(color: string): ModernThemeBuilder {
    if (this.theme.colors?.brand) {
      this.theme.colors.brand.primary = color;
      // Set a default secondary if not already set
      if (!this.theme.colors.brand.secondary) {
        this.theme.colors.brand.secondary = color;
      }
    }
    return this;
  }

  setSemanticColors(colors: {
    success: string;
    error: string;
    warning: string;
    info: string;
  }): ModernThemeBuilder {
    if (this.theme.colors?.semantic) {
      Object.assign(this.theme.colors.semantic, colors);
    }
    return this;
  }

  setBackgroundColors(colors: {
    primary: string;
    secondary: string;
    elevated: string;
  }): ModernThemeBuilder {
    if (this.theme.colors?.background) {
      Object.assign(this.theme.colors.background, colors);
    }
    return this;
  }

  setTextColors(colors: {
    primary: string;
    secondary: string;
    disabled: string;
  }): ModernThemeBuilder {
    if (this.theme.colors?.text) {
      Object.assign(this.theme.colors.text, colors);
    }
    return this;
  }

  setBorderColors(colors: {
    default: string;
    subtle: string;
  }): ModernThemeBuilder {
    if (this.theme.colors?.border) {
      Object.assign(this.theme.colors.border, colors);
    }
    return this;
  }

  setAuthor(author: string, link?: string): ModernThemeBuilder {
    this.theme.author = author;
    if (link) {
      this.theme.authorLink = link;
    }
    return this;
  }

  build(): ModernThemeDefinition {
    if (!this.theme.id) {
      throw new Error('Theme ID is required');
    }
    if (!this.theme.name) {
      throw new Error('Theme name is required');
    }
    if (!this.theme.colorScheme) {
      throw new Error('Color scheme is required');
    }

    // Validate all required colors are present
    const colors = this.theme.colors!;
    const requiredProps = [
      'background.primary', 'background.secondary', 'background.elevated',
      'semantic.success', 'semantic.error', 'semantic.warning', 'semantic.info',
      'brand.primary', 'brand.secondary',
      'text.primary', 'text.secondary', 'text.disabled',
      'border.default', 'border.subtle'
    ];

    for (const prop of requiredProps) {
      const keys = prop.split('.');
      let current: any = colors;
      for (const key of keys) {
        if (!current?.[key]) {
          throw new Error(`Missing required color property: ${prop}`);
        }
        current = current[key];
      }
    }

    return this.theme as ModernThemeDefinition;
  }
}

export function createModernTheme(): ModernThemeBuilder {
  return new ModernThemeBuilder();
}

// Modern theme definitions using the simplified interface
export const modernDarkTheme: ModernThemeDefinition = {
  id: 'modern-dark',
  name: 'Modern Dark',
  colorScheme: 'dark',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  colors: {
    background: {
      primary: '#0C0F17',    // Deep charcoal
      secondary: '#141925',   // Card backgrounds
      elevated: '#1D2433',    // Modals, dropdowns
    },
    semantic: {
      success: '#00D4AA',     // Vibrant teal
      error: '#DC2626',       // Red
      warning: '#D97706',     // Amber
      info: '#4A7CFF',        // Blue
    },
    brand: {
      primary: '#4A7CFF',     // Primary brand blue
      secondary: '#00D4AA',   // Secondary teal
    },
    text: {
      primary: '#F9FAFB',     // Almost white
      secondary: '#9CA3AF',   // Muted gray
      disabled: '#6B7280',    // Disabled gray
    },
    border: {
      default: '#1F2937',     // Default borders
      subtle: '#374151',      // Subtle borders
    },
    scheme: 'dark'
  }
};

export const modernLightTheme: ModernThemeDefinition = {
  id: 'modern-light',
  name: 'Modern Light',
  colorScheme: 'light',
  author: 'Kong Team',
  authorLink: 'https://kongswap.io',
  colors: {
    background: {
      primary: '#FFFFFF',     // Pure white
      secondary: '#F8FAFC',   // Card backgrounds
      elevated: '#F1F5F9',    // Modals, dropdowns
    },
    semantic: {
      success: '#059669',     // Green
      error: '#DC2626',       // Red
      warning: '#D97706',     // Amber
      info: '#2563EB',        // Blue
    },
    brand: {
      primary: '#2563EB',     // Primary brand blue
      secondary: '#059669',   // Secondary green
    },
    text: {
      primary: '#111827',     // Almost black
      secondary: '#6B7280',   // Muted gray
      disabled: '#9CA3AF',    // Disabled gray
    },
    border: {
      default: '#E5E7EB',     // Default borders
      subtle: '#F3F4F6',      // Subtle borders
    },
    scheme: 'light'
  }
};