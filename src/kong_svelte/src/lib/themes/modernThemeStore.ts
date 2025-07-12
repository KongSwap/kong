// Modern theme store with performance optimizations
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { ModernThemeDefinition } from './modernTheme';

export type ModernThemeId = string;

class ModernThemeStore {
  private themeStore: Writable<ModernThemeId>;
  private themeCache = new Map<string, string>(); // CSS cache
  private themes = new Map<string, ModernThemeDefinition>();
  private readonly THEME_KEY = 'modern-theme';

  constructor() {
    this.themeStore = writable<ModernThemeId>('modern-dark');
  }

  get subscribe() {
    return this.themeStore.subscribe;
  }

  // Register a theme
  registerTheme(theme: ModernThemeDefinition): void {
    this.themes.set(theme.id, theme);
  }

  // Get all registered themes
  getAllThemes(): ModernThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  // Get theme by ID
  getThemeById(id: string): ModernThemeDefinition | undefined {
    return this.themes.get(id);
  }

  // Convert hex to RGB space-separated format for CSS variables
  private hexToRGB(hex: string): string {
    // Remove hash if present
    hex = hex.replace(/^#/, '');
    
    // Parse hex values
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
    
    return `${r} ${g} ${b}`;
  }

  // Generate CSS for a theme (with memoization)
  generateThemeCSS(theme: ModernThemeDefinition): string {
    // Check cache first
    if (this.themeCache.has(theme.id)) {
      return this.themeCache.get(theme.id)!;
    }

    const { colors } = theme;
    
    const css = `
      /* Background colors */
      --bg-primary: ${this.hexToRGB(colors.background.primary)};
      --bg-secondary: ${this.hexToRGB(colors.background.secondary)};
      --bg-elevated: ${this.hexToRGB(colors.background.elevated)};
      
      /* Semantic colors */
      --semantic-success: ${this.hexToRGB(colors.semantic.success)};
      --semantic-error: ${this.hexToRGB(colors.semantic.error)};
      --semantic-warning: ${this.hexToRGB(colors.semantic.warning)};
      --semantic-info: ${this.hexToRGB(colors.semantic.info)};
      
      /* Brand colors */
      --brand-primary: ${this.hexToRGB(colors.brand.primary)};
      --brand-secondary: ${this.hexToRGB(colors.brand.secondary)};
      
      /* Text colors */
      --text-primary: ${this.hexToRGB(colors.text.primary)};
      --text-secondary: ${this.hexToRGB(colors.text.secondary)};
      --text-disabled: ${this.hexToRGB(colors.text.disabled)};
      
      /* Border colors */
      --border-default: ${this.hexToRGB(colors.border.default)};
      --border-subtle: ${this.hexToRGB(colors.border.subtle)};
      
      /* Color scheme */
      color-scheme: ${colors.scheme};
    `.trim();

    // Cache the result
    this.themeCache.set(theme.id, css);
    return css;
  }

  // Generate static CSS for all themes (compile-time approach)
  generateStaticCSS(themes: ModernThemeDefinition[]): string {
    return themes.map(theme => {
      const css = this.generateThemeCSS(theme);
      return `[data-theme="${theme.id}"] {\n${css.split('\n').map(line => `  ${line}`).join('\n')}\n}`;
    }).join('\n\n');
  }

  // Apply theme using data attribute strategy (performance optimized)
  applyTheme(theme: ModernThemeDefinition): void {
    if (!browser) return;

    const startTime = performance.now();

    // Set data-theme attribute (triggers CSS cascade)
    document.documentElement.dataset.theme = theme.id;
    
    // Update color scheme class for compatibility
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme.colorScheme);

    const endTime = performance.now();
    console.debug(`Theme applied in ${endTime - startTime}ms`);
  }

  // Set theme by ID
  async setTheme(themeId: ModernThemeId): Promise<void> {
    const theme = this.getThemeById(themeId);
    if (!theme) {
      console.warn(`Theme "${themeId}" not found`);
      return;
    }

    if (browser) {
      this.applyTheme(theme);
      await this.saveThemeToStorage(themeId);
    }
    
    this.themeStore.set(themeId);
  }

  // Save theme to localStorage
  private async saveThemeToStorage(themeId: ModernThemeId): Promise<void> {
    if (!browser) return;

    try {
      localStorage.setItem(this.THEME_KEY, JSON.stringify(themeId));
    } catch (error) {
      console.error('Failed to save theme to storage:', error);
    }
  }

  // Load theme from localStorage
  async loadThemeFromStorage(): Promise<ModernThemeId | null> {
    if (!browser) return null;

    try {
      const stored = localStorage.getItem(this.THEME_KEY);
      if (stored) {
        return JSON.parse(stored) as ModernThemeId;
      }
    } catch (error) {
      console.error('Failed to load theme from storage:', error);
    }

    return null;
  }

  // Initialize theme system
  async initTheme(): Promise<void> {
    if (!browser) return;

    try {
      // Check URL parameter first
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get('theme');
      
      if (themeParam && this.themes.has(themeParam)) {
        await this.setTheme(themeParam);
        return;
      }

      // Load from storage
      const storedTheme = await this.loadThemeFromStorage();
      if (storedTheme && this.themes.has(storedTheme)) {
        await this.setTheme(storedTheme);
        return;
      }

      // Fall back to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const fallbackTheme = prefersDark ? 'modern-dark' : 'modern-light';
      
      if (this.themes.has(fallbackTheme)) {
        await this.setTheme(fallbackTheme);
      }
    } catch (error) {
      console.error('Failed to initialize theme:', error);
      // Final fallback
      if (this.themes.has('modern-dark')) {
        await this.setTheme('modern-dark');
      }
    }
  }

  // Toggle between light and dark themes
  async toggleTheme(): Promise<void> {
    const currentTheme = await this.loadThemeFromStorage() || 'modern-dark';
    const allThemes = this.getAllThemes();
    
    if (allThemes.length < 2) return;

    const currentIndex = allThemes.findIndex(t => t.id === currentTheme);
    const nextIndex = (currentIndex + 1) % allThemes.length;
    
    await this.setTheme(allThemes[nextIndex].id);
  }

  // Clear cache (for testing)
  clearCache(): void {
    this.themeCache.clear();
  }

  // Get current theme
  getCurrentTheme(): ModernThemeDefinition | null {
    if (!browser) return null;
    
    const themeId = document.documentElement.dataset.theme;
    return themeId ? this.getThemeById(themeId) || null : null;
  }
}

// Create singleton instance
export const modernThemeStore = new ModernThemeStore();