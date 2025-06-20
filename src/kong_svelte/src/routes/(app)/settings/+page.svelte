<script lang="ts">
  import { onMount } from 'svelte';
  import { themeStore, type ThemeId } from '$lib/stores/themeStore';
  import { getAllThemes } from '$lib/themes/themeRegistry';
  import type { ThemeDefinition } from '$lib/themes/baseTheme';
  import Toggle from '$lib/components/common/Toggle.svelte';
  import Slider from '$lib/components/common/Slider.svelte';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { auth } from '$lib/stores/auth';
  import { browser } from '$app/environment';
  import { Settings as SettingsIcon, ArrowLeft } from 'lucide-svelte';
  import PageHeader from '$lib/components/common/PageHeader.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import type { ComponentType } from 'svelte';
  import { userTokens } from '$lib/stores/userTokens';
  import { currentUserBalancesStore } from '$lib/stores/balancesStore';
  import { notificationsStore } from '$lib/stores/notificationsStore';
  
  // State variables
  let themes = $state<ThemeDefinition[]>([]);
  let currentThemeId = $state('');
  let showThemeCreator = $state(false);
  let ThemeCreator = $state<ComponentType<any> | undefined>(undefined);
  let soundEnabled = $state(true);
  let tickerEnabled = $state(true);
  let slippageValue = $state<number>(2.0);
  let slippageInputValue = $state('2.0');
  let isCustomSlippage = $state(false);
  let previousAuthState = $state({ isConnected: false, principalId: null });
  let isThemeDropdownOpen = $state(false);
  
  // Constants
  const quickSlippageValues = [1, 2, 3, 5];
  const SETTINGS_KEY = 'settings';
  const FAVORITES_KEY = 'favoriteTokens';
  
  // Loading states for async operations
  let loadingSlippage = $state(false);
  let loadingSound = $state(false);
  let loadingTicker = $state(false);
  
  // Storage keys
  const SLIPPAGE_KEY = 'slippage';
  
  // Initialize when component mounts
  onMount(() => {
    // Get all available themes
    themes = getAllThemes();
    
    // Subscribe to theme changes
    const unsubscribe = themeStore.subscribe(themeId => {
      currentThemeId = themeId;
    });
    
    // Dynamically import the ThemeCreator component
    import('./ThemeCreator.svelte')
      .then(module => {
        ThemeCreator = module.default;
        showThemeCreator = true;
      })
      .catch(error => {
        console.error('Error loading ThemeCreator:', error);
      });
    
    // Load user settings
    loadUserSettings();
    
    // Handle resize for mobile detection
    if (browser) {
      window.addEventListener('click', handleClickOutside);
      initializeSlippageFromStorage();
      return () => {
        window.removeEventListener('click', handleClickOutside);
        unsubscribe();
      }
    }
    
    return () => {
      unsubscribe();
    };
  });
  
  // Subscribe to settings changes - ONLY for non-slider values
  $effect(() => {
    if ($settingsStore) {
      soundEnabled = $settingsStore.sound_enabled;
      tickerEnabled = $settingsStore.ticker_enabled ?? true;
      // DO NOT update slippageValue here
    }
  });
  
  // Watch for auth changes to reload settings when user authenticates
  $effect(() => {
    const currentAuthState = {
      isConnected: $auth.isConnected,
      principalId: $auth.account?.owner || null
    };
    
    // Check if auth state has changed
    if (browser && 
        (previousAuthState.isConnected !== currentAuthState.isConnected || 
         previousAuthState.principalId !== currentAuthState.principalId)) {
      
      loadUserSettings();
      
      // Update previous state
      previousAuthState = currentAuthState;
    }
  });
  
  // Apply a theme when selected
  async function applyTheme(themeId: string) {
    try {     
      await themeStore.setTheme(themeId as ThemeId);
      
      // Force update UI
      currentThemeId = themeId;
      isThemeDropdownOpen = false;
      
      // Show success toast
      toastStore.info('Theme applied successfully');
    } catch (error) {
      console.error('[Settings] Error applying theme:', error);
      toastStore.error('Failed to apply theme');
    }
  }
  
  // Function to get settings from localStorage
  async function getSettings() {
    if (browser) {
      const walletId = $auth?.account?.owner || 'default';
      const settingsKey = `${SETTINGS_KEY}_${walletId}`;
      
      try {
        const stored = localStorage.getItem(settingsKey);
        const storedSettings = stored ? JSON.parse(stored) as {
          sound_enabled: boolean;
          ticker_enabled?: boolean;
          max_slippage: number;
          timestamp: number;
        } : null;
        
        if (storedSettings) {
          return storedSettings;
        }
      } catch (error) {
        console.error('Error loading settings from storage:', error);
      }
    }
    
    // Default settings if nothing found
    return {
      sound_enabled: true,
      ticker_enabled: true,
      max_slippage: 2.0,
      timestamp: Date.now()
    };
  }
  
  // Function to save settings to localStorage
  async function saveSettings(settings: any) {
    if (browser) {
      try {
        const walletId = $auth?.account?.owner || 'default';
        const settingsKey = `${SETTINGS_KEY}_${walletId}`;
        
        // Add timestamp
        const settingsToSave = {
          ...settings,
          timestamp: Date.now()
        };
        
        localStorage.setItem(settingsKey, JSON.stringify(settingsToSave));
        return true;
      } catch (error) {
        console.error('Error saving settings to storage:', error);
        return false;
      }
    }
    return false;
  }
  
  // Function to load and apply user settings
  async function loadUserSettings() {
    const settings = await getSettings();
    soundEnabled = settings.sound_enabled;
    tickerEnabled = settings.ticker_enabled ?? true;
    // Restore slippage loading here
    slippageValue = settings.max_slippage || 2.0; 
    slippageInputValue = slippageValue.toString();
    isCustomSlippage = !quickSlippageValues.includes(slippageValue);
    
    // Update settings store
    settingsStore.set(settings);
  }
  
  // Initialize slippage from storage or default to 2.0
  async function initializeSlippageFromStorage() {
    if (browser) {
      try {
        const walletId = $auth?.account?.owner || 'default';
        const slippageKey = `slippage_${walletId}`;
        
        const stored = localStorage.getItem(`${SLIPPAGE_KEY}:${slippageKey}`);
        const storedSlippage = stored ? JSON.parse(stored) : null;
        if (storedSlippage) {
          const value = typeof storedSlippage === 'string' 
            ? parseFloat(storedSlippage) 
            : (storedSlippage as number);
            
          slippageValue = value;
          slippageInputValue = value.toString();
          isCustomSlippage = !quickSlippageValues.includes(value);
        }
      } catch (error) {
        console.error('Error loading slippage from storage:', error);
      }
    }
  }
  
  // Save slippage to storage
  async function saveSlippageToStorage(value: number) {
    if (browser) {
      try {
        const walletId = $auth?.account?.owner || 'default';
        const slippageKey = `slippage_${walletId}`;
        
        localStorage.setItem(`${SLIPPAGE_KEY}:${slippageKey}`, JSON.stringify(value));
        
        // Update the settings store as well for consistency
        settingsStore.updateSetting('max_slippage', value);
        
        // Also save to the settings storage
        const currentSettings = await getSettings();
        await saveSettings({
          ...currentSettings,
          max_slippage: value
        });
        
        return true;
      } catch (error) {
        console.error('Error saving slippage to storage:', error);
        return false;
      }
    }
    return false;
  }
  
  // Use a handler for the change event (fires after sliding stops)
  function handleSlippageChange() {
    // Value is already updated by bind:value
    saveCurrentSlippage();
  }

  async function saveCurrentSlippage() {
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      // Revert value if needed, or rely on loadUserSettings on connect
      // Consider reloading settings here to ensure UI reflects stored state
      await loadUserSettings(); 
      return;
    }
    if (loadingSlippage) return; // Prevent concurrent saves

    loadingSlippage = true;
    // Get the current value from the bound variable
    const valueToSave = Math.min(Math.max(slippageValue, 0.1), 99);
    // Update state variables (input might already be updated by bind:value, but ensure consistency)
    slippageValue = valueToSave; 
    slippageInputValue = valueToSave.toFixed(1);
    isCustomSlippage = !quickSlippageValues.includes(valueToSave);

    try {
      const success = await saveSlippageToStorage(valueToSave);
      if (success) {
        toastStore.success('Slippage setting saved');
      } else {
        toastStore.error('Failed to save slippage');
        await loadUserSettings(); // Revert UI on failure
      }
    } catch (error) {
      console.error("Error during slippage save:", error);
      toastStore.error('Error saving slippage');
      await loadUserSettings(); // Revert UI on error
    } finally {
      loadingSlippage = false;
    }
  }

  // Function to set slippage from quick buttons
  function setSlippage(value: number) {
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    // Directly update the value and trigger the save
    slippageValue = value;
    saveCurrentSlippage(); 
  }

  function handleToggleSound(event: CustomEvent<boolean>) {
    const intendedValue = event.detail;
    // Immediately revert if not allowed to change
    if (!$auth.isConnected || loadingSound) {
      soundEnabled = !intendedValue; // Revert optimistic UI change from toggle
      if (!$auth.isConnected) {
         toastStore.error('Please connect your wallet to save settings');
      }
      // Prevent component's internal state update if needed, though reverting `soundEnabled` should suffice
      event.preventDefault(); 
      return;
    }

    loadingSound = true;
    soundEnabled = intendedValue; // Allow optimistic UI update

    // Update the settings store
    settingsStore.updateSetting('sound_enabled', intendedValue);

    // Save to storage
    getSettings().then(currentSettings => {
      saveSettings({
        ...currentSettings,
        sound_enabled: intendedValue
      }).then(success => {
        if (success) {
          toastStore.info('Sound setting saved');
        } else {
          toastStore.error('Failed to save sound setting');
          // Revert UI on failure
          soundEnabled = !intendedValue;
          settingsStore.updateSetting('sound_enabled', !intendedValue);
        }
      }).catch(error => {
         console.error("Error saving sound setting:", error);
         toastStore.error('Error saving sound setting');
         soundEnabled = !intendedValue; // Revert
         settingsStore.updateSetting('sound_enabled', !intendedValue);
      }).finally(() => {
        loadingSound = false;
      });
    });
  }

  function handleToggleTicker(event: CustomEvent<boolean>) {
    const intendedValue = event.detail;
    // Immediately revert if not allowed to change
    if (loadingTicker) {
      tickerEnabled = !intendedValue; // Revert optimistic UI change from toggle
      event.preventDefault(); 
      return;
    }

    loadingTicker = true;
    tickerEnabled = intendedValue; // Allow optimistic UI update

    // Update the settings store
    settingsStore.updateSetting('ticker_enabled', intendedValue);

    // Save to storage
    getSettings().then(currentSettings => {
      saveSettings({
        ...currentSettings,
        ticker_enabled: intendedValue
      }).then(success => {
        if (success) {
          toastStore.success('Ticker visibility updated');
        } else {
          toastStore.error('Failed to save ticker setting');
          // Revert UI on failure
          tickerEnabled = !intendedValue;
          settingsStore.updateSetting('ticker_enabled', !intendedValue);
        }
      }).catch(error => {
         console.error("Error saving ticker setting:", error);
         toastStore.error('Error saving ticker setting');
         tickerEnabled = !intendedValue; // Revert
         settingsStore.updateSetting('ticker_enabled', !intendedValue);
      }).finally(() => {
        loadingTicker = false;
      });
    });
  }
  
  async function clearFavorites() {
    if (confirm('Are you sure you want to clear your favorite tokens?')) {
      if (browser) {
        try {
          // Get the wallet ID
          const walletId = $auth?.account?.owner || 'default';
          const favoritesKey = `${FAVORITES_KEY}_${walletId}`;
          
          // Clear favorites from storage
          localStorage.removeItem(`${FAVORITES_KEY}:${favoritesKey}`);
          toastStore.success('Favorites cleared successfully. Refresh may be needed.'); 
        } catch (error) {
          console.error('Error clearing favorites:', error);
          toastStore.error('Failed to clear favorites');
        }
      }
    }
  }
  
  async function resetDatabase() {
    try {
      if (confirm('Are you sure you want to reset the application? This will clear all data and reload the page.')) {
        // Disable the button to prevent multiple clicks
        const button = document.activeElement as HTMLButtonElement;
        if (button) button.disabled = true;
        
        // Show loading toast
        toastStore.info('Resetting application...');
        
        // Clear relevant stores explicitly
        if (browser) {
          try {
            // Disconnect auth, which also clears its storage and resets principal in userTokens
            await auth.disconnect(); 
            
            // Reset user tokens store
            await userTokens.reset();

            // Clear balances store
            currentUserBalancesStore.set({});

            // Clear any remaining settings storage specific to this component/page
            // Clear all settings and slippage items
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
              if (key.startsWith(SETTINGS_KEY) || key.startsWith(SLIPPAGE_KEY)) {
                localStorage.removeItem(key);
              }
            });
            notificationsStore.clearAll();

            // Reset theme to default (dark) immediately
            await themeStore.setTheme('dark');

            toastStore.success('Reset successful, reloading...');
          } catch (error) {
            console.error('Error clearing storage:', error);
            toastStore.error('Error clearing data, forcing reload...');
          }
        }
        
        // Small delay to show the success message
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force reload the page
        window.location.reload();
      }
    } catch (error) {
      console.error('Error resetting application:', error);
      toastStore.error('Reset failed, forcing reload...');
      
      // Force reload as fallback
      setTimeout(() => window.location.reload(), 1000);
    }
  }
  
  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const dropdown = document.getElementById('theme-dropdown');
    if (dropdown && !dropdown.contains(event.target as Node)) {
      isThemeDropdownOpen = false;
    }
  }

  // Navigation function to go back
  function goBack() {
    if (browser) {
      history.back();
    }
  }
</script>

<svelte:head>
  <title>Settings - KongSwap</title>
  <meta name="description" content="Customize Kong's appearance and behavior" />
</svelte:head>

  <!-- Back button -->
  <div class="mb-4 px-4 max-w-[1300px] mx-auto">
    <button
      class="flex items-center gap-2 text-kong-text-secondary hover:text-kong-primary transition-colors"
      onclick={goBack}
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Back</span>
    </button>
  </div>
  
  <!-- Page Header -->
  <PageHeader
    title="Settings"
    description="Customize Kong's appearance and behavior"
    icon={SettingsIcon}
    maxWidth="1300px"
  />

<div class="page-content max-w-[1300px] mx-auto px-4">  
  <!-- General Settings Section -->
  <div class="mt-8 mb-12 space-y-8">
    
    <!-- Wrap Slippage and Settings Grid in a new grid container -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Slippage Section -->
      <Panel className="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-kong-text-primary font-medium text-base">Slippage Tolerance</h3>
        </div>
        <p class="text-sm text-kong-text-secondary mt-1">
          Slippage is the difference between the expected price of a trade and the price at which it's executed. 
          Your current max slippage is set to <span class="font-semibold text-kong-primary">{slippageValue.toFixed(1)}%</span>. 
          High slippage can occur during volatile market conditions.
        </p>

        <div class="space-y-4">
          <Slider
            bind:value={slippageValue}
            min={0.1}
            max={99}
            step={0.1}
            color="kong-primary"
            showInput={true}
            on:change={handleSlippageChange}
            inputClass="w-20 text-center"
          />
        </div>

          <!-- Quick Slippage Buttons -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-kong-text-secondary mr-1">Quick Set:</span>
            {#each quickSlippageValues as val}
              <button
                class="px-3 py-1 text-sm rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                class:border-kong-border={!(slippageValue === val && !isCustomSlippage)}
                class:bg-kong-bg-secondary={!(slippageValue === val && !isCustomSlippage)}
                class:text-kong-text-secondary={!(slippageValue === val && !isCustomSlippage)}
                class:hover:bg-kong-bg-secondary={!(slippageValue === val && !isCustomSlippage)}
                class:hover:border-kong-primary={!(slippageValue === val && !isCustomSlippage)}
                class:bg-kong-primary={slippageValue === val && !isCustomSlippage}
                class:border-kong-primary={slippageValue === val && !isCustomSlippage}
                class:text-white={slippageValue === val && !isCustomSlippage}
                class:hover:bg-kong-primary-hover={slippageValue === val && !isCustomSlippage}
                class:hover:border-kong-primary-hover={slippageValue === val && !isCustomSlippage}
                onclick={() => setSlippage(val)}
                disabled={!$auth.isConnected || loadingSlippage}
              >
                {val}%
              </button>
            {/each}
          </div>

        <!-- Slippage Warnings (Moved) -->
        {#if slippageValue > 10}
          <div class="flex gap-2 items-center p-3 rounded-lg text-sm bg-red-500/10 text-red-500 border border-red-500/20 mt-2">
            <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>High slippage ({slippageValue.toFixed(1)}%) may lead to significant price impact during trades.</span>
          </div>
        {:else if slippageValue > 3}
          <div class="flex gap-2 items-center p-3 rounded-lg text-sm bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 mt-2">
            <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Your slippage ({slippageValue.toFixed(1)}%) is higher than recommended and could result in your trade executing at a less favorable price.</span>
          </div>
        {/if}
      </Panel>

      <!-- Settings Grid (Preferences & Data) -->
      <div class="settings-grid">
        <!-- Combined Application Settings Panel -->
        <Panel className="space-y-4">
          <h3 class="text-kong-text-primary font-medium text-base">General Settings</h3>
          
          <!-- Sound Section -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="block text-kong-text-primary text-sm font-medium">Sound Effects</span>
              <span class="block text-kong-text-secondary text-xs mt-0.5">{soundEnabled ? 'On' : 'Off'}</span>
            </div>
            <Toggle 
              checked={soundEnabled} 
              on:change={handleToggleSound}
              size="md"
              disabled={!$auth.isConnected || loadingSound}
            />
          </div>

          <!-- Ticker Section -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="block text-kong-text-primary text-sm font-medium">Price Ticker</span>
              <span class="block text-kong-text-secondary text-xs mt-0.5">{tickerEnabled ? 'Show top tokens' : 'Hidden'}</span>
            </div>
            <Toggle 
              checked={tickerEnabled} 
              on:change={handleToggleTicker}
              size="md"
              disabled={loadingTicker}
            />
          </div>

          <!-- Clear Favorites Section -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="block text-kong-text-primary text-sm font-medium">Clear Favorites</span>
              <span class="block text-kong-text-secondary text-xs mt-0.5">Remove all saved tokens</span>
            </div>
            <div class="flex items-center gap-2">
              <button 
                class="bg-kong-bg-secondary hover:bg-kong-bg-tertiary text-kong-text-primary px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={clearFavorites}
                disabled={!$auth.isConnected}
              >
                Clear
              </button>
            </div>
          </div>
          
          <!-- Reset Application Section -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="block text-kong-text-primary text-sm font-medium">Reset Application</span>
              <span class="block text-kong-text-secondary text-xs mt-0.5">Clear all local data</span>
            </div>
            <div class="flex items-center gap-2">
              <button 
                class="bg-kong-error/30 hover:bg-kong-error/60 text-red-100 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={resetDatabase}
                disabled={loadingSlippage || loadingSound}
              >
                Reset
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div> <!-- End of new grid container -->
  </div>
  
  <!-- Theme Management Section -->
  <section class="mb-12">
    <h2 class="text-2xl font-bold text-kong-text-primary mb-6">Theme Management</h2>
    
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {#each themes as theme}
        <!-- Theme Card using Panel -->
        <Panel 
          interactive={true}
          className={`
            !p-3
            ${currentThemeId === theme.id ? 'active text-kong-text-primary border-kong-primary border-2 bg-kong-primary/30' : ''}
            hover:!bg-kong-primary/20
          `}
          onclick={() => applyTheme(theme.id)}
        >
          <!-- Theme preview -->
          <div class="theme-preview h-16 mb-2 rounded overflow-hidden border border-kong-border/50 flex">
            <div class="w-1/2 flex flex-col">
              <div class="h-1/2" style="background-color: {theme.colors.bgPrimary}"></div>
              <div class="h-1/2" style="background-color: {theme.colors.bgSecondary}"></div>
            </div>
            <div class="w-1/2 flex flex-col">
              <div class="h-1/3" style="background-color: {theme.colors.primary}"></div>
              <div class="h-1/3" style="background-color: {theme.colors.success}"></div>
              <div class="h-1/3" style="background-color: {theme.colors.error}"></div>
            </div>
          </div>
          
          <!-- Theme info -->
          <h3 class="font-semibold text-sm {currentThemeId === theme.id ? 'text-kong-text-primary' : 'text-kong-text-primary'} mb-1">{theme.name}</h3>
          <div class="flex justify-between items-center">
            {#if theme.author}
              <span class="text-xs {currentThemeId === theme.id ? 'text-kong-text-primary/80' : 'text-kong-text-secondary'} truncate max-w-[80px]">
                {#if theme.authorLink}
                  <a 
                    href={theme.authorLink} 
                    class="hover:underline {currentThemeId === theme.id ? 'text-kong-text-primary' : 'text-kong-primary'}"
                    target="_blank" 
                    rel="noopener noreferrer"
                    onclick={(e) => {
                      e.stopPropagation(); // Prevent theme card click
                    }}
                  >
                    {theme.author}
                  </a>
                {:else}
                  {theme.author}
                {/if}
              </span>
            {:else}
              <span class="text-xs {currentThemeId === theme.id ? 'text-kong-text-primary/80' : 'text-kong-text-secondary'}">—</span>
            {/if}
            {#if currentThemeId === theme.id}
              <span class="text-[10px] px-1.5 py-0.5 bg-kong-primary text-white rounded-full">Active</span>
            {/if}
          </div>
        </Panel>
      {/each}
    </div>
  </section>
  
  <!-- Theme Creator Section -->
  <!-- <section>
    <Panel variant="solid" type="main" className="mb-8">
      <h2 class="text-2xl font-bold text-kong-text-primary mb-6">Create Custom Theme</h2>
      
      <div class="theme-creator-container">
        {#if showThemeCreator && ThemeCreator}
          <svelte:component this={ThemeCreator} />
        {:else}
          <div class="bg-kong-bg-primary/30 p-4 rounded-lg border border-kong-border/20">
            <p class="text-kong-text-primary mb-2">
              Loading theme creator...
            </p>
            <div class="h-1 w-32 bg-kong-bg-secondary overflow-hidden rounded">
              <div class="h-full bg-kong-primary/40 animate-pulse rounded"></div>
            </div>
          </div>
        {/if}
      </div>
    </Panel>
    
    <Panel variant="transparent" className="mt-12">
      <h3 class="text-xl font-bold text-kong-text-primary mb-2">How to Create Themes Programmatically</h3>
      <p class="mb-3 text-kong-text-secondary">You can also create themes through code. Check out the documentation in <code class="bg-kong-bg-primary px-1 py-0.5 rounded text-kong-accent-blue">/lib/themes/README.md</code>.</p>
      
      <div class="code-example bg-kong-bg-primary rounded-lg p-4 overflow-x-auto">
        <pre class="text-kong-text-primary font-mono text-sm">
import type &#123; ThemeDefinition &#125; from '$lib/themes/baseTheme';
import &#123; themeStore &#125; from '$lib/stores/themeStore';

const myCustomTheme: ThemeDefinition = &#123;
  id: 'my-theme',
  name: 'My Custom Theme',
  colorScheme: 'dark light',
  colors: &#123;
    bgPrimary: '#1A1A1A',
    bgSecondary: '#2A2A2A',
    bgTertiary: '#3A3A3A',
    primary: '#FF5722',
    // ... other required colors
  &#125;
&#125;;

// Register and apply the theme
themeStore.registerAndApplyTheme(myCustomTheme);
        </pre>
      </div>
    </Panel>
  </section> -->
</div>

<style lang="postcss">
  :global(.code-example) {
    position: relative;
  }
  
  :global(pre) {
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Removed theme-preview styling as it seems redundant or handled by panel */

  /* Removed :global(.panel.interactive.active) - handled inline */

  /* Removed section-header styling - handled inline */

  /* Removed section-title styling - handled inline */

  /* Removed alert-banner base and variant styling - handled inline */
  
  /* Setting item styles */
  .setting-item {
    @apply flex items-center justify-between py-3;
  }
  
  .setting-item:not(:last-child) {
    @apply border-b border-kong-border/20;
  }
  
  .setting-label {
    @apply flex-1;
  }

  /* Kept global slider input styling */
  :global(.slider-input) {
    @apply bg-kong-bg-primary/40 border border-kong-border rounded-lg;
    padding: 6px 8px;
  }

  :global(.slider::-webkit-slider-thumb) {
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.2);
  }

  :global(.slider::-webkit-slider-runnable-track) {
    @apply h-2;
  }

  /* Add this to ensure slider track updates properly */
  :global(.slider::-webkit-slider-runnable-track) {
    background: linear-gradient(
      to right,
      var(--active-color) 0%,
      var(--active-color) var(--value-percent),
      rgba(255, 255, 255, 0.1) var(--value-percent)
    ) !important;
  }

  /* Removed quick-slippage-btn base and active styling - handled inline */

</style> 