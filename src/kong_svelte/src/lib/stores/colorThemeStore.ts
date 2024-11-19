import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type ColorTheme = 'dark' | 'light';

// Get theme from localStorage or default to 'dark'
const storedColorTheme = browser ? localStorage.getItem('colorTheme') as ColorTheme : 'dark';
export const colorThemeStore = writable<ColorTheme>(storedColorTheme || 'dark');

// Subscribe to changes and update localStorage
if (browser) {
  colorThemeStore.subscribe((value) => {
    localStorage.setItem('colorTheme', value);
    // Update CSS variables based on theme
    if (value === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    } else {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    }
  });
}
