<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Search } from 'lucide-svelte';

  export let searchShortcut = '';
  export let isMobile = false;
</script>

<div class="empty-state" transition:fade={{ duration: 200 }}>
  <div class="empty-state-icon">
    <Search size={24} />
  </div>
  <div class="empty-state-title">Search Kong</div>
  <div class="empty-state-description">
    Search for tokens by name or ID, or find wallets by principal ID
  </div>
  {#if !isMobile}
    <div class="keyboard-shortcuts">
      <div class="shortcut">
        <span class="key">↑↓</span>
        <span class="description">Navigate</span>
      </div>
      <div class="shortcut">
        <span class="key">Enter</span>
        <span class="description">Select</span>
      </div>
      <div class="shortcut">
        <span class="key">Esc</span>
        <span class="description">Close</span>
      </div>
      <div class="shortcut">
        <span class="key">{searchShortcut}</span>
        <span class="description">Open</span>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .empty-state {
    @apply flex flex-col items-center justify-center py-16 px-4 text-center;
    @apply py-10 sm:py-16;
  }

  .empty-state-icon {
    @apply flex items-center justify-center w-16 h-16 rounded-full bg-kong-accent-blue/20 text-kong-accent-blue mb-5;
    @apply w-14 h-14 sm:w-16 sm:h-16;
  }

  .empty-state-title {
    @apply text-2xl font-bold text-kong-text-primary mb-2;
    @apply text-xl sm:text-2xl;
  }

  .empty-state-description {
    @apply text-sm text-kong-text-secondary mb-8 max-w-md;
  }

  .keyboard-shortcuts {
    @apply flex items-center justify-center gap-8 mt-4;
    @apply hidden sm:flex;
  }

  .shortcut {
    @apply flex flex-col items-center;
  }

  .key {
    @apply px-2.5 py-1.5 bg-kong-bg-tertiary border border-kong-border rounded-md text-sm font-medium text-kong-text-secondary mb-1.5;
  }

  .description {
    @apply text-xs text-kong-text-secondary;
  }
</style> 