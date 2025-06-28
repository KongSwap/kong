<script lang="ts">
  import { fade } from "svelte/transition";

  // Props
  type Props = {
    hasSearchQuery: boolean;
    onClearSearch?: () => void;
  };

  let {
    hasSearchQuery = false,
    onClearSearch
  }: Props = $props();
</script>

<div class="empty-state" in:fade={{ duration: 300 }}>
  <div class="icon-container">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="wallet-icon"
    >
      <path d="M19.9 13.5a1.5 1.5 0 0 0 0-3v3Z"></path>
      <path d="M19.9 7.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h13.9a2 2 0 0 0 2-2v-1.5"></path>
      <path d="M13 6.5V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1.5"></path>
    </svg>
  </div>
  
  <p class="title">No wallets found</p>
  <p class="subtitle">Try a different search term</p>
  
  {#if hasSearchQuery && onClearSearch}
    <button
      class="clear-search-button"
      onclick={onClearSearch}
    >
      Clear search
    </button>
  {/if}
</div>

<style lang="postcss">
  .empty-state {
    @apply flex flex-col items-center justify-center py-8 text-kong-text-secondary;
  }

  .icon-container {
    @apply mb-4 p-4 rounded-full bg-kong-bg-primary/50 shadow-inner-white;
  }

  .wallet-icon {
    @apply text-kong-text-secondary/70;
  }

  .title {
    @apply text-xl font-bold mb-2 text-kong-text-primary;
  }

  .subtitle {
    @apply text-sm;
  }

  .clear-search-button {
    @apply mt-4 px-4 py-2 bg-kong-primary text-kong-text-on-primary rounded-lg;
    @apply transition-all hover:bg-kong-primary-hover hover:scale-105 active:scale-100;
    @apply shadow-md hover:shadow-lg;
  }
</style>