<script lang="ts">
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
  import { browser } from '$app/environment';

  let activeTab: 'trade' | 'app' = 'trade';
  let soundEnabled = true;
  let settingsSubscription: () => void;
  let slippageValue: number = 2.0;
  let slippageInputValue = '2.0';
  let isMobile = false;

  // Predefined slippage values for quick selection
  const quickSlippageValues = [1, 2, 3, 5, 10];

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
  }

  function handleQuickSlippageSelect(value: number) {
    settingsStore.updateSetting('max_slippage', value);
    slippageValue = value;
    slippageInputValue = value.toString();
    toastStore.success(`Slippage updated to ${value}%`);
  }

  function handleSlippageChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      settingsStore.updateSetting('max_slippage', boundedValue);
      slippageValue = boundedValue;
      slippageInputValue = boundedValue.toString();
    }
  }

  function handleSlippageInput(e: Event) {
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
      }
    }
  }

  function handleSlippageBlur() {
    const value = parseFloat(slippageInputValue);
    if (isNaN(value) || value < 0 || value > 99) {
      // Reset to last valid value from settings
      slippageInputValue = $settingsStore.max_slippage?.toString() || '2.0';
      slippageValue = $settingsStore.max_slippage || 2.0;
    } else {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      slippageValue = boundedValue;
      slippageInputValue = boundedValue.toString();
      settingsStore.updateSetting('max_slippage', boundedValue);
      if (boundedValue !== value) {
        toastStore.success(`Slippage bounded to ${boundedValue}%`);
      }
    }
  }

  function handleToggleSound(event: CustomEvent<boolean>) {
    settingsStore.updateSetting('sound_enabled', event.detail);
    soundEnabled = event.detail;
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

  function handleResize() {
    if (browser) {
      isMobile = window.innerWidth <= 768;
    }
  }

  onMount(() => {
    handleResize();
    if (browser) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  });
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
          <div class="slippage-buttons">
            {#each quickSlippageValues as value}
              <button
                class="slippage-btn"
                class:active={slippageValue === value}
                on:click={() => handleQuickSlippageSelect(value)}
              >
                {value}%
              </button>
            {/each}
          </div>

          <!-- Custom input -->
          <div class="custom-slippage">
            <span class="custom-label">Custom slippage</span>
            <div class="custom-input-wrapper" class:active={!quickSlippageValues.includes(slippageValue)}>
              <input
                type="text"
                inputmode="decimal"
                placeholder="Enter value"
                class="slippage-input"
                bind:value={slippageInputValue}
                on:input={handleSlippageInput}
                on:blur={handleSlippageBlur}
              />
              <span class="percent-symbol">%</span>
            </div>
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
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <h3>App Settings</h3>
      </div>
      
      <div class="setting-content">
        <!-- Theme Setting -->
        <div class="setting-item">
          <div class="setting-item-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
            <span>Theme</span>
          </div>
          <div class="theme-buttons">
            <button
              class="theme-button"
              class:active={$themeStore === 'pixel'}
              on:click={() => themeStore.set('pixel')}
            >
              Pixel
            </button>
            <button
              class="theme-button"
              class:active={$themeStore === 'glass'}
              on:click={() => themeStore.set('glass')}
            >
              Glass
            </button>
          </div>
        </div>

        <!-- Language Setting -->
        <div class="setting-item">
          <div class="setting-item-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 8 6 6"/>
              <path d="m4 14 6-6 2-3"/>
              <path d="M2 5h12"/>
              <path d="M7 2h1"/>
              <path d="m22 22-5-10-5 10"/>
              <path d="M14 18h6"/>
            </svg>
            <span>Language</span>
          </div>
          <div class="language-buttons">
            <button
              class="lang-button"
              class:active={$settingsStore.default_language === 'en'}
              on:click={() => settingsStore.updateSetting('default_language', 'en')}
            >
              <span class="flag">🇺🇸</span>
              <span>English</span>
            </button>
            <button
              class="lang-button"
              class:active={$settingsStore.default_language === 'es'}
              on:click={() => settingsStore.updateSetting('default_language', 'es')}
            >
              <span class="flag">🇪🇸</span>
              <span>Español</span>
            </button>
          </div>
        </div>

        <!-- Sound Setting -->
        <div class="setting-item">
          <div class="setting-item-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <span>Sound</span>
          </div>
          <Toggle checked={soundEnabled} on:change={handleToggleSound} />
        </div>

        <!-- Data Management -->
        <div class="setting-item">
          <div class="setting-item-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/>
              <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/>
            </svg>
            <span>Data Management</span>
          </div>
          <div class="data-buttons">
            <button class="data-button" on:click={clearFavorites}>
              Clear Favorites
            </button>
            <button class="data-button warning" on:click={resetDatabase}>
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>

  {/if}
</div>

<style lang="postcss">
  .settings-container {
    @apply flex flex-col gap-4 p-4 max-w-2xl mx-auto;
  }

  .tabs-container {
    @apply flex gap-2 mb-4;
  }

  .tab-button {
    @apply flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 hover:bg-black/5;
  }

  .tab-button.active {
    @apply bg-black/10;
  }

  .setting-section {
    @apply bg-white/50 backdrop-blur-md rounded-xl p-6 border-2 border-black/10;
  }

  .setting-header {
    @apply flex items-center gap-2 mb-6 pb-4 border-b border-black/10;
  }

  .setting-header h3 {
    @apply text-xl font-bold;
  }

  .setting-content {
    @apply flex flex-col gap-6;
  }

  .setting-item {
    @apply flex flex-col gap-3;
  }

  .setting-item-header {
    @apply flex items-center gap-2 text-lg font-medium;
  }

  .theme-button {
    @apply px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors duration-200;
  }

  .theme-button.active {
    @apply bg-[#eece00] text-black;
  }

  .language-buttons {
    @apply flex gap-2 flex-wrap;
  }

  .lang-button {
    @apply flex items-center gap-2 px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors duration-200;
  }

  .lang-button.active {
    @apply bg-[#eece00] text-black;
  }

  .flag {
    @apply text-lg;
  }

  .data-buttons {
    @apply flex gap-2 flex-wrap;
  }

  .data-button {
    @apply px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors duration-200;
  }

  .data-button.warning {
    @apply bg-red-500/10 hover:bg-red-500/20 text-red-600;
  }

  .slippage-buttons {
    @apply flex gap-2 flex-wrap;
  }

  .slippage-btn {
    @apply px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors duration-200 font-medium min-w-[60px] text-center;
  }

  .slippage-btn.active {
    @apply bg-[#eece00] text-black;
  }

  .custom-slippage {
    @apply flex flex-col gap-2;
  }

  .custom-label {
    @apply text-sm text-black/60 font-medium;
  }

  .custom-input-wrapper {
    @apply flex items-center gap-1 px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors duration-200 max-w-[160px];
  }

  .custom-input-wrapper.active {
    @apply bg-[#eece00];
  }

  .slippage-input {
    @apply bg-transparent w-full text-left focus:outline-none font-medium;
  }

  .percent-symbol {
    @apply text-black/60;
  }

  :global([data-theme="pixel"]) .setting-section {
    @apply bg-white border-2 border-black;
  }

  :global([data-theme="pixel"]) .tab-button {
    @apply hover:bg-black/10;
  }

  :global([data-theme="pixel"]) .tab-button.active {
    @apply bg-[#eece00];
  }

  :global([data-theme="pixel"]) .theme-button,
  :global([data-theme="pixel"]) .lang-button,
  :global([data-theme="pixel"]) .data-button {
    @apply border-2 border-black;
  }

  :global([data-theme="pixel"]) .data-button.warning {
    @apply border-red-600;
  }
</style>
