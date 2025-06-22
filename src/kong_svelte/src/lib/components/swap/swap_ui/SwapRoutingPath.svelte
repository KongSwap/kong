<script lang="ts">
  import { Route, ChevronRight } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import Panel from "$lib/components/common/Panel.svelte";

  let { routingPath = [], isLoading = false } = $props<{
    routingPath: Array<{
      paySymbol: string;
      receiveSymbol: string;
      poolSymbol: string;
      payAmount: string;
      receiveAmount: string;
      price: number;
    }> | null;
    isLoading?: boolean;
  }>();

  $inspect(routingPath);

  // Show routing for all swaps
  const showRouting = $derived(routingPath && routingPath.length > 0 && !isLoading);
  const isMultiHop = $derived(routingPath && routingPath.length > 1);

  // Build the complete route string
  const routeTokens = $derived(() => {
    if (!routingPath || routingPath.length === 0) return [];

    const tokens = [routingPath[0].paySymbol];
    routingPath.forEach((hop) => {
      tokens.push(hop.receiveSymbol);
    });
    return tokens;
  });
</script>

{#if false}
  <div class="routing-container" transition:fade={{ duration: 200 }}>
    <Panel
      variant="solid"
      type="secondary"
      className="routing-panel"
      transition="fade"
      transitionParams={{ duration: 200 }}
    >
      {#snippet children()}
        <div class="route-content">
          <div class="route-flow">
            {#each routeTokens() as token, index}
              {#if index > 0}
                <ChevronRight size={14} class="route-arrow" />
              {/if}
              <span
                class="route-token"
                class:route-token-start={index === 0}
                class:route-token-end={index === routeTokens().length - 1}
              >
                {token}
              </span>
            {/each}
          </div>
          <div class="routing-header">
            <Route size={14} class="routing-icon" />
            <span class="routing-label">
              {isMultiHop ? "Multi-hop Route" : "Direct Swap"}
            </span>
          </div>
        </div>
      {/snippet}
    </Panel>
  </div>
{/if}

<style lang="postcss">
  .routing-container {
    @apply w-full px-2 md:px-0;
  }

  :global(.routing-panel) {
    @apply overflow-x-auto;
  }

  .route-content {
    @apply flex items-center justify-between gap-4;
  }

  .route-flow {
    @apply flex items-center gap-1 text-sm whitespace-nowrap flex-1;
  }

  .routing-header {
    @apply flex items-center gap-1.5 flex-shrink-0;
  }

  .routing-label {
    @apply text-xs font-medium text-kong-text-secondary uppercase tracking-wider;
  }

  .route-token {
    @apply font-semibold text-kong-text-primary px-2 py-1 rounded-lg
           bg-kong-bg-secondary/50 border border-kong-border/50
           transition-all duration-200;
  }

  .route-token-start {
    @apply bg-kong-primary/10 border-kong-primary/30 text-kong-primary;
  }

  .route-token-end {
    @apply bg-kong-success/10 border-kong-success/30 text-kong-success;
  }

  /* Hover effects */
  .route-token:hover {
    @apply bg-kong-bg-secondary/70 border-kong-border/70;
  }

  .route-token-start:hover {
    @apply bg-kong-primary/20 border-kong-primary/40;
  }

  .route-token-end:hover {
    @apply bg-kong-success/20 border-kong-success/40;
  }

  /* Mobile optimization */
  @media (max-width: 640px) {
    .routing-container {
      @apply px-0;
    }

    .routing-path {
      @apply p-3 rounded-lg;
    }

    .route-flow {
      @apply text-xs gap-0.5;
    }

    .route-token {
      @apply px-1.5 py-0.5 text-xs;
    }
  }

  /* Mobile optimization */
  @media (max-width: 640px) {
    .routing-container {
      @apply px-0;
    }

    .route-content {
      @apply gap-3;
    }

    .route-flow {
      @apply text-xs gap-0.5;
    }

    .route-token {
      @apply px-1.5 py-0.5 text-xs;
    }

    .route-arrow {
      @apply w-3 h-3;
    }

    .routing-icon {
      @apply w-3 h-3;
    }

    .routing-label {
      @apply text-[10px];
    }
  }

  /* Custom scrollbar for overflow */
  :global(.routing-panel::-webkit-scrollbar) {
    @apply h-1;
  }

  :global(.routing-panel::-webkit-scrollbar-track) {
    @apply bg-kong-bg-tertiary rounded-full;
  }

  :global(.routing-panel::-webkit-scrollbar-thumb) {
    @apply bg-kong-border rounded-full;
  }

  :global(.routing-panel::-webkit-scrollbar-thumb:hover) {
    @apply bg-kong-border/80;
  }
</style>
