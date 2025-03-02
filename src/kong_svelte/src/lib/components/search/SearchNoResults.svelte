<script lang="ts">
  import { fade } from 'svelte/transition';
  import { X } from 'lucide-svelte';

  export let searchQuery = '';
</script>

<div class="no-results" transition:fade={{ duration: 200 }}>
  <div class="no-results-icon">
    <X size={24} />
  </div>
  <div class="no-results-message">No results found for "{searchQuery}"</div>
  <div class="no-results-tip">Try different keywords or check for typos</div>
</div>

<style lang="postcss">
  .no-results {
    @apply flex flex-col items-center justify-center py-16 px-4 text-center;
    @apply py-10 sm:py-16;
  }

  .no-results-icon {
    @apply flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 mb-4;
  }

  .no-results-message {
    @apply text-lg font-medium text-kong-text-primary mb-2;
  }

  .no-results-tip {
    @apply text-sm text-kong-text-secondary;
  }
</style> 