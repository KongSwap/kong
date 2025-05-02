<script lang="ts">
  import { onMount } from "svelte";
  import { invalidate } from "$app/navigation";

  export let error: string | null = null;
  export let invalidationKey: string = 'app:data';
  export let autoRetry: boolean = true;
  export let autoRetryDelay: number = 2000;
  export let showLoadingState: boolean = true;

  // Track the loading state for manual retry
  let isRetrying = false;
  let retryCount = 0;
  let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

  // Function to retry loading data
  async function retryLoadData() {
    if (isRetrying) return;
    
    isRetrying = true;
    retryCount++;
    
    try {
      // Invalidate the current page data to trigger a reload
      await invalidate(invalidationKey);
    } catch (retryError) {
      console.error("Error retrying load:", retryError);
    } finally {
      isRetrying = false;
    }
  }

  // Auto retry on initial error
  onMount(() => {
    if (error && autoRetry && retryCount === 0) {
      // Auto retry once after the specified delay on initial load
      autoRetryTimer = setTimeout(() => {
        retryLoadData();
      }, autoRetryDelay);
    }

    return () => {
      if (autoRetryTimer) clearTimeout(autoRetryTimer);
    };
  });
</script>

{#if error}
  <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
    <div class="flex justify-between items-center">
      <div>
        <p class="text-red-500 mb-2">⚠️ Error loading data:</p>
        <p class="text-kong-text-secondary text-sm">{error}</p>
      </div>
      
      {#if isRetrying && showLoadingState}
        <div class="flex items-center">
          <div class="animate-spin h-5 w-5 mr-2 rounded-full border-2 border-kong-primary border-t-transparent"></div>
          <span class="text-sm text-kong-text-secondary">Retrying...</span>
        </div>
      {:else}
        <button 
          on:click={retryLoadData}
          class="px-3 py-1 text-sm bg-kong-primary text-white rounded hover:bg-kong-primary/90 transition"
        >
          Retry
        </button>
      {/if}
    </div>
  </div>
{/if}

<slot />