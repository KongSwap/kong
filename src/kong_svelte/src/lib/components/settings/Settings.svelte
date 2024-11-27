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
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <text x="4" y="19" font-size="18" font-weight="bold">%</text>
          </svg>
          <h3>Slippage Tolerance</h3>
        </div>
        <div class="setting-content">
          <div class="slippage-container">
            <p class="slippage-description">
              Your transaction will revert if the price changes unfavorably by more than this percentage.
            </p>
            
            <!-- Quick select buttons in their own row -->
            <div class="quick-select-row">
              {#each quickSlippageValues as value}
                <button
                  class="quick-select-btn"
                  class:active={slippageValue === value}
                  on:click={() => handleQuickSlippageSelect(value)}
                >
                  {value}%
                </button>
              {/each}
            </div>

            <!-- Custom input in its own row -->
            <div class="custom-input-row">
              <span class="custom-label">Enter custom slippage:</span>
              <div class="custom-input-container" class:active={!quickSlippageValues.includes(slippageValue)}>
                <input
                  type="text"
                  inputmode="decimal"
                  placeholder="Custom"
                  class="slippage-input"
                  bind:value={slippageInputValue}
                  on:input={handleSlippageInput}
                  on:blur={handleSlippageBlur}
                />
                <span class="percentage-symbol">%</span>
              </div>
            </div>

            {#if parseFloat(slippageInputValue) > 5}
              <div class="warning-message">
                <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>High slippage increases risk of price impact</span>
              </div>
            {:else if parseFloat(slippageInputValue) < 0.1}
              <div class="warning-message">
                <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Transaction may fail due to low slippage tolerance</span>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Development Tools Section -->
      {#if !isIcNetwork}
        <div class="setting-section">
          <div class="setting-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M2 12h20"/>
            </svg>
            <h3>Development Tools</h3>
          </div>
          <div class="setting-content">
            <div class="grid grid-flow-col justify-between items-center">
              <button
                class="claim-button"
                on:click={claimTokens}
              >
                Claim Test Tokens
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Favorites Section -->
      <div class="setting-section">
        <div class="setting-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <h3>Favorite Tokens</h3>
        </div>
        <div class="setting-content">
          <div class="grid grid-flow-col justify-between items-center">
            <button
              class="clear-button"
              on:click={clearFavorites}
            >
              Clear Favorites
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- App Settings -->
    <div class="setting-sections">
      <!-- Sound Section -->
      <div class="setting-section">
        <div class="setting-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <h3>Sound</h3>
        </div>
        <div class="setting-content">
          <div class="grid grid-flow-col justify-between items-center">
            <Toggle checked={soundEnabled} on:change={handleToggleSound} />
          </div>
        </div>
      </div>

      <!-- Data Management Section -->
      <div class="setting-section">
        <div class="setting-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/>
            <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/>
          </svg>
          <h3>Data Management</h3>
        </div>
        <div class="setting-content">
          <div class="grid grid-flow-col justify-between items-center">
            <button
              class="data-button"
              on:click={resetDatabase}
            >
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

    .quick-select-btn {
      @apply px-2 py-1 text-sm;
    }

    .custom-input-container {
      @apply px-2 py-1;
    }

    .slippage-input {
      @apply w-12 text-sm;
    }

    .theme-button, .data-button, .clear-button, .claim-button {
      @apply px-3 py-1.5 text-sm;
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


  .slippage-container {
    @apply grid gap-4;
  }

  .quick-select-row {
    @apply grid grid-cols-5 gap-2;
  }

  .quick-select-btn {
    @apply w-full px-3 py-2.5 rounded-lg 
           bg-black/20 text-white/90 text-base font-medium
           border border-white/10 transition-all duration-200
           hover:border-white/20 hover:bg-black/30
           focus:outline-none focus:ring-2 focus:ring-yellow-300/50;
  }

  .quick-select-btn.active {
    @apply bg-yellow-300/20 text-yellow-300 border-yellow-300/50
           ring-2 ring-yellow-300/50;
  }

  .custom-input-row {
    @apply flex items-center gap-4 
           px-4 py-3 rounded-lg bg-black/20 
           border border-white/10;
  }

  .custom-label {
    @apply text-white/90 font-medium whitespace-nowrap;
  }

  .custom-input-container {
    @apply flex items-center gap-2 flex-1
           px-3 py-2 rounded-lg bg-black/30
           border border-white/10 transition-all duration-200
           hover:border-white/20 focus-within:border-yellow-300/50
           focus-within:ring-2 focus-within:ring-yellow-300/50;
  }

  .custom-input-container.active {
    @apply bg-yellow-300/20 border-yellow-300/50
           ring-2 ring-yellow-300/50;
  }

  .slippage-input {
    @apply w-full bg-transparent text-white/90 text-base font-medium
           focus:outline-none text-right pr-1;
  }

  .percentage-symbol {
    @apply text-white/70 font-medium;
  }

  .warning-message {
    @apply flex items-center gap-2 mt-3 px-3 py-2
           bg-yellow-300/10 rounded-lg border border-yellow-300/20
           text-sm text-yellow-300/90;
  }

  .warning-icon {
    @apply w-4 h-4 stroke-yellow-300/90;
  }

  @media (max-width: 768px) {
    .quick-select-row {
      @apply grid-cols-3 grid-rows-2;
    }

    .custom-input-row {
      @apply flex-col items-start gap-2 px-3 py-2;
    }

    .custom-input-container {
      @apply w-full;
    }

    .quick-select-btn {
      @apply px-2 py-2 text-sm;
    }

    .slippage-input {
      @apply text-sm;
    }
  }

  .data-button, .clear-button, .claim-button {
    @apply px-4 py-2 rounded-lg bg-black/20 hover:bg-black/30 
           transition-colors duration-200 text-white/90
           border border-white/10 hover:border-white/20;
  }

  .slippage-description {
    @apply text-sm text-white/70 mb-4;
  }

  .quick-select-row {
    @apply grid grid-cols-5 gap-2;
  }

  .quick-select-btn {
    @apply w-full px-3 py-2.5 rounded-lg 
           bg-black/20 text-white/90 text-base font-medium
           border border-white/10 transition-all duration-200
           hover:border-white/20 hover:bg-black/30
           focus:outline-none focus:ring-2 focus:ring-yellow-300/50;
  }

  .quick-select-btn.active {
    @apply bg-yellow-300/20 text-yellow-300 border-yellow-300/50
           ring-2 ring-yellow-300/50;
  }

  .custom-input-container {
    @apply relative flex items-center w-full
           px-3 py-2 rounded-lg bg-black/20 
           border border-white/10 transition-all duration-200
           hover:border-white/20 focus-within:border-yellow-300/50
           focus-within:ring-2 focus-within:ring-yellow-300/50;
  }

  .custom-input-container.active {
    @apply bg-yellow-300/20 border-yellow-300/50
           ring-2 ring-yellow-300/50;
  }

  .slippage-input {
    @apply w-full bg-transparent text-white/90 text-base font-medium
           focus:outline-none text-right pr-1;
  }

  .percentage-symbol {
    @apply text-white/70 font-medium;
  }

  .warning-message {
    @apply flex items-center gap-2 mt-3 px-3 py-2
           bg-yellow-300/10 rounded-lg border border-yellow-300/20
           text-sm text-yellow-300/90;
  }

  .warning-icon {
    @apply w-4 h-4 stroke-yellow-300/90;
  }

  @media (max-width: 768px) {
    .quick-select-row {
      @apply grid-cols-3;
    }

    .quick-select-btn, .custom-input-container {
      @apply px-2 py-2 text-sm;
    }

    .slippage-input {
      @apply text-sm;
    }
  }
</style>
