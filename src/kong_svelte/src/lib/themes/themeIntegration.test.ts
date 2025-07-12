import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { modernThemeStore } from './modernThemeStore';
import { modernDarkTheme, modernLightTheme } from './modernTheme';
import { migrateLegacyTheme, generateMigrationReport } from './themeMigration';
import { baseTheme } from './baseTheme';

// Mock DOM environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('dark'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  writable: true,
});

describe('Theme Integration Tests', () => {
  beforeEach(() => {
    // Clear any existing themes and reset state
    modernThemeStore.clearCache();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
  });

  afterEach(() => {
    // Cleanup
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
  });

  describe('End-to-End Theme System', () => {
    it('should register themes and switch between them', async () => {
      // Register themes
      modernThemeStore.registerTheme(modernDarkTheme);
      modernThemeStore.registerTheme(modernLightTheme);

      // Verify registration
      const themes = modernThemeStore.getAllThemes();
      expect(themes).toHaveLength(2);
      expect(themes.map(t => t.id)).toContain('modern-dark');
      expect(themes.map(t => t.id)).toContain('modern-light');

      // Switch to dark theme
      await modernThemeStore.setTheme('modern-dark');
      expect(document.documentElement.dataset.theme).toBe('modern-dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Switch to light theme
      await modernThemeStore.setTheme('modern-light');
      expect(document.documentElement.dataset.theme).toBe('modern-light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('should maintain performance targets', async () => {
      modernThemeStore.registerTheme(modernDarkTheme);
      modernThemeStore.registerTheme(modernLightTheme);

      // Test theme switching performance
      const iterations = 10;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await modernThemeStore.setTheme(i % 2 === 0 ? 'modern-dark' : 'modern-light');
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should average under 5ms per theme switch
      expect(averageTime).toBeLessThan(5);
    });

    it('should handle theme persistence', async () => {
      const mockStorage: Record<string, string> = {};
      
      // Mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: (key: string) => mockStorage[key] || null,
          setItem: (key: string, value: string) => { mockStorage[key] = value; },
          removeItem: (key: string) => { delete mockStorage[key]; },
          clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
        },
        writable: true,
      });

      modernThemeStore.registerTheme(modernDarkTheme);
      
      // Set theme and verify persistence
      await modernThemeStore.setTheme('modern-dark');
      const stored = await modernThemeStore.loadThemeFromStorage();
      expect(stored).toBe('modern-dark');
    });
  });

  describe('Legacy Theme Migration', () => {
    it('should migrate legacy theme to modern format', () => {
      const migratedTheme = migrateLegacyTheme(baseTheme);

      expect(migratedTheme.id).toBe('modern-dark');
      expect(migratedTheme.name).toBe('Modern Dark');
      expect(migratedTheme.colors.background.primary).toBe(baseTheme.colors.bgPrimary);
      expect(migratedTheme.colors.semantic.success).toBe(baseTheme.colors.success);
      expect(migratedTheme.colors.brand.primary).toBe(baseTheme.colors.primary);

      // Verify structure matches modern interface
      expect(migratedTheme.colors).toHaveProperty('background');
      expect(migratedTheme.colors).toHaveProperty('semantic');
      expect(migratedTheme.colors).toHaveProperty('brand');
      expect(migratedTheme.colors).toHaveProperty('text');
      expect(migratedTheme.colors).toHaveProperty('border');
      expect(migratedTheme.colors).toHaveProperty('scheme');
    });

    it('should generate accurate migration report', () => {
      const report = generateMigrationReport(baseTheme);

      expect(report.originalProperties).toBeGreaterThan(100); // Legacy has 147+ props
      expect(report.modernProperties).toBe(15); // Modern has 15 props
      expect(report.reductionPercentage).toBeGreaterThan(70); // >70% reduction
      expect(report.removedProperties).toContain('tokenTickerBg');
      expect(report.removedProperties).toContain('swapButtonPrimaryGradientStart');
    });
  });

  describe('CSS Generation and Performance', () => {
    it('should generate static CSS for multiple themes', () => {
      const themes = [modernDarkTheme, modernLightTheme];
      const css = modernThemeStore.generateStaticCSS(themes);

      // Should contain theme selectors
      expect(css).toContain('[data-theme="modern-dark"]');
      expect(css).toContain('[data-theme="modern-light"]');

      // Should contain CSS variables
      expect(css).toContain('--bg-primary:');
      expect(css).toContain('--semantic-success:');
      expect(css).toContain('--brand-primary:');

      // Should NOT contain legacy component-specific properties
      expect(css).not.toContain('tokenTickerBg');
      expect(css).not.toContain('swapButtonGradient');
      expect(css).not.toContain('panelRoundness');
    });

    it('should use memoization effectively', () => {
      modernThemeStore.registerTheme(modernDarkTheme);

      // First generation
      const start1 = performance.now();
      const css1 = modernThemeStore.generateThemeCSS(modernDarkTheme);
      const time1 = performance.now() - start1;

      // Second generation (should hit cache)
      const start2 = performance.now();
      const css2 = modernThemeStore.generateThemeCSS(modernDarkTheme);
      const time2 = performance.now() - start2;

      expect(css1).toBe(css2); // Same output
      expect(time2).toBeLessThan(time1 * 0.1); // Much faster on second call
    });
  });

  describe('Bundle Size Analysis', () => {
    it('should have significantly smaller theme definitions', () => {
      // Legacy theme properties count
      const legacyPropertyCount = Object.keys(baseTheme.colors).length;
      
      // Modern theme properties count
      const modernPropertyCount = Object.values(modernDarkTheme.colors).reduce((count, value) => {
        if (typeof value === 'object' && value !== null && typeof value !== 'string') {
          return count + Object.keys(value).length;
        }
        return count + 1;
      }, 0);

      // Should be dramatically smaller
      expect(modernPropertyCount).toBeLessThan(legacyPropertyCount * 0.2); // 80%+ reduction
      expect(modernPropertyCount).toBe(15); // Exactly 15 core properties
      expect(legacyPropertyCount).toBeGreaterThan(100); // Legacy has 100+ properties
    });

    it('should not contain component-specific styling', () => {
      const componentSpecificProps = [
        'tokenTickerBg', 'tokenTickerHoverBg', 'tokenTickerBorder',
        'swapButtonPrimaryGradientStart', 'swapButtonErrorGradientEnd',
        'buttonRoundness', 'panelRoundness', 'swapPanelRoundness',
        'switchButtonBg', 'chartTextColor'
      ];

      const modernThemeProps = JSON.stringify(modernDarkTheme.colors);
      
      componentSpecificProps.forEach(prop => {
        expect(modernThemeProps).not.toContain(prop);
      });
    });
  });
});