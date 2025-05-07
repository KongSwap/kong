import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getThemeById, generateThemeVariables, getAllThemes, registerTheme } from '../themes/themeRegistry';
import type { ThemeDefinition } from '../themes/baseTheme';
import { STORAGE_KEYS } from '../config/localForage.config';
import { get } from 'svelte/store';
import { auth } from '../stores/auth';

// Define theme ID type based on available themes
export type ThemeId = 'dark' | 'light' | 'plain-black' | 'nord' | 'modern-light' | 'win98light' | 'synthwave' | 'dragginz';

function createThemeStore() {
  const { subscribe, set } = writable<ThemeId>('dark');
  const THEME_KEY = STORAGE_KEYS.THEME;
  let previousAuthState = { isConnected: false, principalId: null };
  
  /**
   * Get the current user ID from auth service or default to 'default'
   */
  function getUserId(): string {
    if (browser) {
      try {
        const authState = get(auth);
        return authState?.account?.owner || 'default';
      } catch (error) {
        console.error('Failed to get user ID:', error);
        return 'default';
      }
    }
    return 'default';
  }
  
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
       ${theme.colors.swapButtonRoundness ? `--swap-button-roundness: ${theme.colors.swapButtonRoundness};` : ''}
       ${theme.colors.swapButtonShadow ? `--swap-button-shadow: ${theme.colors.swapButtonShadow};` : ''}
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
        const walletId = getUserId();
        localStorage.setItem(`${THEME_KEY}_${walletId}`, JSON.stringify(themeId));
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
        // Get wallet ID or default to 'default'
        const walletId = getUserId();
        
        // First try user-specific theme
        const userThemeJson = localStorage.getItem(`${THEME_KEY}_${walletId}`);
        
        if (userThemeJson) {
          const userTheme = JSON.parse(userThemeJson) as ThemeId;
          return userTheme;
        }
        
        // If no user theme, try the default theme
        console.log(`[Theme] No user theme found, trying default key "${THEME_KEY}"`);
        const defaultThemeJson = localStorage.getItem(THEME_KEY);
        if (defaultThemeJson) {
          const defaultTheme = JSON.parse(defaultThemeJson) as ThemeId;
          return defaultTheme;
        }
        
        // If still no theme, try the global default
        const globalDefaultJson = localStorage.getItem(`${THEME_KEY}_default`);
        if (globalDefaultJson) {
          const globalDefault = JSON.parse(globalDefaultJson) as ThemeId;
          return globalDefault;
        }
        
        console.log(`[Theme] No theme found in localStorage, will use system preference`);
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
        // Directly get theme from localStorage for maximum speed
        const walletId = getUserId();
        
        // Try user-specific theme first
        let themeToApply: ThemeId | null = null;
        const userThemeJson = localStorage.getItem(`${THEME_KEY}_${walletId}`);
        
        if (userThemeJson) {
          themeToApply = JSON.parse(userThemeJson) as ThemeId;
        } else {
          // Try default theme
          const defaultThemeJson = localStorage.getItem(THEME_KEY);
          if (defaultThemeJson) {
            themeToApply = JSON.parse(defaultThemeJson) as ThemeId;
          }
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
        if (!userThemeJson && !localStorage.getItem(THEME_KEY)) {
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

  // Create a subscription to the auth store to reload theme when auth changes
  if (browser) {
    auth.subscribe((authState) => {
      const currentAuthState = {
        isConnected: authState.isConnected,
        principalId: authState.account?.owner || null
      };
      
      // Check if auth state has changed in a meaningful way
      if (currentAuthState.isConnected !== previousAuthState.isConnected || 
          currentAuthState.principalId !== previousAuthState.principalId) {
                
        // Wait a bit before loading to make sure auth state has stabilized
        setTimeout(() => {
          loadThemeFromStorage().then(theme => {
            if (theme) {
              setTheme(theme);
            }
          });
        }, 100);
        
        // Update previous state
        previousAuthState = currentAuthState;
      }
    });
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
