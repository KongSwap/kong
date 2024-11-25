import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Always use modern theme, ignoring stored value
const storedMode = browser ? localStorage.getItem('themeMode') : 'dark';

// Create a readonly store that always returns 'modern'
export const themeStore = writable('modern');
export const themeModeStore = writable(storedMode || 'dark');

// Subscribe to changes and update localStorage
if (browser) {
  themeStore.subscribe(() => {
    localStorage.setItem('theme', 'modern');
    document.documentElement.setAttribute('data-theme', 'modern');
  });

  themeModeStore.subscribe((value) => {
    localStorage.setItem('themeMode', value);
    if (value === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });
}
