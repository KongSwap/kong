<script lang="ts">
  import Toggle from "../common/Toggle.svelte";
  import { settingsStore } from '$lib/services/settings/settingsStore';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { kongDB } from '$lib/services/db';
  import { assetCache } from '$lib/services/assetCache';
  import { onMount, onDestroy } from "svelte";
  import { auth } from '$lib/services/auth';
  import { liveQuery } from "dexie";
  import { browser } from '$app/environment';

  let activeTab: 'settings' = 'settings';
  let soundEnabled = true;
  let settingsSubscription: () => void;
  let slippageValue: number = 2.0;
  let slippageInputValue = '2.0';
  let isMobile = false;
  let isIcNetwork = process.env.DFX_NETWORK === 'ic';
  let showClaimButton = !isIcNetwork;
  let isCustomSlippage = false;

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
    isCustomSlippage = !quickSlippageValues.includes(slippageValue);
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
    toastStore.success(`Slippage updated to ${value}%`);
    if (value > 10) {
      toastStore.warning('Hmm... high slippage. Trade carefully!');
    }
  }

  function handleSlippageChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      settingsStore.updateSetting('max_slippage', boundedValue);
      slippageValue = boundedValue;
      slippageInputValue = boundedValue.toString();
      isCustomSlippage = !quickSlippageValues.includes(boundedValue);
      if (boundedValue > 10) {
        toastStore.warning('Hmm... high slippage. Trade carefully!');
      }
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
        if (value > 10) {
          toastStore.warning('Hmm... high slippage. Trade carefully!');
        }
      }
    }
  }

  function handleSlippageBlur() {
    if (!$auth.isConnected) {
      // Reset to default value
      slippageInputValue = '2.0';
      slippageValue = 2.0;
      isCustomSlippage = false;
      toastStore.error('Please connect your wallet to save settings');
      return;
    }
    
    const value = parseFloat(slippageInputValue);
    if (isNaN(value) || value < 0 || value > 99) {
      // Reset to last valid value from settings
      slippageInputValue = $settingsStore.max_slippage?.toString() || '2.0';
      slippageValue = $settingsStore.max_slippage || 2.0;
      isCustomSlippage = !quickSlippageValues.includes(slippageValue);
    } else {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      slippageValue = boundedValue;
      slippageInputValue = boundedValue.toString();
      settingsStore.updateSetting('max_slippage', boundedValue);
      isCustomSlippage = !quickSlippageValues.includes(boundedValue);
      if (boundedValue !== value) {
        toastStore.success(`Slippage bounded to ${boundedValue}%`);
      }
      if (boundedValue > 10) {
        toastStore.warning('Hmm... high slippage. Trade carefully!');
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
    try {
      await kongDB.delete();
      await assetCache.clearCache();
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
      return () => window.removeEventListener('resize', handleResize);
    }
  });
</script>

<div class="settings-container">
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
          <div class="custom-slippage-input" class:active={isCustomSlippage}>
            <input
              type="text"
              class="slippage-input"
              value={slippageInputValue}
              on:input={handleSlippageInput}
              on:change={handleSlippageChange}
              on:blur={handleSlippageBlur}
              placeholder="Custom"
            />
            <span class="percentage-symbol">%</span>
          </div>
        </div>
        {#if slippageValue > 10}
          <div class="warning-text">
            Warning: High slippage may result in unfavorable trades
          </div>
        {/if}
      </div>
    </div>

    <!-- Other Settings -->
    <div class="setting-row">
      <span class="setting-label">Sound Effects</span>
      <Toggle checked={soundEnabled} on:change={handleToggleSound} />
    </div>

    <div class="setting-row">
      <span class="setting-label">Favorite Tokens</span>
      <button class="action-button" on:click={clearFavorites}>
        Clear Favorites
      </button>
    </div>

    {#if showClaimButton}
      <div class="setting-row">
        <span class="setting-label">Test Tokens</span>
        <button class="action-button" on:click={claimTokens}>
          Claim Tokens
        </button>
      </div>
    {/if}

    <div class="setting-row">
      <span class="setting-label">Clear App Data</span>
      <button class="action-button warning" on:click={resetDatabase}>
        Clear Data
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .settings-container {
    @apply w-full text-white;
  }

  .setting-sections {
    @apply grid gap-4 max-w-full;
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

  .slippage-content {
    @apply grid gap-4;
  }

  .quick-slippage-buttons {
    @apply grid grid-cols-6 gap-2;
  }

  .quick-slippage-button {
    @apply px-3 py-2.5 rounded-lg 
           bg-gray-800 text-white/90 text-base font-medium
           border border-gray-700 transition-all duration-200
           hover:bg-gray-700 hover:border-gray-600
           focus:outline-none focus:ring-2 focus:ring-blue-500/50;
  }

  .quick-slippage-button.active {
    @apply bg-blue-600 text-white border-blue-500
           ring-2 ring-blue-500/50;
  }

  .custom-slippage-input {
    @apply flex items-center gap-2
           px-3 py-2 rounded-lg bg-gray-800 
           border border-gray-700 transition-all duration-200
           hover:bg-gray-700 hover:border-gray-600;
  }

  .custom-slippage-input.active {
    @apply border-blue-500 bg-blue-600;
  }

  .slippage-input {
    @apply w-full bg-transparent text-white/90 text-base font-medium
           focus:outline-none text-right pr-1;
  }

  .percentage-symbol {
    @apply text-white/70 font-medium;
  }

  .warning-text {
    @apply text-yellow-500 text-sm font-medium;
  }

  .setting-row {
    @apply flex items-center justify-between py-3 px-4 
           bg-black/20 rounded-lg border border-white/10
           hover:bg-black/30 transition-all duration-200;
  }

  .setting-label {
    @apply text-white/90 text-base font-medium;
  }

  .action-button {
    @apply min-w-[140px] px-4 py-2 rounded-lg 
           bg-blue-600 text-white text-sm font-medium
           border border-blue-500 transition-all duration-200
           hover:bg-blue-500 hover:border-blue-400
           focus:outline-none focus:ring-2 focus:ring-blue-500/50;
  }

  .action-button.warning {
    @apply bg-red-600 border-red-500
           hover:bg-red-500 hover:border-red-400
           focus:ring-red-500/50;
  }

  .action-button:hover {
    @apply transform -translate-y-0.5 shadow-lg shadow-blue-500/20;
  }

  .action-button.warning:hover {
    @apply shadow-red-500/20;
  }

  @media (max-width: 768px) {
    .setting-header h3 {
      @apply text-base;
    }
    
    .quick-slippage-buttons {
      @apply grid-cols-3;
    }
    
    .quick-slippage-button {
      @apply px-2 py-2 text-sm;
    }
    
    .action-button {
      @apply min-w-[100px] px-3 py-1.5;
    }
  }
</style>
