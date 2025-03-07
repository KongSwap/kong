import { browser } from '$app/environment';

export type ThemeOption = 'light' | 'dark' | 'plain-black' | 'auto';

/**
 * Sets the theme by adding the appropriate class to the document root
 * @param theme The theme to set: 'light', 'dark', 'plain-black', or 'auto'
 */
export function setTheme(theme: ThemeOption): void {
  if (!browser) return;
  
  // Remove all theme classes first
  document.documentElement.classList.remove('dark', 'plain-black');
  
  // Set the data attribute for ready state
  document.documentElement.setAttribute('data-theme-ready', 'true');
  
  if (theme === 'auto') {
    // Check system preference for dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
  } else if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (theme === 'plain-black') {
    document.documentElement.classList.add('plain-black');
  }
  
  // Save preference to localStorage
  localStorage.setItem('theme-preference', theme);
}

/**
 * Gets the current theme preference from localStorage or defaults to 'auto'
 */
export function getThemePreference(): ThemeOption {
  if (!browser) return 'auto';
  return (localStorage.getItem('theme-preference') as ThemeOption) || 'auto';
}

/**
 * Initialize theme on page load
 */
export function initTheme(): void {
  if (!browser) return;
  
  const savedTheme = getThemePreference();
  setTheme(savedTheme);
  
  // Listen for system preference changes if in auto mode
  if (savedTheme === 'auto') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (getThemePreference() === 'auto') {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    });
  }
} 