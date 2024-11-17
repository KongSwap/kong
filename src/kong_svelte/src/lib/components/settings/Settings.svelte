<script lang="ts">
  import LanguageSelector from "../common/LanguageSelector.svelte";
  import Slider from "../common/Slider.svelte";
  import Toggle from "../common/Toggle.svelte";
  import { settingsStore } from '$lib/services/settings/settingsStore';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { kongDB, KongDB } from '$lib/services/db';
  import Dexie from 'dexie';
  import { assetCache } from '$lib/services/assetCache';
  import { onMount, onDestroy } from "svelte";
  import { walletStore } from '$lib/services/wallet/walletStore';
  import { liveQuery } from "dexie";
  
  let activeTab: 'trade' | 'app' = 'trade';
  let soundEnabled = true;
  let settingsSubscription: () => void;

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
      // Update the settings store
      settingsStore.set(currentSettings);
    }
  }

  $: if ($settingsStore) {
    soundEnabled = $settingsStore.sound_enabled;
  }

  function handleSlippageChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const boundedValue = Math.min(Math.max(value, 0), 99);
    if (!isNaN(boundedValue)) {
      settingsStore.updateSetting('max_slippage', boundedValue);
    }
  }

  function handleSlippageRelease(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const boundedValue = Math.min(Math.max(value, 0), 99);
    if (!isNaN(boundedValue)) {
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
      // Revert the toggle
      event.preventDefault();
    }
  }

  async function clearFavorites() {
    confirm('Are you sure you want to clear your favorite tokens?') && tokenStore.clearUserData();
    await tokenStore.loadTokens(true);
  }

  async function resetDatabase() {
    if (confirm('Are you sure you want to reset the database? This will clear all cached data.')) {
      try {
        // Unsubscribe from all live queries
        if (settingsSubscription) {
          settingsSubscription();
        }
        
        // Close all database connections
        await Promise.all([
          kongDB.close(),
          // Add any other stores that need cleanup
          tokenStore.cleanup && tokenStore.cleanup(),
        ]);
        
        // Delete the database
        await Dexie.delete('kong_db');
        
        // Clear asset cache
        await assetCache.clearCache();
        
        toastStore.success('Database and asset cache reset successfully. Reloading...');
        
        // Force reload the page immediately
        window.location.reload();
      } catch (error) {
        console.error('Error resetting database:', error);
        toastStore.error('Failed to reset database');
        
        // Try to reopen the database in case of error
        try {
          await kongDB.open();
        } catch (reopenError) {
          console.error('Error reopening database:', reopenError);
          // Force reload if we can't recover
          window.location.reload();
        }
      }
    }
  }
  
  $: if ($settingsStore.max_slippage !== undefined) {
    const event = new Event('input');
    Object.defineProperty(event, 'target', {
      value: { value: $settingsStore.max_slippage.toString() },
      enumerable: true
    });
    handleSlippageChange(event);
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
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="setting-label">Max Slippage</span>
            <span class="text-white/90 font-medium">%</span>
          </div>
          <Slider
            bind:value={$settingsStore.max_slippage}
            min={0}
            max={99}
            step={1}
            color="yellow"
            showInput={true}
            on:input={handleSlippageChange}
            on:change={handleSlippageRelease}
          />
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
    <!-- Language Section -->
    <div class="setting-section relative z-[10]">
      <div class="setting-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          <path d="M2 12h20"/>
        </svg>
        <h3>Language Settings</h3>
      </div>
      <div class="setting-content">
        <LanguageSelector />
      </div>
    </div>

    <!-- Sound Section -->
    <div class="setting-section z-1">
      <div class="setting-header">
        {#if $settingsStore.sound_enabled}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        {/if}
        <h3>Sound Settings</h3>
      </div>
      <div class="setting-content">
        <div class="flex items-center justify-between">
          <span class="setting-label">Enable Sound</span>
          <Toggle
            checked={soundEnabled}
            color="yellow"
            on:change={handleToggleSound}
            disabled={!$walletStore.isConnected}
          />
        </div>
        <p class="setting-description">
          Toggle sound effects for notifications and interactions
        </p>
      </div>
    </div>

    <!-- Database Section -->
    <div class="setting-section z-1">
      <div class="setting-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
          <path d="M3 12A9 3 0 0 0 21 12"/>
        </svg>
        <h3>Database Settings</h3>
      </div>
      <div class="setting-content">
        <div class="flex items-center justify-between">
          <span class="setting-label">Reset Database</span>
          <button
            class="clear-button"
            on:click={resetDatabase}
          >
            Reset
          </button>
        </div>
        <p class="setting-description">
          Reset the local database and clear all cached data
        </p>
      </div>
    </div>
  {/if}

  <!-- Version Info -->
  <div class="version-info">
    <span>Version 0.0.1</span>
  </div>
</div>

<style lang="postcss" scoped>
  .settings-container {
    @apply flex flex-col gap-6 p-2;
  }

  .tabs-container {
    @apply flex gap-2;
  }

  .tab-button {
    @apply flex items-center justify-center gap-2 px-4 py-2 rounded-lg 
           bg-white/5 backdrop-blur-sm
           text-white/60 transition-all duration-200
           hover:bg-white/10 hover:text-white/90 w-full;
    font-family: 'Press Start 2P', monospace;
    font-size: 1rem;
  }

  .tab-button.active {
    @apply bg-yellow-400/20 text-yellow-400;
  }

  .tab-button:hover {
    transform: translateY(-1px);
  }

  .tab-button:active {
    transform: translateY(0px);
  }

  .tab-button svg {
    @apply w-4 h-4;
  }

  .setting-section {
    @apply bg-white/5 backdrop-blur-sm rounded-xl p-6 transition-all duration-300;
    border: 2px solid transparent;
  }

  .setting-section:hover {
    @apply bg-white/10;
    border-color: theme(colors.yellow.400/70%);
    transform: translateY(-1px);
  }

  .setting-header {
    @apply flex items-center gap-3 mb-4;
  }

  .setting-header svg {
    @apply text-yellow-400 w-6 h-6;
  }

  .setting-header h3 {
    @apply text-lg font-bold text-yellow-400;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.9rem;
  }

  .setting-content {
    @apply space-y-4;
  }

  .setting-label {
    @apply text-white/90 font-medium;
  }

  .setting-description {
    @apply text-white/60 text-sm mt-2;
  }

  .version-info {
    @apply mt-4 text-center text-white/40 text-sm;
    font-family: monospace;
  }

  .clear-button {
    @apply px-4 py-2 rounded-lg bg-red-600/70 text-red-100 
           hover:bg-red-600/90 transition-all duration-200
           border border-red-500/30 hover:border-red-500/50;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
  }

  .clear-button:hover {
    transform: translateY(-1px);
  }

  .clear-button:active {
    transform: translateY(0px);
  }

  @media (max-width: 640px) {
    .setting-header h3 {
      font-size: 0.8rem;
    }

    .setting-content {
      @apply space-y-3;
    }

    .setting-section {
      @apply p-4;
    }
    
    .tab-button {
      @apply px-3 py-2;
      font-size: 0.6rem;
    }
    
    .tab-button svg {
      @apply w-3 h-3;
    }
  }
</style>