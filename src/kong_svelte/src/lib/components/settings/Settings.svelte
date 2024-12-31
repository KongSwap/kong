<script lang="ts">
  import Toggle from "../common/Toggle.svelte";
  import { settingsStore } from '$lib/services/settings/settingsStore';
  import { loadTokens } from '$lib/services/tokens/tokenStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { kongDB } from '$lib/services/db';
  import { onMount, onDestroy } from "svelte";
  import { auth } from '$lib/services/auth';
  import { liveQuery } from "dexie";
  import { browser } from '$app/environment';
  import { fly } from 'svelte/transition';
  import { themeStore } from '$lib/stores/themeStore';

  let soundEnabled = true;
  let settingsSubscription: () => void;
  let slippageValue: number = 2.0;
  let slippageInputValue = '2.0';
  let isMobile = false;
  let isCustomSlippage = false;
  let showSlippageInfo = false;
  let customInputFocused = false;

  // Predefined slippage values for quick selection
  const quickSlippageValues = [1, 2, 3, 5];

  // Subscribe to settings changes using liveQuery
  const settings = liveQuery(async () => {
    return await kongDB.settings.toArray();
  });

  // Cleanup subscription on component destroy
  onDestroy(() => {
    if (settingsSubscription) {
      settingsSubscription();
    }
  });

  // Subscribe to settings changes
  $: if ($settings) {
    const currentSettings = $settings[0];
    if (currentSettings) {
      soundEnabled = currentSettings.sound_enabled;
      settingsStore.set(currentSettings);
    }
  }

  $: if ($settingsStore) {
    soundEnabled = $settingsStore.sound_enabled;
    slippageValue = $settingsStore.max_slippage || 2.0;
    slippageInputValue = slippageValue.toString();
    isCustomSlippage = !quickSlippageValues.includes(slippageValue);
  }

  // Initialize slippage from localStorage or default to 2.0
  function initializeSlippageFromStorage() {
    if (browser) {
      const storedSlippage = localStorage.getItem('slippage');
      if (storedSlippage) {
        const value = parseFloat(storedSlippage);
        slippageValue = value;
        slippageInputValue = value.toString();
        isCustomSlippage = !quickSlippageValues.includes(value);
      }
    }
  }

  // Save slippage to localStorage
  function saveSlippageToStorage(value: number) {
    if (browser) {
      localStorage.setItem('slippage', value.toString());
    }
  }

  function handleQuickSlippageSelect(value: number) {
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    settingsStore.updateSetting('max_slippage', value);
    slippageValue = value;
    slippageInputValue = value.toString();
    isCustomSlippage = false;
    saveSlippageToStorage(value);
    toastStore.success(`Slippage updated to ${value}%`);
  }

  function handleSlippageChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      settingsStore.updateSetting('max_slippage', boundedValue);
      slippageValue = boundedValue;
      slippageInputValue = boundedValue.toString();
      isCustomSlippage = !quickSlippageValues.includes(boundedValue);
      saveSlippageToStorage(boundedValue);
    }
  }

  function handleSlippageInput(e: Event) {
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    const input = (e.target as HTMLInputElement).value;
    // Allow empty input or decimal point for better UX
    if (input === '' || input === '.') {
      slippageInputValue = input;
      return;
    }
    
    const value = parseFloat(input);
    if (!isNaN(value)) {
      slippageInputValue = input;
      // Only update settings if the value is valid
      if (value >= 0 && value <= 99) {
        settingsStore.updateSetting('max_slippage', value);
        slippageValue = value;
        isCustomSlippage = !quickSlippageValues.includes(value);
      }
    }
  }

  function handleSlippageBlur(e: Event) {
    if (!$auth.isConnected) {
      // Reset to stored value or default
      initializeSlippageFromStorage();
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    
    const value = parseFloat(slippageInputValue);
    if (isNaN(value) || value < 0 || value > 99) {
      // Reset to last valid value from settings or storage
      initializeSlippageFromStorage();
    } else {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      slippageValue = boundedValue;
      slippageInputValue = boundedValue.toString();
      settingsStore.updateSetting('max_slippage', boundedValue);
      isCustomSlippage = !quickSlippageValues.includes(boundedValue);
      saveSlippageToStorage(boundedValue);
      if (boundedValue !== value) {
        toastStore.success(`Slippage bounded to ${boundedValue}%`);
      }
    }
  }

  function handleToggleSound(event: CustomEvent<boolean>) {
    if ($auth.isConnected) {
      settingsStore.updateSetting('sound_enabled', event.detail);
      soundEnabled = event.detail;
    } else {
      toastStore.error('Please connect your wallet to save settings');
      event.preventDefault();
    }
  }

  async function clearFavorites() {
    if (confirm('Are you sure you want to clear your favorite tokens?')) {
      // TODO: readd clearing favorites
      await loadTokens(true);
      toastStore.success('Favorites cleared successfully. Please refresh the page for changes to take effect.');
    }
  }

  async function resetDatabase() {
    try {
      await kongDB.delete();
      toastStore.success('Database cleared successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing database:', error);
      toastStore.error('Failed to clear database');
    }
  }

  function handleResize() {
    if (browser) {
      isMobile = window.innerWidth <= 768;
    }
  }

  onMount(() => {
    handleResize();
    if (browser) {
      window.addEventListener('resize', handleResize);
      initializeSlippageFromStorage();
      return () => window.removeEventListener('resize', handleResize);
    }
  });

  // Helper function to determine slippage risk level
  function getSlippageRiskLevel(value: number): 'safe' | 'warning' | 'danger' {
    if (value <= 2) return 'safe';
    if (value <= 5) return 'warning';
    return 'danger';
  }

  function handleThemeToggle() {
    themeStore.toggleTheme();
  }

  // Add this function to handle done click
  function handleDone() {
    // You can add any cleanup or save logic here if needed
    window.history.back();
  }
</script>

<div class="settings">
  <!-- Slippage Section -->
  <div class="settings-section slippage-section">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="settings-title">Slippage Tolerance</h3>
        <button 
          class="text-muted hover:text-primary p-1 -m-1 rounded-md transition-colors"
          on:click={() => showSlippageInfo = !showSlippageInfo}
          aria-label="Slippage information"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path stroke-width="2" d="M12 16v-4M12 8h.01"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="settings-content">
      {#if showSlippageInfo}
        <div class="info-panel" transition:fly={{ y: -10, duration: 200 }}>
          <div class="flex gap-2">
            <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="space-y-2">
              <p class="text-xs text-kong-text-secondary">Maximum acceptable price difference between estimated and actual trade price.</p>
              <div class="flex gap-4 text-xs">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500/50"></span>
                  <span class="text-green-500">0.1-2%</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-yellow-500/50"></span>
                  <span class="text-yellow-500">2-5%</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500/50"></span>
                  <span class="text-kong-error">5%+</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <div class="slippage-controls">
        {#each quickSlippageValues as value}
          <button
            class="slippage-btn"
            class:active={slippageValue === value}
            class:warning={getSlippageRiskLevel(value) === 'warning'}
            class:danger={getSlippageRiskLevel(value) === 'danger'}
            on:click={() => handleQuickSlippageSelect(value)}
          >
            {value}%
          </button>
        {/each}
        <div 
          class="slippage-input-wrapper" 
          class:active={isCustomSlippage}
          class:warning={getSlippageRiskLevel(slippageValue) === 'warning'}
          class:danger={getSlippageRiskLevel(slippageValue) === 'danger'}
        >
          <input
            type="text"
            class="w-full min-w-[40px] bg-transparent text-right text-xs md:text-sm"
            value={isCustomSlippage ? slippageInputValue : "Custom"}
            on:focus={(e) => {
              const input = e.target as HTMLInputElement;
              if (!isCustomSlippage) {
                input.value = '';
              }
            }}
            on:input={handleSlippageInput}
            on:change={handleSlippageChange}
            on:blur={handleSlippageBlur}
            placeholder="Custom"
          />
          <span class="text-muted text-xs md:text-sm">%</span>
        </div>
      </div>

      {#if slippageValue > 5}
        <div class="warning-message error">
          <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>High slippage warning</span>
        </div>
      {:else if slippageValue > 2}
        <div class="warning-message warning">
          <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Use caution</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="settings-grid">
    <!-- General Section -->
    <div class="settings-section">
      <h3 class="settings-title">General</h3>
      <div class="settings-items">
        <div class="settings-item">
          <div class="flex items-center gap-2">
            <span class="text-sm">Theme</span>
            {#if $themeStore === 'dark'}
              <svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            {:else}
              <svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            {/if}
          </div>
          <Toggle 
            checked={$themeStore === 'dark'} 
            on:change={handleThemeToggle}
            showKongMonke={true}
            size="md"
          />
        </div>

        <div class="settings-item">
          <div class="flex items-center gap-2">
            <span class="text-sm">Sound Effects</span>
            <svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <Toggle 
            checked={soundEnabled} 
            on:change={handleToggleSound}
            size="md"
          />
        </div>
      </div>
    </div>

    <!-- Data Section -->
    <div class="settings-section">
      <h3 class="settings-title">Data</h3>
      <div class="settings-items">
        <div class="settings-item">
          <span class="text-sm">Favorite Tokens</span>
          <button class="btn-secondary" on:click={clearFavorites}>Clear</button>
        </div>

        <div class="settings-item">
          <span class="text-sm">Reload Application</span>
          <button class="btn-destructive" on:click={resetDatabase}>Reload</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Add the done button section -->
  <div class="done-section">
    <button 
      class="btn-primary"
      on:click={handleDone}
    >
      Done
    </button>
  </div>
</div>

<style lang="postcss">
  .settings {
    @apply w-full max-w-2xl mx-auto space-y-6 p-4;
  }

  /* Add specific styles for the slippage section */
  .slippage-section {
    @apply md:max-w-none;
  }

  .settings-content {
    @apply space-y-3 bg-kong-bg-dark/20 rounded-lg border border-kong-border p-4;
    @apply md:max-w-3xl md:mx-auto;
  }

  .slippage-controls {
    @apply flex flex-wrap items-center gap-2;
    @apply md:justify-center md:gap-3;
  }

  .settings-grid {
    @apply grid grid-cols-1 md:grid-cols-2 gap-4;
  }

  .settings-section {
    @apply space-y-3;
    height: fit-content;
  }

  .settings-title {
    @apply text-sm font-medium text-kong-text-primary;
  }

  .info-panel {
    @apply bg-kong-bg-dark/40 rounded-md border border-kong-border p-3;
  }

  .slippage-btn {
    @apply px-3 py-1.5 text-xs font-medium rounded-md
           bg-kong-bg-dark/40 text-kong-text-primary
           border border-kong-border
           hover:bg-kong-bg-dark/60 hover:border-kong-border-light
           transition-all duration-200;
  }

  .slippage-btn.active {
    @apply bg-kong-primary/10 border-kong-primary/30
           text-kong-primary ring-1 ring-kong-primary/30;
  }

  .slippage-btn.warning.active {
    @apply bg-yellow-500/10 border-yellow-500/30
           text-yellow-500 ring-1 ring-yellow-500/30;
  }

  .slippage-btn.danger.active {
    @apply bg-kong-error/10 border-kong-error/30
           text-kong-error ring-1 ring-kong-error/30;
  }

  .slippage-input-wrapper {
    @apply px-3 py-1.5 text-xs md:text-sm font-medium rounded-md
           bg-kong-bg-dark/40 border border-kong-border
           flex items-center gap-1
           w-[100px] md:w-[120px]
           focus-within:ring-1 focus-within:ring-kong-primary/30
           focus-within:border-kong-primary/30
           transition-all duration-200;
  }

  .slippage-input-wrapper input {
    @apply text-kong-text-primary placeholder-kong-text-secondary text-right;
  }

  .slippage-input-wrapper:not(.active) input {
    @apply text-kong-text-secondary;
  }

  .warning-message {
    @apply flex items-center gap-1.5 text-xs p-2 rounded-md;
  }

  .warning-message.warning {
    @apply bg-yellow-500/10 text-yellow-500 border border-yellow-500/20;
  }

  .warning-message.error {
    @apply bg-kong-error/10 text-kong-error border border-kong-error/20;
  }

  .settings-items {
    @apply divide-y divide-kong-border rounded-md border border-kong-border
           bg-kong-bg-dark/20;
  }

  .settings-item {
    @apply flex items-center justify-between p-2
           hover:bg-kong-bg-dark/40 transition-colors;
    min-height: 44px;
  }

  .btn-secondary, .btn-destructive {
    @apply px-3 py-1.5 text-xs font-medium rounded-md
           min-w-[70px] h-[32px]
           flex items-center justify-center
           transition-colors;
  }

  .btn-secondary {
    @apply bg-kong-bg-dark/40 text-kong-text-primary
           border border-kong-border
           hover:bg-kong-bg-dark/60 hover:border-kong-border-light;
  }

  .btn-destructive {
    @apply bg-kong-error/10 text-kong-error
           border border-kong-error/20
           hover:bg-kong-error/20 hover:border-kong-error/30;
  }

  @media (min-width: 768px) {
    .settings-content {
      @apply p-5;
    }

    .slippage-controls {
      @apply gap-3;
    }

    .slippage-btn, .slippage-input-wrapper {
      @apply text-sm;
    }
  }

  .done-section {
    @apply flex justify-center pt-4 md:pt-6;
  }

  .btn-primary {
    @apply px-8 py-2 text-sm font-medium rounded-md
           bg-kong-primary text-white
           hover:bg-kong-primary/80
           transition-colors duration-200
           min-w-[120px];
  }
</style>
