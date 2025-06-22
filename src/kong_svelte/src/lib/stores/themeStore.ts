import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getThemeById, generateThemeVariables, getAllThemes, registerTheme } from '../themes/themeRegistry';
import type { ThemeDefinition } from '../themes/baseTheme';
import { get } from 'svelte/store';

// Define theme ID type based on available themes
export type ThemeId = 'dark' | 'light' | 'plain-black' | 'nord' | 'modern-light' | 'microswap' | 'synthwave' | 'dragginz';

export type ColorScheme = 'light' | 'dark';
export const colorScheme: Writable<ColorScheme> = writable('dark');

function createThemeStore() {
  const { subscribe, set } = writable<ThemeId>('dark');
  const { subscribe: colorSchemeSubscribe } = colorScheme;
  const THEME_KEY = 'theme';
  
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
    colorScheme.set(theme.colorScheme);
    
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
       --font-family: ${theme.colors.fontFamily || 'inherit'};
       ${theme.colors.nebulaOpacity ? `--nebula-opacity: ${theme.colors.nebulaOpacity};` : ''}
       ${theme.colors.starsOpacity ? `--stars-opacity: ${theme.colors.starsOpacity};` : ''}
       ${theme.colors.backgroundGradient ? `--background-gradient: ${theme.colors.backgroundGradient};` : ''}
       ${theme.colors.backgroundSolid ? `--background-solid: ${theme.colors.backgroundSolid};` : ''}
       ${theme.colors.backgroundImage ? `--background-image: ${theme.colors.backgroundImage};` : ''}
       ${theme.colors.backgroundFallbackGradient ? `--background-fallback-gradient: ${theme.colors.backgroundFallbackGradient};` : ''}
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
       
       /* Swap button styling variables */
       ${theme.colors.swapButtonPrimaryGradientStart ? `--swap-button-primary-gradient-start: ${theme.colors.swapButtonPrimaryGradientStart};` : ''}
       ${theme.colors.swapButtonPrimaryGradientEnd ? `--swap-button-primary-gradient-end: ${theme.colors.swapButtonPrimaryGradientEnd};` : ''}
       ${theme.colors.swapButtonErrorGradientStart ? `--swap-button-error-gradient-start: ${theme.colors.swapButtonErrorGradientStart};` : ''}
       ${theme.colors.swapButtonErrorGradientEnd ? `--swap-button-error-gradient-end: ${theme.colors.swapButtonErrorGradientEnd};` : ''}
       ${theme.colors.swapButtonProcessingGradientStart ? `--swap-button-processing-gradient-start: ${theme.colors.swapButtonProcessingGradientStart};` : ''}
       ${theme.colors.swapButtonProcessingGradientEnd ? `--swap-button-processing-gradient-end: ${theme.colors.swapButtonProcessingGradientEnd};` : ''}
       ${theme.colors.swapButtonBorderColor ? `--swap-button-border-color: ${theme.colors.swapButtonBorderColor};` : ''}
       ${theme.colors.swapButtonGlowColor ? `--swap-button-glow-color: ${theme.colors.swapButtonGlowColor};` : ''}
       ${theme.colors.swapButtonShineColor ? `--swap-button-shine-color: ${theme.colors.swapButtonShineColor};` : ''}
       ${theme.colors.swapButtonReadyGlowStart ? `--swap-button-ready-glow-start: ${theme.colors.swapButtonReadyGlowStart};` : ''}
       ${theme.colors.swapButtonReadyGlowEnd ? `--swap-button-ready-glow-end: ${theme.colors.swapButtonReadyGlowEnd};` : ''}
       ${theme.colors.swapButtonTextColor ? `--swap-button-text-color: ${theme.colors.swapButtonTextColor};` : ''}
       ${theme.colors.swapButtonShadow ? `--swap-button-shadow: ${theme.colors.swapButtonShadow};` : ''}
       ${theme.colors.swapPanelRoundness ? `--swap-panel-roundness: ${theme.colors.swapPanelRoundness};` : ''}
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
          return storedTheme;
        }
      } catch (error) {
        console.error('Failed to load theme from localStorage:', error);
      }
    }
    return null;
  }

  /**
   * Get theme quickly (synchronously) for initial UI render
   * @returns Theme ID or null
   */
  function getQuickTheme(): ThemeId | null {
    if (browser) {
      try {
        // Get cached theme ID from memory if it exists
        const cachedTheme = get({ subscribe }) as ThemeId;
        if (cachedTheme) {
          return cachedTheme;
        }
        
        // Default based on system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
      } catch (error) {
        console.error('Error getting quick theme:', error);
      }
    }
    return 'dark';
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
  async function registerAndApplyTheme(theme: ThemeDefinition) {
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
      const currentTheme = await loadThemeFromStorage() || 'dark';
      
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
          themeToApply = JSON.parse(storedThemeJson) as ThemeId;
        }
        
        // If no theme found in localStorage, use system preference
        if (!themeToApply) {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          themeToApply = prefersDark ? 'dark' : 'light';
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
        applyThemeStyles('dark');
        set('dark');
        
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
    // Delay initialization slightly to let the DOM load first
    setTimeout(initTheme, 0);
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
