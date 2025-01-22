<script lang="ts">
  import Portal from "svelte-portal";
  import TokenSelectorDropdown from "$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  
  export let token0: FE.Token | null;
  export let token1: FE.Token | null;
  export let onTokenSelect: (index: 0 | 1, token: FE.Token) => void;
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

    <div class="flex gap-4">
      <button
        class="token-selector-button"
        on:click={() => openTokenSelector(0)}
      >
        {#if token0}
          <div class="token-info">
            <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
            <span class="token-symbol">{token0.symbol}</span>
          </div>
        {:else}
          <span class="select-token-text">Select Token</span>
        {/if}
      </button>

      <button
        class="token-selector-button"
        on:click={() => openTokenSelector(1)}
      >
        {#if token1}
          <div class="token-info">
            <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
            <span class="token-symbol">{token1.symbol}</span>
          </div>
        {:else}
          <span class="select-token-text">Select Token</span>
        {/if}
      </button>
    </div>

    <!-- Token Selectors -->
    {#if showToken0Selector}
      <Portal target="main">
        <TokenSelectorDropdown
          show={true}
          currentToken={token0}
          otherPanelToken={token1}
          onSelect={(token) => onTokenSelect(0, token)}
          onClose={() => (showToken0Selector = false)}
        />
      </Portal>
    {/if}

    {#if showToken1Selector}
      <Portal target="main">
        <TokenSelectorDropdown
          show={true}
          currentToken={token1}
          otherPanelToken={token0}
          onSelect={(token) => onTokenSelect(1, token)}
          onClose={() => (showToken1Selector = false)}
          allowedCanisterIds={secondaryTokenIds}
        />
      </Portal>
    {/if}

<style lang="postcss">
  .token-selector-button {
    @apply flex-1 flex items-center justify-center;
    @apply bg-white/[0.02] hover:bg-white/[0.04];
    @apply rounded-xl px-4 py-3;
    @apply border border-white/[0.03];
    @apply transition-all duration-200;
    backdrop-filter: blur(11px);
  }

  .token-selector-button:hover {
    @apply border-white/[0.06];
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-logo {
    @apply w-7 h-7 rounded-full bg-white/[0.02] object-contain p-0.5;
    @apply border border-white/[0.03];
  }

  .token-symbol {
    @apply text-lg text-kong-text-primary/90 font-medium tracking-tight;
  }

  .select-token-text {
    @apply text-lg text-kong-text-primary/50 font-medium tracking-tight;
  }
</style> 