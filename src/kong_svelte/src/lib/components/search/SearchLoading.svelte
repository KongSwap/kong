<script lang="ts">
  import { fade } from 'svelte/transition';
</script>

<div class="loading-state" transition:fade={{ duration: 150 }}>
  <div class="loading-spinner"></div>
  <div class="loading-text">Searching...</div>
</div>

<style lang="postcss">
  .loading-state {
    @apply flex flex-col items-center justify-center py-16;
    @apply py-10 sm:py-16;
  }

  .loading-spinner {
    @apply w-10 h-10 border-4 border-kong-accent-blue border-t-transparent rounded-full animate-spin mb-4;
  }

  .loading-text {
    @apply text-sm text-kong-text-secondary;
  }
</style> 