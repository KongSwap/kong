import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Get theme from localStorage or default to 'pixel'
const storedTheme = browser ? localStorage.getItem('theme') : 'pixel';
export const themeStore = writable(storedTheme || 'modern');

// Subscribe to changes and update localStorage
if (browser) {
  themeStore.subscribe((value) => {
    localStorage.setItem('theme', value);
  });
} 
