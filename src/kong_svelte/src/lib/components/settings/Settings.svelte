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
  import { auth } from '$lib/services/auth';
  import { liveQuery } from "dexie";
  import { browser } from '$app/environment';

  let activeTab: 'trade' | 'app' = 'trade';
  let soundEnabled = true;
  let settingsSubscription: () => void;
  let slippageValue: number = 2.0;
  let slippageInputValue = '2.0';
  let isMobile = false;
  let isIcNetwork = process.env.DFX_NETWORK === 'ic';
  let showClaimButton = !isIcNetwork;

  // Predefined slippage values for quick selection
  const quickSlippageValues = [0.5, 1, 2, 3, 5];

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
    if (!$auth.isConnected) {
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
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
      }
    }
  }

  function handleSlippageBlur() {
    if (!$auth.isConnected) {
      // Reset to default value
      slippageInputValue = '2.0';
      slippageValue = 2.0;
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    
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
      await tokenStore.clearUserData();
      await tokenStore.loadTokens(true);
      toastStore.success('Favorites cleared successfully');
    }
  }

  const claimTokens = async () => {
    await tokenStore.claimFaucetTokens();
    await tokenStore.loadBalances($auth.account?.owner);
    toastStore.success('Test tokens claimed successfully');
  };

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

<div class="settings-container">
  <!-- Tab Navigation -->
  <div class="tabs-container">
    <div class="tabs-wrapper">
      <button 
        class="tab-button" 
        class:active={activeTab === 'trade'}
        on:click={() => activeTab = 'trade'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18"/>
          <path d="m19 9-5 5-4-4-3 3"/>
        </svg>
        <span>Trade</span>
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
        <span>App</span>
      </button>
    </div>
  </div>

  {#if activeTab === 'trade'}
    <!-- Trade Settings -->
    <div class="setting-sections">
      <!-- Slippage Section -->
      <div class="setting-section">
        <div class="setting-header">
          <h3>Slippage Tolerance</h3>
        </div>
        <div class="slippage-content">
          <div class="quick-slippage-buttons">
            {#each quickSlippageValues as value}
              <button
                class="quick-slippage-button"
                class:active={slippageValue === value}
                on:click={() => handleQuickSlippageSelect(value)}
              >
                {value}%
              </button>
            {/each}
          </div>
          <div class="custom-slippage-input">
            <input
              type="text"
              class="slippage-input"
              value={slippageInputValue}
              on:input={handleSlippageInput}
              on:change={handleSlippageChange}
              on:blur={handleSlippageBlur}
            />
            <span class="percentage-symbol">%</span>
          </div>
        </div>
      </div>

      <!-- Favorites Section - Single Row -->
      <div class="setting-section-row">
        <h3>Favorites</h3>
        <button class="action-button" on:click={clearFavorites}>
          Clear Favorites
        </button>
      </div>

      {#if showClaimButton}
        <div class="setting-section-row">
          <h3>Test Tokens</h3>
          <button class="action-button" on:click={claimTokens}>
            Claim Test Tokens
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- App Settings -->
    <div class="setting-sections">
      <!-- Sound Section - Single Row -->
      <div class="setting-section-row">
        <h3>Sound Effects</h3>
        <Toggle checked={soundEnabled} on:change={handleToggleSound} />
      </div>

      <!-- Database Section - Single Row -->
      <div class="setting-section-row">
        <h3>Database</h3>
        <button class="action-button" on:click={resetDatabase}>
          Clear Database
        </button>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .settings-container {
    @apply w-full text-white;
  }

  .tabs-container {
    @apply w-full bg-black/20 border-b border-white/10 mb-6 rounded-lg overflow-hidden;
  }

  .tabs-wrapper {
    @apply grid grid-cols-2 w-full;
  }

  .tab-button {
    @apply flex items-center justify-center gap-2 py-3 px-4 w-full
           text-white/90 hover:bg-white/5 font-medium transition-colors duration-200
           border-r border-white/10 last:border-r-0;
  }

  .tab-button.active {
    @apply bg-white/10 text-white;
  }

  .tab-button span {
    @apply text-center;
  }

  .setting-sections {
    @apply grid gap-6 max-w-full;
  }

  @media (max-width: 768px) {
    .tabs-container {
      @apply mb-4;
    }

    .tab-button {
      @apply py-2 px-3;
    }

    .setting-sections {
      @apply gap-3;
    }
  }

  .setting-section {
    @apply grid gap-4 bg-black/20 rounded-lg p-4 
           border border-white/10 backdrop-blur-sm
           w-full max-w-full overflow-hidden;
  }

  .setting-header {
    @apply grid grid-flow-col auto-cols-max items-center gap-2 border-b border-white/15 pb-3;
  }

  .setting-header h3 {
    @apply text-lg font-semibold text-white;
  }

  @media (max-width: 768px) {
    .setting-header h3 {
      @apply text-base;
    }
  }

  .setting-content {
    @apply grid gap-4 w-full max-w-full;
  }

  .slippage-content {
    @apply grid gap-4;
  }

  .quick-slippage-buttons {
    @apply grid grid-cols-5 gap-2;
  }

  .quick-slippage-button {
    @apply w-full px-3 py-2.5 rounded-lg 
           bg-black/20 text-white/90 text-base font-medium
           border border-white/10 transition-all duration-200
           hover:border-white/20 hover:bg-black/30
           focus:outline-none focus:ring-2 focus:ring-yellow-300/50;
  }

  .quick-slippage-button.active {
    @apply bg-yellow-300/20 text-yellow-300 border-yellow-300/50
           ring-2 ring-yellow-300/50;
  }

  .custom-slippage-input {
    @apply flex items-center gap-2 
           px-4 py-3 rounded-lg bg-black/20 
           border border-white/10;
  }

  .slippage-input {
    @apply w-full bg-transparent text-white/90 text-base font-medium
           focus:outline-none text-right pr-1;
  }

  .percentage-symbol {
    @apply text-white/70 font-medium;
  }

  .setting-section-row {
    @apply flex items-center justify-between py-3 px-4 bg-slate-800/50 rounded-lg;
    @apply border border-slate-700/30 backdrop-blur-md;
    @apply transition-all duration-200;
  }

  .setting-section-row h3 {
    @apply text-white/90 text-base font-medium;
  }

  .action-button {
    @apply px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500/80 rounded-lg;
    @apply text-white/90 text-sm font-medium transition-all duration-200;
    @apply border border-indigo-500/30;
  }

  .action-button:hover {
    @apply shadow-lg shadow-indigo-500/20;
  }
</style>
