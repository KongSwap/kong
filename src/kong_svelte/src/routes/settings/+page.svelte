<script lang="ts">
  import { onMount } from 'svelte';
  import { themeStore, type ThemeId } from '$lib/stores/themeStore';
  import { getAllThemes } from '$lib/themes/themeRegistry';
  import type { ThemeDefinition } from '$lib/themes/baseTheme';
  import Toggle from '$lib/components/common/Toggle.svelte';
  import Slider from '$lib/components/common/Slider.svelte';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { auth } from '$lib/services/auth';
  import { browser } from '$app/environment';
  import { Settings as SettingsIcon, ArrowLeft } from 'lucide-svelte';
  import PageHeader from '$lib/components/common/PageHeader.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import type { ComponentType } from 'svelte';
  import { STORAGE_KEYS, createNamespacedStore, clearAllStorage } from '$lib/config/localForage.config';
  
  let themes: ThemeDefinition[] = [];
  let currentThemeId = '';
  let showThemeCreator = false;
  let ThemeCreator: ComponentType<any> | undefined;
  let soundEnabled = true;
  let slippageValue: number = 2.0;
  let slippageInputValue = '2.0';
  let isMobile = false;
  let isCustomSlippage = false;
  let previousAuthState = { isConnected: false, principalId: null };
  let isThemeDropdownOpen = false;
  const quickSlippageValues = [1, 2, 3, 5];
  const SETTINGS_KEY = STORAGE_KEYS.SETTINGS;
  const FAVORITES_KEY = STORAGE_KEYS.FAVORITE_TOKENS;
  const THEME_KEY = 'theme';
  
  // Create namespaced stores
  const settingsStorage = createNamespacedStore(SETTINGS_KEY);
  const slippageStorage = createNamespacedStore('slippage');
  const favoritesStorage = createNamespacedStore(FAVORITES_KEY);
  
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
    handleResize();
    if (browser) {
      window.addEventListener('resize', handleResize);
      window.addEventListener('click', handleClickOutside);
      initializeSlippageFromStorage();
      loadThemeFromStorage();
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('click', handleClickOutside);
        unsubscribe();
      }
    }
    
    return () => {
      unsubscribe();
    };
  });
  
  // Subscribe to settings changes
  $: if ($settingsStore) {
    soundEnabled = $settingsStore.sound_enabled;
    slippageValue = $settingsStore.max_slippage || 2.0;
    slippageInputValue = slippageValue.toString();
    isCustomSlippage = !quickSlippageValues.includes(slippageValue);
  }
  
  // Watch for auth changes to reload settings when user authenticates
  $: {
    const currentAuthState = {
      isConnected: $auth.isConnected,
      principalId: $auth.account?.owner?.toString() || null
    };
    
    // Check if auth state has changed
    if (browser && 
        (previousAuthState.isConnected !== currentAuthState.isConnected || 
         previousAuthState.principalId !== currentAuthState.principalId)) {
      
      console.log('Auth state changed, reloading user settings');
      loadUserSettings();
      loadThemeFromStorage();
      
      // Update previous state
      previousAuthState = currentAuthState;
    }
  }
  
  // Apply a theme when selected
  async function applyTheme(themeId: string) {
    console.log('Applying theme:', themeId);
    await themeStore.setTheme(themeId as ThemeId);
    // Force update UI
    currentThemeId = themeId;
    isThemeDropdownOpen = false;
    
    // Show success toast
    toastStore.success('Theme applied successfully');
  }
  
  // Load theme from storage - use the store's function to avoid duplication
  async function loadThemeFromStorage() {
    if (browser) {
      const storedTheme = await themeStore.loadThemeFromStorage();
      if (storedTheme) {
        currentThemeId = storedTheme;
      }
    }
  }
  
  // Function to get settings from localForage
  async function getSettings() {
    if (browser) {
      const walletId = $auth?.account?.owner?.toString() || 'default';
      const settingsKey = `${SETTINGS_KEY}_${walletId}`;
      
      try {
        const storedSettings = await settingsStorage.getItem<{
          sound_enabled: boolean;
          max_slippage: number;
          timestamp: number;
        }>(settingsKey);
        
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
      max_slippage: 2.0,
      timestamp: Date.now()
    };
  }
  
  // Function to save settings to localForage
  async function saveSettings(settings: any) {
    if (browser) {
      try {
        const walletId = $auth?.account?.owner?.toString() || 'default';
        const settingsKey = `${SETTINGS_KEY}_${walletId}`;
        
        // Add timestamp
        const settingsToSave = {
          ...settings,
          timestamp: Date.now()
        };
        
        await settingsStorage.setItem(settingsKey, settingsToSave);
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
        const walletId = $auth?.account?.owner?.toString() || 'default';
        const slippageKey = `slippage_${walletId}`;
        
        const storedSlippage = await slippageStorage.getItem(slippageKey);
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
        const walletId = $auth?.account?.owner?.toString() || 'default';
        const slippageKey = `slippage_${walletId}`;
        
        await slippageStorage.setItem(slippageKey, value);
        
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
  
  function handleSlippageChange() {
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    
    const boundedValue = Math.min(Math.max(slippageValue, 0.1), 99);
    slippageInputValue = boundedValue.toFixed(1);
    isCustomSlippage = !quickSlippageValues.includes(boundedValue);
    
    saveSlippageToStorage(boundedValue).then(success => {
      if (success) {
        toastStore.success('Slippage setting saved');
      }
    });
    
    // Force update for slider track
    slippageValue = boundedValue;
  }
  
  function handleToggleSound(event: CustomEvent<boolean>) {
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      event.preventDefault();
      return;
    }
    
    const newValue = event.detail;
    soundEnabled = newValue;
    
    // Update the settings store
    settingsStore.updateSetting('sound_enabled', newValue);
    
    // Save to storage
    getSettings().then(currentSettings => {
      saveSettings({
        ...currentSettings,
        sound_enabled: newValue
      }).then(success => {
        if (success) {
          toastStore.success('Sound setting saved');
        }
      });
    });
  }
  
  async function clearFavorites() {
    if (confirm('Are you sure you want to clear your favorite tokens?')) {
      if (browser) {
        try {
          // Get the wallet ID
          const walletId = $auth?.account?.owner?.toString() || 'default';
          const favoritesKey = `${FAVORITES_KEY}_${walletId}`;
          
          // Clear favorites from storage
          await favoritesStorage.removeItem(favoritesKey);
          toastStore.success('Favorites cleared successfully. Please refresh the page for changes to take effect.');
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
        
        // Clear all data from storage
        if (browser) {
          try {
            // Clear localForage data
            await clearAllStorage();    
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
  
  function handleResize() {
    if (browser) {
      isMobile = window.innerWidth <= 768;
    }
  }
  
  // Update to set a specific theme instead of toggling
  function setTheme(theme: 'light' | 'dark' | 'plain-black') {
    applyTheme(theme);
  }
  
  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const dropdown = document.getElementById('theme-dropdown');
    if (dropdown && !dropdown.contains(event.target as Node)) {
      isThemeDropdownOpen = false;
    }
  }
  
  // Get display name for current theme
  function getThemeDisplayName(theme: string): string {
    switch (theme) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'plain-black': return 'Plain Black';
      default: return 'Unknown';
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
      on:click={goBack}
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

<div class="page-content max-w-[1300px] mx-auto px-4 lg:px-0">  
  <!-- General Settings Section -->
  <div class="settings-container mt-8 mb-12 space-y-8">
    <!-- Slippage Section -->
    <Panel variant="solid" type="main" className="space-y-4">
      <div class="section-header">
        <h3 class="section-title">Slippage Tolerance</h3>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-kong-primary">{slippageValue.toFixed(1)}%</span>
          <span class="text-kong-text-secondary">Max</span>
        </div>
      </div>

      <div class="slider-section">
        <Slider
          bind:value={slippageValue}
          min={0.1}
          max={99}
          step={0.1}
          color="kong-primary"
          showInput={true}
          on:input={handleSlippageChange}
          inputClass="w-20 text-center"
        />
      
        <div class="risk-labels max-w-[400px] ml-4">
          <span class="text-kong-accent-green">Safe (0.1-2%)</span>
          <span class="text-kong-accent-yellow">Caution (2-5%)</span>
          <span class="text-kong-accent-red">Risky (5%+)</span>
        </div>
      </div>

      {#if slippageValue > 5}
        <div class="alert-banner danger mt-4">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>High slippage may result in significant price impact</span>
        </div>
      {:else if slippageValue > 3}
        <div class="alert-banner warning mt-4">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Higher than recommended slippage</span>
        </div>
      {/if}
    </Panel>

    <!-- Settings Grid -->
    <div class="settings-grid">
      <!-- Sound Section -->
      <Panel variant="solid" className="space-y-4">
        <h3 class="section-title">Preferences</h3>
        <div class="setting-item">
          <div class="setting-label">
            <span>Sound Effects</span>
            <span class="text-kong-text-secondary text-sm">{soundEnabled ? 'On' : 'Off'}</span>
          </div>
          <Toggle 
            checked={soundEnabled} 
            on:change={handleToggleSound}
            size="md"
          />
        </div>
      </Panel>

      <!-- Data Management -->
      <Panel variant="solid" className="space-y-4">
        <h3 class="section-title">Data</h3>
        <div class="setting-item">
          <div class="setting-label">
            <span>Clear Favorites</span>
            <span class="text-kong-text-secondary text-sm">Remove all saved tokens</span>
          </div>
          <div class="flex items-center gap-2">
            <button 
              class="bg-kong-bg-light hover:bg-kong-accent-yellow/60 text-kong-text-primary px-4 py-2 rounded-lg"
              on:click={clearFavorites}
            >
              Clear
            </button>
          </div>
        </div>
        
        <div class="setting-item">
          <div class="flex flex-col">
            <span>Reset Application</span>
            <span class="text-kong-text-secondary text-sm">Clear all local data</span>
          </div>
          <div class="flex items-center gap-2">
            <button 
              class="bg-kong-accent-red/30 hover:bg-kong-accent-red/60 text-red-100 px-4 py-2 rounded-lg"
              on:click={resetDatabase}
            >
              Reset
            </button>
          </div>
        </div>
      </Panel>
    </div>
  </div>
  
  <!-- Theme Management Section -->
  <section class="mb-12">
    <h2 class="text-2xl font-bold text-kong-text-primary mb-6">Theme Management</h2>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each themes as theme}
        <!-- Theme Card using Panel -->
        <Panel 
          variant="solid" 
          interactive={true}
          className={currentThemeId === theme.id ? 'active' : ''}
          on:click={() => applyTheme(theme.id)}
          on:keydown={(e) => e.key === 'Enter' && applyTheme(theme.id)}
        >
          <!-- Theme preview -->
          <div class="theme-preview h-28 mb-3 rounded overflow-hidden border border-kong-border flex">
            <div class="w-1/2 flex flex-col">
              <div class="h-1/2 flex items-center justify-center" style="background-color: {theme.colors.bgDark}">
                <div class="w-8 h-2 rounded-full" style="background-color: {theme.colors.primary}"></div>
              </div>
              <div class="h-1/2 flex items-center justify-center" style="background-color: {theme.colors.bgLight}">
                <div class="w-6 h-2 rounded-full" style="background-color: {theme.colors.accentBlue}"></div>
              </div>
            </div>
            <div class="w-1/2 flex flex-col">
              <div class="h-1/3" style="background-color: {theme.colors.primary}"></div>
              <div class="h-1/3" style="background-color: {theme.colors.accentGreen}"></div>
              <div class="h-1/3" style="background-color: {theme.colors.accentRed}"></div>
            </div>
          </div>
          
          <!-- Theme info -->
          <h3 class="font-bold {currentThemeId === theme.id ? 'text-kong-text-on-primary' : 'text-kong-text-primary'}">{theme.name}</h3>
          <div class="flex justify-between items-center mt-2">
            {#if theme.author}
              <span class="text-sm {currentThemeId === theme.id ? 'text-kong-text-on-primary/80' : 'text-kong-text-secondary'}">
                {#if theme.authorLink}
                  <a 
                    href={theme.authorLink} 
                    class="hover:underline {currentThemeId === theme.id ? 'text-kong-text-on-primary' : 'text-kong-primary'}"
                    target="_blank" 
                    rel="noopener noreferrer"
                    on:click|stopPropagation
                  >
                    {theme.author}
                  </a>
                {:else}
                  {theme.author}
                {/if}
              </span>
            {:else}
              <span class="text-sm {currentThemeId === theme.id ? 'text-kong-text-on-primary/80' : 'text-kong-text-secondary'}">—</span>
            {/if}
            {#if currentThemeId === theme.id}
              <span class="text-xs px-2 py-1 bg-kong-primary text-white rounded-full">Active</span>
            {:else}
              <button 
                class="text-xs px-2 py-1 bg-kong-bg-dark hover:bg-kong-hover-bg-light text-kong-text-primary rounded-full transition-colors"
                on:click|stopPropagation={() => applyTheme(theme.id)}
              >
                Apply
              </button>
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
          <div class="bg-kong-bg-dark/30 p-4 rounded-lg border border-kong-border/20">
            <p class="text-kong-text-primary mb-2">
              Loading theme creator...
            </p>
            <div class="h-1 w-32 bg-kong-bg-light overflow-hidden rounded">
              <div class="h-full bg-kong-primary/40 animate-pulse rounded"></div>
            </div>
          </div>
        {/if}
      </div>
    </Panel>
    
    <Panel variant="transparent" className="mt-12">
      <h3 class="text-xl font-bold text-kong-text-primary mb-2">How to Create Themes Programmatically</h3>
      <p class="mb-3 text-kong-text-secondary">You can also create themes through code. Check out the documentation in <code class="bg-kong-bg-dark px-1 py-0.5 rounded text-kong-accent-blue">/lib/themes/README.md</code>.</p>
      
      <div class="code-example bg-kong-bg-dark rounded-lg p-4 overflow-x-auto">
        <pre class="text-kong-text-primary font-mono text-sm">
import type &#123; ThemeDefinition &#125; from '$lib/themes/baseTheme';
import &#123; themeStore &#125; from '$lib/stores/themeStore';

const myCustomTheme: ThemeDefinition = &#123;
  id: 'my-theme',
  name: 'My Custom Theme',
  colorScheme: 'dark light',
  colors: &#123;
    bgDark: '#1A1A1A',
    bgLight: '#2A2A2A',
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

  /* Theme preview styling */
  .theme-preview {
    @apply border border-kong-border/20 rounded overflow-hidden;
    transition: all 0.2s ease;
  }

  /* Make panels with active class have proper styling */
  :global(.panel.interactive.active) {
    @apply border-kong-primary bg-kong-primary-hover bg-opacity-10;
  }

  .section-header {
    @apply flex items-center justify-between;
  }

  .section-title {
    @apply text-kong-text-primary font-medium text-base;
  }

  .alert-banner {
    @apply flex gap-2 items-center p-3 rounded-lg text-sm;
  }

  .alert-banner.warning {
    @apply bg-yellow-500/10 text-yellow-500 border border-yellow-500/20;
  }

  .alert-banner.danger {
    @apply bg-red-500/10 text-red-500 border border-red-500/20;
  }

  .settings-grid {
    @apply grid gap-4 md:grid-cols-2;
  }

  .setting-item {
    @apply flex items-center justify-between py-3;
    &:not(:last-child) {
      @apply border-b border-kong-border/20;
    }
  }

  .setting-label {
    @apply space-y-1;
    > span:first-child {
      @apply text-kong-text-primary text-sm;
    }
  }

  .slider-section {
    @apply space-y-6;
  }

  .risk-labels {
    @apply flex justify-between text-xs px-1 text-kong-text-secondary;
  }

  /* Update slider styles to match design system */
  :global(.slider-input) {
    @apply bg-kong-bg-dark/40 border border-kong-border rounded-lg;
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
</style> 