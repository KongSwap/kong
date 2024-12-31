import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'dark' | 'light';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('dark');

  function validateTheme(theme: string | null): Theme {
    return theme === 'dark' || theme === 'light' ? theme : 'dark';
  }

  let initialized = false;

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
      if (initialized || !browser) return;
      
      const theme = localStorage.getItem('theme');
      if (theme) {
        document.documentElement.classList.toggle('dark', theme === 'dark');
      } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      }
      
      initialized = true;
    }
  };
}

export const themeStore = createThemeStore();
