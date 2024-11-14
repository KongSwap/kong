<script lang="ts">
  import LanguageSelector from "../common/LanguageSelector.svelte";
  import { settingsStore } from '$lib/services/settings/settingsStore';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  
  let settings;
  settingsStore.subscribe(value => {
    settings = value;
  });

  function toggleSound() {
    settingsStore.updateSetting('sound', 'enabled', !settings.sound.enabled);
  }

  async function clearFavorites() {
    confirm('Are you sure you want to clear your favorite tokens?') && tokenStore.clearUserData();
    await tokenStore.loadTokens(true);
  }
</script>

<div class="settings-container relative">
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
      {#if settings.sound.enabled}
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
        <span class="setting-label">Sound Effects</span>
        <button
          class="toggle-button"
          class:active={settings.sound.enabled}
          on:click={toggleSound}
        >
          <div class="toggle-slider" />
        </button>
      </div>
      <p class="setting-description">
        Enable or disable sound effects throughout the application
      </p>
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

  <!-- Version Info -->
  <div class="version-info">
    <span>Version 0.0.1</span>
  </div>
</div>

<style lang="postcss">
  .settings-container {
    @apply flex flex-col gap-6 p-2;
  }

  .setting-section {
    @apply bg-white/5 backdrop-blur-sm rounded-xl p-6 transition-all duration-300;
    border: 2px solid transparent;
  }

  .setting-section:hover {
    @apply bg-white/10;
    border-color: theme(colors.yellow.400/30%);
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

  .toggle-button {
    @apply relative w-14 h-8 rounded-full bg-white/10 p-1 duration-300 ease-in-out;
  }

  .toggle-button.active {
    @apply bg-yellow-400;
  }

  .toggle-slider {
    @apply w-6 h-6 rounded-full bg-white shadow-lg transform duration-300 ease-in-out;
  }

  .toggle-button.active .toggle-slider {
    @apply translate-x-6;
  }

  .version-info {
    @apply mt-4 text-center text-white/40 text-sm;
    font-family: monospace;
  }

  /* Hover Effects */
  .toggle-button:hover {
    @apply bg-white/20;
  }

  .toggle-button.active:hover {
    @apply bg-yellow-500;
  }

  /* Focus States */
  .toggle-button:focus {
    @apply outline-none ring-2 ring-yellow-400 ring-opacity-50;
  }

  /* Animation for icon changes */
  svg {
    @apply transition-transform duration-300;
  }

  .setting-section:hover svg {
    @apply scale-110;
  }

  /* Responsive adjustments */
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
</style> 