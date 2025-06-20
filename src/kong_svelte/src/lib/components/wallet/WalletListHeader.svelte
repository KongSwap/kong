<script lang="ts">
  import { RefreshCw } from "lucide-svelte";
  const {
    title = "", 
    count = undefined,
    isLoading = false,
    isRefreshing = false,
    onRefresh = undefined,
    // Slot for additional actions
    actions = null
  } = $props<{
    title: string;
    count?: number | undefined;
    isLoading?: boolean;
    isRefreshing?: boolean;
    onRefresh?: (() => void) | undefined;
    actions?: any;  // Slot for additional action buttons
  }>();

  function handleRefresh() {
    if (!isLoading && !isRefreshing && onRefresh) {
      onRefresh();
    }
  }
</script>

<div class="px-4 flex items-center justify-between shadow">
  <div class="text-xs py-3 font-medium text-kong-text-secondary uppercase tracking-wide">
    {#if count !== undefined}
      {count} {count !== 1 ? title.toLowerCase() : title.toLowerCase().replace(/s$/, '')}
    {:else}
      {title}
    {/if}
  </div>
  
  <div class="flex items-center gap-2">
    {#if $$slots.actions}
      <slot name="actions" />
    {/if}
    
    {#if onRefresh}
      <button 
        class="text-xs text-kong-text-secondary/70 hover:text-kong-primary px-2 py-1 rounded flex items-center gap-1.5 hover:bg-kong-bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={handleRefresh}
        disabled={isLoading || isRefreshing}
        aria-busy={isLoading || isRefreshing}
      >
        <RefreshCw size={12} class={(isLoading || isRefreshing) ? 'animate-spin' : ''} />
        <span>{(isLoading || isRefreshing) ? 'Refreshing...' : 'Refresh'}</span>
      </button>
    {/if}
  </div>
</div> 