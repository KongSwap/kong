import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'dark' | 'light';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('dark');

  function validateTheme(theme: string | null): Theme {
    return theme === 'dark' || theme === 'light' ? theme : 'dark';
  }

  return {
    subscribe,
    setTheme: (theme: Theme) => {
      if (browser) {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        set(theme);
      }
    },
    toggleTheme: () => {
      if (browser) {
        const currentTheme = validateTheme(localStorage.getItem('theme'));
        const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(newTheme);
        set(newTheme);
      }
    },
    initTheme: () => {
      if (browser) {
        const savedTheme = localStorage.getItem('theme');
        const theme: Theme = validateTheme(savedTheme) || 'dark'
        
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        set(theme);
        localStorage.setItem('theme', theme);
      }
    }
  };
}

export const themeStore = createThemeStore();
