import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getThemeById, generateThemeVariables, getAllThemes } from '../themes/themeRegistry';
import type { ThemeDefinition } from '../themes/baseTheme';

// Define theme ID type based on available themes
export type ThemeId = 'dark' | 'light' | 'plain-black' | 'nord' | 'modern-light' | 'win98light';

function createThemeStore() {
  const { subscribe, set } = writable<ThemeId>('dark');

  /**
   * Apply a theme's CSS variables to the document root
   * @param themeId The ID of the theme to apply
   */
  function applyThemeStyles(themeId: ThemeId) {
    const theme = getThemeById(themeId);
    const styleElement = document.getElementById('dynamic-theme-styles') || createStyleElement();
    
    // Generate the CSS with the appropriate selector for each theme
    // This ensures theme-specific styles (like border colors) are properly scoped
    let cssContent;
    
    // Get the light or dark class based on the theme's colorScheme
    const themeClass = theme.colorScheme === 'light' ? 'light' : 'dark';
    
    // Apply CSS variables to the appropriate theme class
    cssContent = `
    /* ${theme.name} theme styles */
    :root.${themeClass} {
      ${generateThemeVariables(theme)}
    }
    
    :root.${themeClass} body {
      font-family: ${theme.colors.fontFamily || 'inherit'};
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
    
    // Add inline style attribute to root for background CSS variables access in selectors
    // This is needed because CSS variables can't be directly used in :root selectors
    document.documentElement.setAttribute('style', 
      `--background-type: ${theme.colors.backgroundType};
       --enable-nebula: ${theme.colors.enableNebula ? 1 : 0};
       --enable-stars: ${theme.colors.enableStars ? 1 : 0};
       --enable-skyline: ${theme.colors.enableSkyline ? 1 : 0};
       --font-family: ${theme.colors.fontFamily || 'inherit'};
       ${theme.colors.nebulaOpacity ? `--nebula-opacity: ${theme.colors.nebulaOpacity};` : ''}
       ${theme.colors.starsOpacity ? `--stars-opacity: ${theme.colors.starsOpacity};` : ''}
       ${theme.colors.backgroundGradient ? `--background-gradient: ${theme.colors.backgroundGradient};` : ''}
       ${theme.colors.backgroundSolid ? `--background-solid: ${theme.colors.backgroundSolid};` : ''}
       ${theme.colors.backgroundImage ? `--background-image: ${theme.colors.backgroundImage};` : ''}
       ${theme.colors.logoPath ? `--logo-path: ${theme.colors.logoPath};` : ''}
       ${theme.colors.logoInvert !== undefined ? `--logo-invert: ${theme.colors.logoInvert};` : ''}
       ${theme.colors.logoBrightness !== undefined ? `--logo-brightness: ${theme.colors.logoBrightness};` : ''}
       ${theme.colors.logoHoverBrightness !== undefined ? `--logo-hover-brightness: ${theme.colors.logoHoverBrightness};` : ''}
       
       /* Token ticker styling variables */
       ${theme.colors.tokenTickerBg ? `--token-ticker-bg: ${theme.colors.tokenTickerBg};` : ''}
       ${theme.colors.tokenTickerText ? `--token-ticker-text: ${theme.colors.tokenTickerText};` : ''}
       ${theme.colors.tokenTickerBorder ? `--token-ticker-border: ${theme.colors.tokenTickerBorder};` : ''}
       ${theme.colors.tokenTickerBorderStyle ? `--token-ticker-border-style: ${theme.colors.tokenTickerBorderStyle};` : ''}
       ${theme.colors.tokenTickerRoundness ? `--token-ticker-roundness: ${theme.colors.tokenTickerRoundness};` : ''}
       ${theme.colors.tokenTickerHoverBg ? `--token-ticker-hover-bg: ${theme.colors.tokenTickerHoverBg};` : ''}
       ${theme.colors.tokenTickerShadow ? `--token-ticker-shadow: ${theme.colors.tokenTickerShadow};` : ''}
       ${theme.colors.tokenTickerUpColor ? `--token-ticker-up-color: ${theme.colors.tokenTickerUpColor};` : ''}
       ${theme.colors.tokenTickerDownColor ? `--token-ticker-down-color: ${theme.colors.tokenTickerDownColor};` : ''}
       ${theme.colors.tokenTickerBgOpacity !== undefined ? `--token-ticker-bg-opacity: ${theme.colors.tokenTickerBgOpacity};` : ''}
       
       /* Button styling variables */
       ${theme.colors.buttonBg ? `--button-bg: ${theme.colors.buttonBg};` : ''}
       ${theme.colors.buttonHoverBg ? `--button-hover-bg: ${theme.colors.buttonHoverBg};` : ''}
       ${theme.colors.buttonText ? `--button-text: ${theme.colors.buttonText};` : ''}
       ${theme.colors.buttonBorder ? `--button-border: ${theme.colors.buttonBorder};` : ''}
       ${theme.colors.buttonBorderColor ? `--button-border-color: ${theme.colors.buttonBorderColor};` : ''}
       ${theme.colors.buttonShadow ? `--button-shadow: ${theme.colors.buttonShadow};` : ''}
       ${theme.colors.buttonRoundness ? `--button-roundness: ${theme.colors.buttonRoundness};` : ''}
       
       /* Primary button styling variables */
       ${theme.colors.primaryButtonBg ? `--primary-button-bg: ${theme.colors.primaryButtonBg};` : ''}
       ${theme.colors.primaryButtonHoverBg ? `--primary-button-hover-bg: ${theme.colors.primaryButtonHoverBg};` : ''}
       ${theme.colors.primaryButtonText ? `--primary-button-text: ${theme.colors.primaryButtonText};` : ''}
       ${theme.colors.primaryButtonBorder ? `--primary-button-border: ${theme.colors.primaryButtonBorder};` : ''}
       ${theme.colors.primaryButtonBorderColor ? `--primary-button-border-color: ${theme.colors.primaryButtonBorderColor};` : ''}
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
   * Set the current theme
   * @param themeId The ID of the theme to set
   */
  function setTheme(themeId: ThemeId) {
    if (browser) {
      applyThemeStyles(themeId);
      localStorage.setItem('theme', themeId);
    }
    set(themeId);
  }

  /**
   * Toggle between available themes in a cycle
   */
  function toggleTheme() {
    if (browser) {
      const themes = getAllThemes().map(theme => theme.id) as ThemeId[];
      // Get current theme
      const currentTheme = localStorage.getItem('theme') as ThemeId || 'dark';
      // Find current theme index
      const currentIndex = themes.indexOf(currentTheme);
      // Get next theme (cycle back to first if at the end)
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex]);
    }
  }

  /**
   * Initialize the theme from local storage or system preference
   */
  function initTheme() {
    if (browser) {
      // Start with data-theme-ready="false" to hide content during loading
      document.documentElement.setAttribute('data-theme-ready', 'false');
      
      const savedTheme = localStorage.getItem('theme') as ThemeId | null;
      const availableThemes = getAllThemes().map(theme => theme.id);
      
      // Determine which theme to use
      let themeToApply: ThemeId;
      if (savedTheme && availableThemes.includes(savedTheme)) {
        themeToApply = savedTheme as ThemeId;
      } else {
        // If no theme saved, use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        themeToApply = prefersDark ? 'dark' : 'light';
      }
      
      // Apply color scheme class early to prevent flashing
      const theme = getThemeById(themeToApply);
      const themeClass = theme.colorScheme === 'light' ? 'light' : 'dark';
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(themeClass);
      
      // Then apply full theme with a slight delay to ensure DOM is ready
      setTimeout(() => {
        setTheme(themeToApply);
        
        // Mark theme as ready after styles are applied
        setTimeout(() => {
          document.documentElement.setAttribute('data-theme-ready', 'true');
        }, 50);
      }, 10);
    }
  }

  // Initialize on module load
  if (browser) {
    // Delay initialization slightly to let the DOM load first
    setTimeout(initTheme, 0);
  }

  return {
    subscribe,
    setTheme,
    initTheme,
    toggleTheme
  };
}

export const themeStore = createThemeStore();
