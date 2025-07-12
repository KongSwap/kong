// Modern theme registry initialization
import { modernThemeStore } from './modernThemeStore';
import { modernDarkTheme, modernLightTheme } from './modernTheme';

// Register default modern themes
modernThemeStore.registerTheme(modernDarkTheme);
modernThemeStore.registerTheme(modernLightTheme);

// Initialize theme system on module load
if (typeof window !== 'undefined') {
  // Set up theme initialization
  modernThemeStore.initTheme();
  
  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    // Only auto-switch if user hasn't explicitly chosen a theme
    const hasStoredTheme = localStorage.getItem('modern-theme');
    if (!hasStoredTheme) {
      const preferredTheme = e.matches ? 'modern-dark' : 'modern-light';
      modernThemeStore.setTheme(preferredTheme);
    }
  });
}

export { modernThemeStore };