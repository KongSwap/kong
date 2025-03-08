import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'dark' | 'light' | 'plain-black';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('dark');

  return {
    subscribe,
    set,
    initTheme: () => {
      if (browser) {
        // Get stored theme or default to dark
        const storedTheme = localStorage.getItem('kongTheme') as Theme || 'dark';
        
        // Set theme in localStorage and DOM
        localStorage.setItem('kongTheme', storedTheme);
        
        // Remove all theme classes first
        document.documentElement.classList.remove('dark', 'plain-black');
        
        // Apply the correct theme class
        if (storedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (storedTheme === 'plain-black') {
          document.documentElement.classList.add('plain-black');
        }
        
        // Update store
        set(storedTheme);
        
        // Mark theme as ready
        document.documentElement.setAttribute('data-theme-ready', 'true');
      }
    },
    toggleTheme: () => {
      if (browser) {
        const currentTheme = localStorage.getItem('kongTheme') as Theme || 'dark';
        let newTheme: Theme;
        
        // Cycle through themes: light -> dark -> plain-black -> light
        if (currentTheme === 'light') {
          newTheme = 'dark';
        } else if (currentTheme === 'dark') {
          newTheme = 'plain-black';
        } else {
          newTheme = 'light';
        }
        
        // Remove all theme classes
        document.documentElement.classList.remove('dark', 'plain-black');
        
        // Apply the new theme
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (newTheme === 'plain-black') {
          document.documentElement.classList.add('plain-black');
        }
        
        localStorage.setItem('kongTheme', newTheme);
        set(newTheme);
      }
    },
    setTheme: (theme: Theme) => {
      if (browser) {
        // Remove all theme classes
        document.documentElement.classList.remove('dark', 'plain-black');
        
        // Apply the theme
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (theme === 'plain-black') {
          document.documentElement.classList.add('plain-black');
        }
        
        localStorage.setItem('kongTheme', theme);
        set(theme);
      }
    }
  };
}

export const themeStore = createThemeStore();
