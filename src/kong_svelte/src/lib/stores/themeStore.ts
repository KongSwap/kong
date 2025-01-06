import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'dark' | 'light';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('dark');

  return {
    subscribe,
    set,
    initTheme: () => {
      if (browser) {
        // Get stored theme or default to dark
        const storedTheme = localStorage.getItem('theme') as Theme || 'dark';
        
        // Set theme in localStorage and DOM
        localStorage.setItem('theme', storedTheme);
        document.documentElement.classList.toggle('dark', storedTheme === 'dark');
        
        // Update store
        set(storedTheme);
        
        // Mark theme as ready
        document.documentElement.setAttribute('data-theme-ready', 'true');
      }
    },
    toggleTheme: () => {
      if (browser) {
        const currentTheme = localStorage.getItem('theme') as Theme || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        set(newTheme);
      }
    }
  };
}

export const themeStore = createThemeStore();
