<script lang="ts">
  import LanguageSelector from "../common/LanguageSelector.svelte";
  import Slider from "../common/Slider.svelte";
  import Toggle from "../common/Toggle.svelte";
  import { settingsStore } from '$lib/services/settings/settingsStore';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { themeStore } from '$lib/stores/themeStore';
  import { kongDB } from '$lib/services/db';
  import Dexie from 'dexie';
  import { assetCache } from '$lib/services/assetCache';
  import { onMount, onDestroy } from "svelte";
  import { walletStore } from '$lib/services/wallet/walletStore';
  import { liveQuery } from "dexie";
  
  let activeTab: 'trade' | 'app' = 'trade';
  let soundEnabled = true;
  let settingsSubscription: () => void;
  let slippageInputValue: string;

  // Predefined slippage values for quick selection
  const quickSlippageValues = [0.1, 0.5, 1, 2, 3];

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
    slippageInputValue = $settingsStore.max_slippage?.toString() || '0';
  }

  function handleQuickSlippageSelect(value: number) {
    settingsStore.updateSetting('max_slippage', value);
    toastStore.success(`Slippage updated to ${value}%`);
  }

  function handleSlippageChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const boundedValue = Math.min(Math.max(value, 0), 99);
    if (!isNaN(boundedValue)) {
      settingsStore.updateSetting('max_slippage', boundedValue);
      slippageInputValue = boundedValue.toString();
    }
  }

  function handleSlippageInput(e: Event) {
    const input = (e.target as HTMLInputElement).value;
    slippageInputValue = input;
    const value = parseFloat(input);
    if (!isNaN(value)) {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      settingsStore.updateSetting('max_slippage', boundedValue);
    }
  }

  function handleSlippageBlur() {
    const value = parseFloat(slippageInputValue);
    if (isNaN(value)) {
      slippageInputValue = $settingsStore.max_slippage?.toString() || '0';
    } else {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      slippageInputValue = boundedValue.toString();
      settingsStore.updateSetting('max_slippage', boundedValue);
      toastStore.success(`Slippage updated to ${boundedValue}%`);
    }
  }

  function handleToggleSound(event: CustomEvent<boolean>) {
    if ($walletStore.isConnected) {
      settingsStore.updateSetting('sound_enabled', event.detail);
      soundEnabled = event.detail;
    } else {
      toastStore.error('Please connect your wallet to save settings');
      event.preventDefault();
    }
  }

  async function clearFavorites() {
    if (confirm('Are you sure you want to clear your favorite tokens?')) {
      await tokenStore.clearUserData();
      await tokenStore.loadTokens(true);
      toastStore.success('Favorites cleared successfully');
    }
  }

  function toggleTheme() {
    $themeStore = $themeStore === 'pixel' ? 'glass' : 'pixel';
    toastStore.success(`Theme switched to ${$themeStore} mode`);
  }

  async function resetDatabase() {
    if (confirm('Are you sure you want to reset the database? This will clear all cached data.')) {
      try {
        if (settingsSubscription) {
          settingsSubscription();
        }
        
        await Promise.all([
          kongDB.close(),
          tokenStore.cleanup && tokenStore.cleanup(),
        ]);
        
        await Dexie.delete('kong_db');
        await assetCache.clearCache();
        
        toastStore.success('Database and asset cache reset successfully. Reloading...');
        window.location.reload();
      } catch (error) {
        console.error('Error resetting database:', error);
        toastStore.error('Failed to reset database');
        
        try {
          await kongDB.open();
        } catch (reopenError) {
          console.error('Error reopening database:', reopenError);
          window.location.reload();
        }
      }
    }
  }
</script>

<div class="settings-container relative">
  <!-- Tab Navigation -->
  <div class="tabs-container">
    <button 
      class="tab-button" 
      class:active={activeTab === 'trade'}
      on:click={() => activeTab = 'trade'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18"/>
        <path d="m19 9-5 5-4-4-3 3"/>
      </svg>
      Trade
    </button>
    <button 
      class="tab-button" 
      class:active={activeTab === 'app'}
      on:click={() => activeTab = 'app'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      
      App
    </button>
  </div>

  {#if activeTab === 'trade'}
    <!-- Slippage Section -->
    <div class="setting-section z-1">
      <div class="setting-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
        </svg>
        <h3>Slippage Settings</h3>
      </div>
      <div class="setting-content">
        <div class="flex flex-col gap-4">
          <!-- Quick select buttons -->
          <div class="flex gap-2">
            {#each quickSlippageValues as value}
              <button
                class="quick-select-btn"
                class:active={$settingsStore.max_slippage === value}
                on:click={() => handleQuickSlippageSelect(value)}
              >
                {value}%
              </button>
            {/each}
            <div class="custom-input-container">
              <input
                type="text"
                inputmode="decimal"
                placeholder="Custom"
                class="slippage-input"
                bind:value={slippageInputValue}
                on:input={handleSlippageInput}
                on:blur={handleSlippageBlur}
              />
              <span class="text-white/90 font-medium">%</span>
            </div>
          </div>

          <!-- Slider -->
          <div class="flex-1">
            <input
              type="range"
              min="0"
              max="99"
              step="0.1"
              value={$settingsStore.max_slippage}
              class="slippage-slider"
              on:input={handleSlippageChange}
            />
          </div>

          <p class="setting-description">
            Maximum allowed price difference between expected and actual swap price
          </p>
        </div>
      </div>
    </div>

    <!-- Favorites Section -->
    <div class="setting-section z-1">
      <div class="setting-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <h3>Favorite Tokens</h3>
      </div>
      <div class="setting-content">
        <div class="flex items-center justify-between">
          <span class="setting-label">Clear Favorites</span>
          <button
            class="clear-button"
            on:click={clearFavorites}
          >
            Clear
          </button>
        </div>
        <p class="setting-description">
          Remove all favorite tokens for the current wallet
        </p>
      </div>
    </div>
  {:else}
    <!-- App Settings -->
    <div class="setting-section z-1">
      <div class="setting-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <h3>App Settings</h3>
      </div>
      <div class="setting-content">
        <!-- Language -->
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="setting-label">Language</span>
            <LanguageSelector />
          </div>
          <p class="setting-description">
            Choose your preferred language for the interface
          </p>
        </div>

        <!-- Theme -->
        <div class="flex flex-col gap-4 mt-6">
          <div class="flex items-center justify-between">
            <span class="setting-label">Theme</span>
            <button class="theme-toggle" on:click={toggleTheme}>
              {$themeStore === 'pixel' ? 'Modern' : 'Pixel'}
            </button>
          </div>
          <p class="setting-description">
            Switch between pixel art and modern glass themes
          </p>
        </div>

        <!-- Sound -->
        <div class="flex flex-col gap-4 mt-6">
          <div class="flex items-center justify-between">
            <span class="setting-label">Sound</span>
            <Toggle 
              checked={soundEnabled}
              on:change={handleToggleSound}
            />
          </div>
          <p class="setting-description">
            Enable or disable sound effects
          </p>
        </div>

        <!-- Reset Database -->
        <div class="flex flex-col gap-4 mt-6">
          <div class="flex items-center justify-between">
            <span class="setting-label">Reset Database</span>
            <button
              class="reset-button"
              on:click={resetDatabase}
            >
              Reset
            </button>
          </div>
          <p class="setting-description">
            Clear all cached data and reset the application
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .settings-container {
    @apply flex flex-col gap-4 p-4;
    min-height: 100%;
  }

  .tabs-container {
    @apply flex gap-2 mb-4;
  }

  .tab-button {
    @apply flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 transition-all duration-200;
  }

  .tab-button:hover {
    @apply text-white/80;
  }

  .tab-button.active {
    @apply text-white;
    background: rgba(255, 255, 255, 0.1);
  }

  .setting-section {
    @apply bg-black/20 rounded-lg overflow-hidden;
  }

  .setting-header {
    @apply flex items-center gap-3 p-4 bg-black/20;
  }

  .setting-header h3 {
    @apply text-lg font-semibold text-white;
  }

  .setting-content {
    @apply p-4;
  }

  .setting-label {
    @apply text-white/90 font-medium;
  }

  .setting-description {
    @apply text-sm text-white/60 mt-2;
  }

  .clear-button,
  .reset-button,
  .theme-toggle {
    @apply px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200;
  }

  .theme-toggle {
    @apply bg-blue-500/20 text-blue-400 hover:bg-blue-500/30;
  }

  .quick-select-btn {
    @apply px-3 py-2 rounded-lg bg-white/5 text-white/80 
           transition-all duration-200 flex-1 text-center
           hover:bg-white/10 hover:text-white
           border border-white/10;
    font-family: 'Alumni Sans', sans-serif;
  }

  .quick-select-btn.active {
    @apply bg-yellow-400/20 text-yellow-400 border-yellow-400/30;
  }

  .custom-input-container {
    @apply flex items-center gap-1 px-2 rounded-lg bg-white/5 border border-white/10;
  }

  .slippage-input {
    @apply w-16 py-2 bg-transparent text-white/90 
           focus:outline-none text-right;
    font-family: 'Alumni Sans', sans-serif;
  }

  .slippage-slider {
    @apply w-full h-2 rounded-lg appearance-none cursor-pointer;
    background: linear-gradient(to right, 
      rgb(250 204 21) 0%, 
      rgb(250 204 21) var(--value-percent, 0%), 
      rgba(255, 255, 255, 0.1) var(--value-percent, 0%)
    );
  }

  .slippage-slider::-webkit-slider-thumb {
    @apply appearance-none w-4 h-4 rounded-full bg-yellow-400 cursor-pointer
           hover:bg-yellow-500 hover:scale-110 transition-all duration-200;
    border: 2px solid rgba(0, 0, 0, 0.2);
  }

  .slippage-slider::-moz-range-thumb {
    @apply w-4 h-4 rounded-full bg-yellow-400 cursor-pointer
           hover:bg-yellow-500 hover:scale-110 transition-all duration-200;
    border: 2px solid rgba(0, 0, 0, 0.2);
  }
</style>
