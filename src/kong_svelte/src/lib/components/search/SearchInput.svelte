<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Search, X } from 'lucide-svelte';

  export let searchQuery = '';
  export let isSearching = false;
  export let searchShortcut = '';
  export let isMobile = false;

  const dispatch = createEventDispatcher();
  let searchInput: HTMLInputElement;

  onMount(() => {
    // Focus input when component mounts
    setTimeout(() => searchInput?.focus(), 100);
  });

  function handleClear() {
    searchQuery = '';
    dispatch('clear');
    setTimeout(() => searchInput?.focus(), 10);
  }

  function handleInput(event: Event) {
    dispatch('input', event);
  }

  function handleKeydown(event: KeyboardEvent) {
    dispatch('keydown', event);
  }
</script>

<div class="search-input-container">
  <Search size={18} class="search-icon" />
  <input
    type="text"
    bind:value={searchQuery}
    bind:this={searchInput}
    placeholder="Search for tokens, wallets..."
    class="search-input"
    oninput={handleInput}
    onkeydown={handleKeydown}
    autocomplete="off"
  />
  {#if isSearching}
    <div class="search-loading-indicator">
      <div class="spinner" />
    </div>
  {:else if searchQuery}
    <button 
      class="clear-button items-center justify-center" 
      onclick={handleClear}
      aria-label="Clear search"
    >
      <X size={16} />
    </button>
  {:else if !isMobile}
    <div class="keyboard-shortcut-indicator">
      <span>{searchShortcut}</span>
    </div>
  {/if}
</div>

<style lang="postcss">
  .search-input-container {
    @apply flex-1 flex items-center gap-2 py-2 px-2 bg-kong-bg-primary/70 rounded-lg border border-kong-border/50 focus-within:border-kong-border/80 transition-colors;
    @apply w-full;
  }

  .search-input {
    @apply flex-1 bg-transparent border-none outline-none text-base text-kong-text-primary placeholder-kong-text-secondary/70;
    @apply text-base sm:text-base;
  }

  .search-loading-indicator {
    @apply flex items-center justify-center;
  }

  .spinner {
    @apply w-4 h-4 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin;
  }

  .clear-button {
    @apply flex items-center justify-center w-6 h-6 rounded-full hover:bg-kong-text-primary/10 text-kong-text-secondary transition-colors;
    @apply sm:w-6 sm:h-6;
  }

  .keyboard-shortcut-indicator {
    @apply px-1.5 py-0.5 bg-kong-bg-tertiary border border-kong-border rounded text-xs text-kong-text-secondary;
    @apply hidden sm:block;
  }
</style> 