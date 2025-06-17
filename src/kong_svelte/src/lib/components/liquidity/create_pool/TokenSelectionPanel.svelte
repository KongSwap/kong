<script lang="ts">
  import Portal from "svelte-portal";
  import TokenSelectorDropdown from "$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte";
  import { ChevronDown, Plus } from "lucide-svelte";
  
  export let token0: Kong.Token | null;
  export let token1: Kong.Token | null;
  export let onTokenSelect: (index: 0 | 1, token: Kong.Token) => void;
  export let secondaryTokenIds: string[];

  let showToken0Selector = false;
  let showToken1Selector = false;

  function openTokenSelector(index: 0 | 1) {
    if (index === 0) {
      showToken0Selector = true;
      showToken1Selector = false;
    } else {
      showToken1Selector = true;
      showToken0Selector = false;
    }
  }
</script>

<div class="space-y-3">
  <!-- Token Selection Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <!-- Base Token -->
    <div class="token-selection-card">
      <div class="token-label">
        <span class="text-xs font-medium text-kong-text-primary/60 uppercase tracking-wider">Base Token</span>
      </div>
      
      <button
        class="token-selector-button"
        onclick={() => openTokenSelector(0)}
        class:selected={token0}
      >
        {#if token0}
          <div class="token-info">
            <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
            <span class="token-symbol">{token0.symbol}</span>
          </div>
        {:else}
          <div class="select-token-content">
            <Plus class="w-5 h-5 text-kong-text-primary/40" />
            <span class="select-token-text">Select Base Token</span>
          </div>
        {/if}
        <ChevronDown class="w-4 h-4 text-kong-text-primary/40 ml-auto" />
      </button>
    </div>

    <!-- Quote Token -->
    <div class="token-selection-card">
      <div class="token-label">
        <span class="text-xs font-medium text-kong-text-primary/60 uppercase tracking-wider">Quote Token</span>
      </div>
      
      <button
        class="token-selector-button"
        onclick={() => openTokenSelector(1)}
        class:selected={token1}
      >
        {#if token1}
          <div class="token-info">
            <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
            <span class="token-symbol">{token1.symbol}</span>
          </div>
        {:else}
          <div class="select-token-content">
            <Plus class="w-5 h-5 text-kong-text-primary/40" />
            <span class="select-token-text">Select Quote Token</span>
          </div>
        {/if}
        <ChevronDown class="w-4 h-4 text-kong-text-primary/40 ml-auto" />
      </button>
    </div>
  </div>

  <!-- Pool Status -->
  {#if token0 && token1}
    <div class="flex items-center justify-between mt-2">
      <div class="flex items-center gap-2 text-sm text-kong-text-primary/70">
        <span class="font-medium">{token0.symbol}/{token1.symbol}</span>
        <span class="text-kong-text-primary/50">Pool</span>
      </div>
      <span class="text-xs text-kong-success bg-kong-success/10 px-2 py-1 rounded-full">
        Pair Selected
      </span>
    </div>
  {/if}
</div>

    <!-- Token Selectors -->
    {#if showToken0Selector}
      <Portal target="main">
        <TokenSelectorDropdown
          show={true}
          currentToken={token0}
          otherPanelToken={token1}
          onSelect={(token: Kong.Token) => onTokenSelect(0, token)}
          onClose={() => (showToken0Selector = false)}
          title="Base Token"
        />
      </Portal>
    {/if}

    {#if showToken1Selector}
      <Portal target="main">
        <TokenSelectorDropdown
          show={true}
          currentToken={token1}
          otherPanelToken={token0}
          onSelect={(token: Kong.Token) => onTokenSelect(1, token)}
          onClose={() => (showToken1Selector = false)}
          allowedCanisterIds={secondaryTokenIds}
          title="Quote Token"
        />
      </Portal>
    {/if}

<style lang="postcss">
  .token-selection-card {
    @apply space-y-2;
  }

  .token-label {
    @apply pb-1;
  }

  .token-selector-button {
    @apply w-full flex items-center justify-between;
    @apply bg-kong-bg-secondary/50 hover:bg-kong-bg-secondary/80;
    @apply rounded-lg px-4 py-3;
    @apply border border-kong-border/50;
    @apply transition-all duration-200;
  }

  .token-selector-button:hover {
    @apply border-kong-border;
    @apply shadow-sm;
  }

  .token-selector-button.selected {
    @apply bg-kong-primary/5 border-kong-primary/30;
    @apply shadow-sm;
  }

  .token-info {
    @apply flex items-center gap-3 flex-1;
  }

  .token-logo {
    @apply w-8 h-8 rounded-full bg-kong-bg-primary/10 object-contain p-0.5;
    @apply border border-kong-border/30;
    @apply flex-shrink-0;
  }

  .token-symbol {
    @apply text-base text-kong-text-primary font-semibold tracking-tight;
  }

  .select-token-content {
    @apply flex items-center gap-2 flex-1;
  }

  .select-token-text {
    @apply text-sm text-kong-text-primary/60 font-medium;
  }

  .token-selector-button:hover .select-token-text {
    @apply text-kong-text-primary/80;
  }

  .token-selector-button.selected:hover {
    @apply bg-kong-primary/10 border-kong-primary/40;
  }
</style> 