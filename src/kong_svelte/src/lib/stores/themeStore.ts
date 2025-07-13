import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getThemeById, generateThemeVariables, getAllThemes, registerTheme } from '../themes/themeRegistry';
import type { CoreTheme } from '../themes/coreTypes';

// Define theme ID type based on available themes
export type ThemeId = 'core-dark' | 'core-light' | 'example-core';

export type ColorScheme = 'light' | 'dark';
export const colorScheme: Writable<ColorScheme> = writable('dark');

function createThemeStore() {
  const { subscribe, set } = writable<ThemeId>('core-dark');
  const THEME_KEY = 'theme';
  
  /**
   * Apply a theme's CSS variables to the document root
   * @param themeId The ID of the theme to apply
   */
  function applyThemeStyles(themeId: ThemeId) {
    const theme = getThemeById(themeId);
    const styleElement = document.getElementById('dynamic-theme-styles') || createStyleElement();
    
    // Get the light or dark class based on the theme's colorScheme
    const themeClass = theme.colorScheme === 'light' ? 'light' : 'dark';
    colorScheme.set(theme.colorScheme);
    
    // Apply CSS variables to the appropriate theme class
    const cssContent = `
    /* ${theme.name} theme styles */
    :root.${themeClass} {
      ${generateThemeVariables(theme)}
    }
    
    :root.${themeClass} body {
      font-family: ${theme.typography?.fontFamily || 'inherit'};
    }`;
    
    styleElement.textContent = cssContent;
    
    // Apply theme class to the HTML element by first removing all theme classes
    document.documentElement.classList.remove('light', 'dark');
    
    // Add the appropriate light/dark class based on the theme's colorScheme
    document.documentElement.classList.add(themeClass);
    
    // Also add the specific theme ID as a class for custom selectors
    document.documentElement.classList.remove(...getAllThemes().map(t => `theme-${t.id}`));
    document.documentElement.classList.add(`theme-${theme.id}`);
    
    // Mark the theme as ready
    document.documentElement.setAttribute('data-theme-ready', 'true');
    
    // Add inline style attributes for values that need direct access
    const background = theme.background || {};
    const branding = theme.branding || {};
    const typography = theme.typography || {};
    const effects = theme.effects || {};
    
    document.documentElement.setAttribute('style', 
      `--background-type: ${background.type || 'solid'};
       --enable-nebula: ${effects.enableNebula ? 1 : 0};
       --enable-stars: ${effects.enableStars ? 1 : 0};
       --font-family: ${typography.fontFamily || 'inherit'};
       ${effects.nebulaOpacity !== undefined ? `--nebula-opacity: ${effects.nebulaOpacity};` : ''}
       ${effects.starsOpacity !== undefined ? `--stars-opacity: ${effects.starsOpacity};` : ''}
       ${background.gradient ? `--background-gradient: ${background.gradient};` : ''}
       ${background.solid ? `--background-solid: ${background.solid};` : ''}
       ${background.image ? `--background-image: ${background.image};` : ''}
       ${branding.logoInvert !== undefined ? `--logo-invert: ${branding.logoInvert};` : ''}
       ${branding.logoBrightness !== undefined ? `--logo-brightness: ${branding.logoBrightness};` : ''}
       ${branding.logoHoverBrightness !== undefined ? `--logo-hover-brightness: ${branding.logoHoverBrightness};` : ''}
      `
    );
  }

  /**
   * Create a style element for dynamic theme styles
   */
  function createStyleElement() {
    const styleElement = document.createElement('style');
    styleElement.id = 'dynamic-theme-styles';
    document.head.appendChild(styleElement);
    return styleElement;
  }

  /**
   * Save theme to storage using localStorage
   * @param themeId The ID of the theme to save
   */
  async function saveThemeToStorage(themeId: ThemeId) {
    if (browser) {
      try {
        localStorage.setItem(THEME_KEY, JSON.stringify(themeId));
        return true;
      } catch (error) {
        console.error('Failed to save theme to localStorage:', error);
        return false;
      }
    }
    return false;
  }
  
  /**
   * Load theme from storage using localStorage
   * @returns Promise with the stored theme ID or null if not found
   */
  async function loadThemeFromStorage(): Promise<ThemeId | null> {
    if (browser) {
      try {
        const storedThemeJson = localStorage.getItem(THEME_KEY);
        if (storedThemeJson) {
          const storedTheme = JSON.parse(storedThemeJson) as ThemeId;
          // Validate that the theme still exists
          if (getAllThemes().some(t => t.id === storedTheme)) {
            return storedTheme;
          }
        }
      } catch (error) {
        console.error('Failed to load theme from localStorage:', error);
      }
    }
    return null;
  }

  /**
   * Set the current theme
   * @param themeId The ID of the theme to set
   */
  async function setTheme(themeId: ThemeId) {
    if (browser) {
      applyThemeStyles(themeId);
      await saveThemeToStorage(themeId);
    }
    set(themeId);
  }
  
  /**
   * Register a new theme and apply it
   * @param theme The theme definition to register and apply
   */
  async function registerAndApplyTheme(theme: CoreTheme) {
    if (browser) {
      registerTheme(theme);
      await setTheme(theme.id as ThemeId);
      return true;
    }
    return false;
  }

  /**
   * Toggle between available themes in a cycle
   */
  async function toggleTheme() {
    if (browser) {
      const themes = getAllThemes().map(theme => theme.id) as ThemeId[];
      
      // Get current theme
      const currentTheme = await loadThemeFromStorage() || 'core-dark';
      
      // Find current theme index
      const currentIndex = themes.indexOf(currentTheme);
      
      // Get next theme (cycle back to first if at the end)
      const nextIndex = (currentIndex + 1) % themes.length;
      await setTheme(themes[nextIndex]);
    }
  }

  /**
   * Initialize the theme from localStorage or system preference
   */
  function initTheme() {
    if (browser) {
      // Check if theme was already initialized in app.html
      const isInitializing = document.documentElement.getAttribute('data-theme-initializing') === 'true';
      
      // Mark as not ready until we fully initialize
      document.documentElement.setAttribute('data-theme-ready', 'false');
      
      try {
        // Check for theme in URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const themeParam = urlParams.get('theme');
        
        // If valid theme in URL, apply it immediately
        if (themeParam && getAllThemes().some(theme => theme.id === themeParam)) {
          applyThemeStyles(themeParam as ThemeId);
          set(themeParam as ThemeId);
          
          // Clear initializing attribute if needed
          if (isInitializing) {
            document.documentElement.removeAttribute('data-theme-initializing');
          }
          
          // Mark theme as ready
          document.documentElement.setAttribute('data-theme-ready', 'true');
          return;
        }
        
        // Try to load theme from localStorage
        let themeToApply: ThemeId | null = null;
        const storedThemeJson = localStorage.getItem(THEME_KEY);
        
        if (storedThemeJson) {
          const storedTheme = JSON.parse(storedThemeJson) as ThemeId;
          // Validate the stored theme exists
          if (getAllThemes().some(t => t.id === storedTheme)) {
            themeToApply = storedTheme;
          }
        }
        
        // If no theme found in localStorage, use system preference
        if (!themeToApply) {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          themeToApply = prefersDark ? 'core-dark' : 'core-light';
        }
        
        // Apply the theme immediately
        applyThemeStyles(themeToApply);
        set(themeToApply);
        
        // Save the theme if it was from system preference
        if (!storedThemeJson) {
          saveThemeToStorage(themeToApply);
        }
        
        // Clear initializing attribute if needed
        if (isInitializing) {
          document.documentElement.removeAttribute('data-theme-initializing');
        }
        
        // Mark theme as ready
        document.documentElement.setAttribute('data-theme-ready', 'true');
        
      } catch (error) {
        console.error('Error initializing theme:', error);
        
        // Fallback to dark theme
        applyThemeStyles('core-dark');
        set('core-dark');
        
        // Clear initializing attribute if needed
        if (isInitializing) {
          document.documentElement.removeAttribute('data-theme-initializing');
        }
        
        // Mark as ready even in case of error
        document.documentElement.setAttribute('data-theme-ready', 'true');
      }
    }
  }

  // Initialize on module load
  if (browser) {
    // Initialize theme immediately to prevent flash
    initTheme();
  }

  return {
    subscribe,
    setTheme,
    initTheme,
    toggleTheme,
    loadThemeFromStorage,
    saveThemeToStorage,
    registerAndApplyTheme
  };
}

export const themeStore = createThemeStore();