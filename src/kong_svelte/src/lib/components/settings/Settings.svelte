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
  }

  function handleSlippageChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const boundedValue = Math.min(Math.max(value, 0), 99);
      settingsStore.updateSetting('max_slippage', boundedValue);
      slippageValue = boundedValue;
      slippageInputValue = boundedValue.toString();
      isCustomSlippage = !quickSlippageValues.includes(boundedValue);
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
</script>

<div class="settings-container">
  <div class="setting-sections">
    <!-- Theme Section -->
    <div class="setting-row">
      <div class="flex items-center gap-2">
        <span class="setting-label">Theme</span>
        {#if $themeStore === 'dark'}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-kong-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-kong-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        {/if}
      </div>
      <Toggle 
        checked={$themeStore === 'dark'} 
        on:change={(e) => handleThemeToggle()} 
      />
    </div>

    <!-- Slippage Section -->
    <div class="setting-section">
      <div class="setting-header">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-medium text-kong-text-primary">Slippage Tolerance</h3>
          <button 
            class="info-button"
            on:click={() => showSlippageInfo = !showSlippageInfo}
            aria-label="Slippage information"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2"/>
              <path stroke-width="2" d="M12 16v-4M12 8h.01"/>
            </svg>
          </button>
        </div>
        <span class="text-sm text-kong-text-secondary">Maximum price difference during trades</span>
      </div>
      
      {#if showSlippageInfo}
        <div class="info-panel" transition:fly={{ y: -10, duration: 200 }}>
          <p>Slippage tolerance is the maximum price difference you're willing to accept between the estimated and actual price of your trade.</p>
          <ul class="mt-2 space-y-1">
            <li class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-green-500/50"></span>
              <span>0.1-2%: Recommended for stable pairs</span>
            </li>
            <li class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-yellow-500/50"></span>
              <span>2-5%: Use caution, higher risk</span>
            </li>
            <li class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-red-500/50"></span>
              <span>5%+: High risk of unfavorable trades</span>
            </li>
          </ul>
        </div>
      {/if}

      <div class="slippage-content">
        <div class="quick-slippage-buttons">
          {#each quickSlippageValues as value}
            <button
              class="quick-slippage-button"
              class:active={slippageValue === value}
              class:warning={getSlippageRiskLevel(value) === 'warning'}
              class:danger={getSlippageRiskLevel(value) === 'danger'}
              on:click={() => handleQuickSlippageSelect(value)}
            >
              <span class="value">{value}%</span>
              {#if slippageValue === value}
                <span class="active-indicator"></span>
              {/if}
            </button>
          {/each}
          <div 
            class="custom-slippage-input" 
            class:active={isCustomSlippage}
            class:focused={customInputFocused}
            class:warning={getSlippageRiskLevel(slippageValue) === 'warning'}
            class:danger={getSlippageRiskLevel(slippageValue) === 'danger'}
          >
            <input
              type="text"
              class="slippage-input"
              value={slippageInputValue}
              on:input={handleSlippageInput}
              on:change={handleSlippageChange}
              on:blur={(e) => {
                customInputFocused = false;
                handleSlippageBlur(e);
              }}
              on:focus={() => customInputFocused = true}
              placeholder="Custom"
            />
            <span class="percentage-symbol">%</span>
          </div>
        </div>
        
        {#if slippageValue > 0}
          <div class="slippage-indicator" class:warning={getSlippageRiskLevel(slippageValue) === 'warning'} class:danger={getSlippageRiskLevel(slippageValue) === 'danger'}>
            <div class="indicator-bar" style="width: {Math.min(slippageValue * 10, 100)}%"></div>
          </div>
        {/if}

        {#if slippageValue > 5}
          <div class="warning-message danger" transition:fly={{ y: 10, duration: 200 }}>
            <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>High slippage may result in unfavorable trades</span>
          </div>
        {:else if slippageValue > 2}
          <div class="warning-message warning" transition:fly={{ y: 10, duration: 200 }}>
            <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Consider using lower slippage for better rates</span>
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

    <div class="setting-row">
      <span class="setting-label">Reset App</span>
      <button class="action-button warning" on:click={resetDatabase}>
        Reset
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .settings-container {
    @apply w-full text-kong-text-primary max-w-2xl mx-auto overflow-y-auto h-full;
  }

  .setting-sections {
    @apply grid gap-6 max-w-full h-full overflow-y-auto;
  }

  .setting-section {
    @apply grid gap-4 bg-kong-bg-dark/40 rounded-2xl p-6 
           border border-kong-border backdrop-blur-sm
           w-full max-w-full overflow-hidden
           transition-all duration-200 shadow-lg shadow-black/10
           hover:border-kong-border-light;
  }

  .setting-header {
    @apply flex flex-col gap-1 border-b border-kong-border pb-4;
  }

  .setting-header h3 {
    @apply text-kong-text-primary;
  }

  .setting-header span {
    @apply text-kong-text-secondary;
  }

  .slippage-content {
    @apply flex flex-wrap gap-2;
  }

  .quick-slippage-buttons {
    @apply grid grid-cols-2 sm:grid-cols-5 gap-2 w-full;
  }

  .quick-slippage-button {
    @apply relative px-6 py-3 rounded-xl 
           bg-kong-bg-dark/20 text-kong-text-primary text-base font-medium
           border border-kong-border transition-all duration-200
           hover:bg-kong-bg-dark/30 hover:border-kong-border-light
           focus:outline-none focus:ring-2 focus:ring-kong-primary/30
           flex items-center justify-center gap-2;
  }

  .quick-slippage-button .value {
    @apply relative z-10;
  }

  .quick-slippage-button .active-indicator {
    @apply absolute inset-0 rounded-xl bg-kong-primary/10
           border border-kong-primary/30 ring-2 ring-kong-primary/20;
  }

  .custom-slippage-input {
    @apply col-span-2 sm:col-span-1 flex items-center gap-2
           px-4 py-3 rounded-xl bg-kong-bg-dark/20 
           border border-kong-border transition-all duration-200
           hover:bg-kong-bg-dark/30 hover:border-kong-border-light;
  }

  .slippage-input {
    @apply w-full bg-transparent text-kong-text-primary text-base font-medium
           focus:outline-none text-right pr-1
           placeholder:text-kong-text-disabled;
  }

  .percentage-symbol {
    @apply text-kong-text-secondary font-medium;
  }

  .warning-message {
    @apply flex items-center gap-2 mt-3 px-3 py-2 
           bg-kong-error/10 border border-kong-error/20 
           rounded-lg text-kong-error/90 text-sm;
  }

  .warning-icon {
    @apply w-5 h-5 flex-shrink-0;
  }

  .setting-row {
    @apply flex items-center justify-between py-4 px-6 
           bg-kong-bg-dark/40 rounded-2xl border border-kong-border
           hover:bg-kong-bg-dark/30 hover:border-kong-border-light
           transition-all duration-200 shadow-lg shadow-black/10;
  }

  .setting-label {
    @apply text-kong-text-primary text-base font-medium;
  }

  .action-button {
    @apply w-[140px] px-4 py-2.5 rounded-xl
           bg-kong-primary/10 text-kong-text-primary text-sm font-medium
           border border-kong-primary/30 transition-all duration-200
           hover:bg-kong-primary/20 hover:border-kong-primary/40
           focus:outline-none focus:ring-2 focus:ring-kong-primary/30
           text-center whitespace-nowrap shadow-lg shadow-kong-primary/5;
  }

  .action-button.warning {
    @apply bg-kong-error/10 border-kong-error/30
           hover:bg-kong-error/20 hover:border-kong-error/40
           focus:ring-kong-error/30 shadow-lg shadow-kong-error/5;
  }

  .action-button:hover {
    @apply transform -translate-y-0.5;
  }

  @media (max-width: 768px) {
    .setting-header h3 {
      @apply text-base;
    }
    
    .quick-slippage-button {
      @apply px-4 py-2 text-sm min-w-[70px];
    }
    
    .custom-slippage-input {
      @apply min-w-[100px];
    }
    
    .action-button {
      @apply w-[120px] px-3 py-1.5;
    }
  }

  .info-button {
    @apply p-1 rounded-lg text-kong-text-secondary hover:text-kong-text-primary 
           hover:bg-kong-bg-dark/20 transition-colors duration-200;
  }

  .info-panel {
    @apply p-4 rounded-xl bg-kong-bg-dark/20 border border-kong-border
           text-sm text-kong-text-secondary leading-relaxed;
  }

  .slippage-indicator {
    @apply w-full h-1 mt-4 rounded-full bg-kong-bg-dark/20 overflow-hidden;
  }

  .indicator-bar {
    @apply h-full bg-green-500/50 transition-all duration-200;
  }

  .slippage-indicator.warning .indicator-bar {
    @apply bg-yellow-500/50;
  }

  .slippage-indicator.danger .indicator-bar {
    @apply bg-red-500/50;
  }

  .quick-slippage-button.warning {
    @apply hover:border-yellow-500/30;
  }

  .quick-slippage-button.danger {
    @apply hover:border-red-500/30;
  }

  .custom-slippage-input.focused {
    @apply ring-2 ring-kong-primary/30;
  }

  .custom-slippage-input.warning {
    @apply hover:border-yellow-500/30;
  }

  .custom-slippage-input.danger {
    @apply hover:border-red-500/30;
  }

  .warning-message.warning {
    @apply bg-yellow-500/10 border-yellow-500/20 text-yellow-500/90;
  }

  .warning-message.danger {
    @apply bg-red-500/10 border-red-500/20 text-red-500/90;
  }
</style>
