<script lang="ts">
  import Toggle from "../common/Toggle.svelte";
  import { settingsStore } from '$lib/services/settings/settingsStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { kongDB } from '$lib/services/db';
  import { onMount, onDestroy } from "svelte";
  import { auth } from '$lib/services/auth';
  import { liveQuery } from "dexie";
  import { browser } from '$app/environment';
  import { fade, fly } from 'svelte/transition';
  import { themeStore } from '$lib/stores/themeStore';
  import { Sun, Moon } from 'lucide-svelte';
  import Slider from "../common/Slider.svelte";

  let soundEnabled = true;
  let settingsSubscription: () => void;
  let slippageValue: number = 2.0;
  let slippageInputValue = '2.0';
  let isMobile = false;
  let isCustomSlippage = false;
  let showSlippageInfo = false;

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


  function handleSlippageChange() {
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    
    const boundedValue = Math.min(Math.max(slippageValue, 0.1), 99);
    settingsStore.updateSetting('max_slippage', boundedValue);
    slippageInputValue = boundedValue.toFixed(1);
    isCustomSlippage = !quickSlippageValues.includes(boundedValue);
    saveSlippageToStorage(boundedValue);
    
    // Force update for slider track
    slippageValue = boundedValue;
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
      await kongDB.favorite_tokens.clear();
      toastStore.success('Favorites cleared successfully. Please refresh the page for changes to take effect.');
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
        
        // Try to reset database with timeout
        await Promise.race([
          kongDB.resetDatabase(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Reset timeout')), 5000)
          )
        ]);

        toastStore.success('Reset successful, reloading...');
        
        // Small delay to show the success message
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force reload the page
        window.location.reload();
      }
    } catch (error) {
      console.error('Error resetting database:', error);
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

  onMount(() => {
    handleResize();
    if (browser) {
      window.addEventListener('resize', handleResize);
      initializeSlippageFromStorage();
      return () => window.removeEventListener('resize', handleResize);
    }
  });

  function handleThemeToggle() {
    themeStore.toggleTheme();
  }
</script>


  <!-- Main Content -->
  <div class="content pb-4">
    <!-- Slippage Section -->
    <div class="section-card">
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
          <span class="text-green-500">Safe (0.1-2%)</span>
          <span class="text-yellow-500">Caution (2-5%)</span>
          <span class="text-red-500">Risky (5%+)</span>
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
    </div>

    <!-- Settings Grid -->
    <div class="settings-grid">
      <!-- Theme Section -->
      <div class="section-card">
        <h3 class="section-title">Appearance</h3>
        <div class="setting-item">
          <div class="setting-label">
            <span>Theme</span>
            <span class="text-kong-text-secondary text-sm">{$themeStore === 'dark' ? 'Dark' : 'Light'}</span>
          </div>
          <button
            class="theme-toggle"
            on:click={handleThemeToggle}
            aria-label="Toggle theme"
          >
            {#if $themeStore === 'dark'}
              <Moon class="w-5 h-5 text-kong-primary" />
            {:else}
              <Sun class="w-5 h-5 text-kong-primary" />
            {/if}
          </button>
        </div>
      </div>

      <!-- Sound Section -->
      <div class="section-card">
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
      </div>

      <!-- Data Management -->
      <div class="section-card">
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
    </div>
  </div>
</div>

<style lang="postcss" scoped>
  .content {
    @apply space-y-6;
  }

  .section-card {
    @apply bg-kong-bg-dark/30 rounded-xl p-5 space-y-4;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .section-header {
    @apply flex items-center gap-2;
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

  .theme-toggle {
    @apply p-2 rounded-lg bg-kong-bg-dark/40 hover:bg-kong-bg-dark/60 transition-colors;
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
