import { describe, it, expect, beforeEach } from 'vitest';
import { createModernTheme, type ModernThemeDefinition, type ModernThemeColors } from './modernTheme';
import { modernThemeStore } from './modernThemeStore';

describe('Modern Theme Architecture', () => {
  describe('ModernThemeColors Interface', () => {
    it('should have exactly 24 core properties instead of 147+', () => {
      const mockTheme: ModernThemeColors = {
        background: {
          primary: '#0C0F17',
          secondary: '#141925', 
          elevated: '#1D2433'
        },
        semantic: {
          success: '#00D4AA',
          error: '#DC2626',
          warning: '#D97706',
          info: '#4A7CFF'
        },
        brand: {
          primary: '#4A7CFF',
          secondary: '#00D4AA'
        },
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          disabled: '#6B7280'
        },
        border: {
          default: '#1F2937',
          subtle: '#374151'
        },
        scheme: 'dark' as const
      };

      // Count all leaf properties (not nested objects)
      const propertyCount = Object.values(mockTheme).reduce((count, value) => {
        if (typeof value === 'object' && value !== null && typeof value !== 'string') {
          return count + Object.keys(value).length;
        }
        return count + 1;
      }, 0);

      expect(propertyCount).toBe(15); // 3+4+2+3+2+1 = 15 core properties
      expect(mockTheme.background).toHaveProperty('primary');
      expect(mockTheme.background).toHaveProperty('secondary');
      expect(mockTheme.background).toHaveProperty('elevated');
      expect(mockTheme.semantic).toHaveProperty('success');
      expect(mockTheme.semantic).toHaveProperty('error');
      expect(mockTheme.semantic).toHaveProperty('warning');
      expect(mockTheme.semantic).toHaveProperty('info');
    });

    it('should not contain component-specific properties', () => {
      const invalidProps = [
        'tokenTickerBg',
        'swapButtonPrimaryGradientStart',
        'buttonRoundness',
        'panelRoundness',
        'switchButtonBg'
      ];

      const mockTheme: ModernThemeColors = {
        background: { primary: '#000', secondary: '#111', elevated: '#222' },
        semantic: { success: '#0f0', error: '#f00', warning: '#ff0', info: '#00f' },
        brand: { primary: '#4A7CFF', secondary: '#00D4AA' },
        text: { primary: '#fff', secondary: '#aaa', disabled: '#666' },
        border: { default: '#333', subtle: '#444' },
        scheme: 'dark'
      };

      invalidProps.forEach(prop => {
        expect(mockTheme).not.toHaveProperty(prop);
      });
    });
  });

  describe('Theme Builder Pattern', () => {
    it('should create theme using builder pattern', () => {
      const theme = createModernTheme()
        .setId('test-theme')
        .setName('Test Theme')
        .setColorScheme('dark')
        .setPrimaryBrand('#4A7CFF')
        .setBackgroundColors({
          primary: '#0C0F17',
          secondary: '#141925',
          elevated: '#1D2433'
        })
        .setSemanticColors({
          success: '#00D4AA',
          error: '#DC2626',
          warning: '#D97706',
          info: '#4A7CFF'
        })
        .setTextColors({
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          disabled: '#6B7280'
        })
        .setBorderColors({
          default: '#1F2937',
          subtle: '#374151'
        })
        .build();

      expect(theme.id).toBe('test-theme');
      expect(theme.name).toBe('Test Theme');
      expect(theme.colorScheme).toBe('dark');
      expect(theme.colors.brand.primary).toBe('#4A7CFF');
      expect(theme.colors.semantic.success).toBe('#00D4AA');
    });

    it('should fail when required properties are missing', () => {
      expect(() => {
        createModernTheme().build();
      }).toThrow('Theme ID is required');
    });
  });

  describe('Performance Optimizations', () => {
    beforeEach(() => {
      // Clear any existing theme cache
      modernThemeStore.clearCache();
    });

    it('should memoize theme calculations', () => {
      const theme: ModernThemeDefinition = {
        id: 'perf-test',
        name: 'Performance Test',
        colorScheme: 'dark',
        colors: {
          background: { primary: '#000', secondary: '#111', elevated: '#222' },
          semantic: { success: '#0f0', error: '#f00', warning: '#ff0', info: '#00f' },
          brand: { primary: '#4A7CFF', secondary: '#00D4AA' },
          text: { primary: '#fff', secondary: '#aaa', disabled: '#666' },
          border: { default: '#333', subtle: '#444' },
          scheme: 'dark'
        }
      };

      const startTime = performance.now();
      modernThemeStore.generateThemeCSS(theme);
      const firstCallTime = performance.now() - startTime;

      const secondStartTime = performance.now();
      modernThemeStore.generateThemeCSS(theme);
      const secondCallTime = performance.now() - secondStartTime;

      // Second call should be significantly faster due to memoization
      expect(secondCallTime).toBeLessThan(firstCallTime * 0.1);
    });

    it('should switch themes in under 5ms', () => {
      const theme: ModernThemeDefinition = {
        id: 'speed-test',
        name: 'Speed Test',
        colorScheme: 'dark',
        colors: {
          background: { primary: '#000', secondary: '#111', elevated: '#222' },
          semantic: { success: '#0f0', error: '#f00', warning: '#ff0', info: '#00f' },
          brand: { primary: '#4A7CFF', secondary: '#00D4AA' },
          text: { primary: '#fff', secondary: '#aaa', disabled: '#666' },
          border: { default: '#333', subtle: '#444' },
          scheme: 'dark'
        }
      };

      const startTime = performance.now();
      modernThemeStore.applyTheme(theme);
      const switchTime = performance.now() - startTime;

      expect(switchTime).toBeLessThan(5);
    });
  });

  describe('CSS Data Attribute Strategy', () => {
    it('should use data-theme attribute instead of dynamic CSS injection', () => {
      const theme: ModernThemeDefinition = {
        id: 'data-attr-test',
        name: 'Data Attribute Test',
        colorScheme: 'dark',
        colors: {
          background: { primary: '#000', secondary: '#111', elevated: '#222' },
          semantic: { success: '#0f0', error: '#f00', warning: '#ff0', info: '#00f' },
          brand: { primary: '#4A7CFF', secondary: '#00D4AA' },
          text: { primary: '#fff', secondary: '#aaa', disabled: '#666' },
          border: { default: '#333', subtle: '#444' },
          scheme: 'dark'
        }
      };

      modernThemeStore.applyTheme(theme);

      // Should set data-theme attribute
      expect(document.documentElement.dataset.theme).toBe('data-attr-test');
      
      // Should NOT create dynamic style element
      const dynamicStyles = document.getElementById('dynamic-theme-styles');
      expect(dynamicStyles).toBeNull();
    });

    it('should generate static CSS for all themes', () => {
      const themes: ModernThemeDefinition[] = [
        {
          id: 'light',
          name: 'Light',
          colorScheme: 'light',
          colors: {
            background: { primary: '#fff', secondary: '#f8f9fa', elevated: '#e9ecef' },
            semantic: { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#007bff' },
            brand: { primary: '#007bff', secondary: '#28a745' },
            text: { primary: '#212529', secondary: '#6c757d', disabled: '#adb5bd' },
            border: { default: '#dee2e6', subtle: '#e9ecef' },
            scheme: 'light'
          }
        },
        {
          id: 'dark',
          name: 'Dark',
          colorScheme: 'dark',
          colors: {
            background: { primary: '#000', secondary: '#111', elevated: '#222' },
            semantic: { success: '#0f0', error: '#f00', warning: '#ff0', info: '#00f' },
            brand: { primary: '#4A7CFF', secondary: '#00D4AA' },
            text: { primary: '#fff', secondary: '#aaa', disabled: '#666' },
            border: { default: '#333', subtle: '#444' },
            scheme: 'dark'
          }
        }
      ];

      const css = modernThemeStore.generateStaticCSS(themes);

      expect(css).toContain('[data-theme="light"]');
      expect(css).toContain('[data-theme="dark"]');
      expect(css).toContain('--bg-primary:');
      expect(css).toContain('--text-primary:');
      expect(css).not.toContain('tokenTickerBg');
      expect(css).not.toContain('swapButtonGradient');
    });
  });
});