<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Coins, ArrowRight } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { getPriceChangeClass } from '$lib/utils/statsUtils';
  import { formatTokenName } from '$lib/utils/tokenFormatUtils';

  export let tokens: Kong.Token[] = [];
  export let selectedIndex = -1;
  export let startIndex = 0;

  const dispatch = createEventDispatcher();

  function formatPrice(price: number | string | undefined): string {
    if (!price) return '$0.00';
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(numericPrice);
  }

  function formatPriceChange(change: number | string | undefined): string {
    if (!change) return '0.00%';
    const numericChange = typeof change === 'string' ? parseFloat(change) : change;
    return `${numericChange >= 0 ? '+' : ''}${numericChange.toFixed(2)}%`;
  }

  function handleSelect(token: Kong.Token) {
    dispatch('select', token);
  }

  function handleTouchStart(event: TouchEvent) {
    dispatch('touchstart', event);
  }

  function handleTouchMove(event: TouchEvent) {
    dispatch('touchmove', event);
  }

  function handleTouchEnd(token: Kong.Token, event: TouchEvent) {
    dispatch('touchend', { token, event });
  }
</script>

{#if tokens.length > 0}
  <div class="result-section" transition:fade={{ duration: 200 }}>
    <div class="result-section-header">
      <Coins size={16} />
      <span>Tokens</span>
      <span class="result-count">{tokens.length} results</span>
    </div>
    
    <div class="result-list">
      {#each tokens as token, index}
        <button
          class="result-item token-result {selectedIndex === startIndex + index ? 'selected' : ''}"
          onclick={() => handleSelect(token)}
          ontouchstart={handleTouchStart}
          ontouchmove={handleTouchMove}
          ontouchend={(e) => handleTouchEnd(token, e)}
        >
          <div class="result-content">
            <div class="token-icon">
              {#if token.logo_url}
                <img src={token.logo_url} alt={token.name} loading="lazy" />
              {:else}
                <div class="token-placeholder"></div>
              {/if}
            </div>
            <div class="token-info">
              <div class="token-name">{token.name}</div>
              <div class="token-symbol">{token.symbol} • {formatPrice(token.metrics?.price)}</div>
            </div>
            {#if token.metrics?.price_change_24h}
              <div class="token-price-change {getPriceChangeClass(token)}">
                {formatPriceChange(token.metrics.price_change_24h)}
              </div>
            {/if}
          </div>
          <ArrowRight size={16} class="goto-icon" />
        </button>
      {/each}
    </div>
  </div>
{/if}

<style lang="postcss">
  .result-section {
    @apply py-3 w-full;
    max-width: 100%;
  }

  .result-section-header {
    @apply flex items-center gap-2 px-4 py-2 text-sm font-medium text-kong-text-secondary;
    max-width: 100%;
  }

  .result-count {
    @apply ml-auto text-xs text-kong-text-secondary/70;
  }

  .result-list {
    @apply flex flex-col;
    @apply overflow-hidden;
    width: 100%;
  }

  .result-item {
    @apply flex items-center justify-between w-full px-4 py-3 text-left hover:bg-white/5 transition-colors rounded-md my-0.5;
    @apply py-3.5 sm:py-3;
    max-width: 100%;
  }

  .result-item.selected {
    @apply bg-white/10;
  }

  .result-content {
    @apply flex items-center gap-3 flex-1 min-w-0;
    max-width: calc(100% - 24px); /* Account for the arrow icon */
  }

  .token-icon img {
    @apply w-8 h-8 rounded-full object-cover border border-kong-border/50;
    flex-shrink: 0;
  }

  .token-placeholder {
    @apply w-8 h-8 rounded-full bg-kong-text-primary/5 border border-kong-border/50;
    flex-shrink: 0;
  }

  .token-info {
    @apply flex-1 min-w-0 max-w-full;
  }

  .token-name {
    @apply text-kong-text-primary font-medium truncate;
  }

  .token-symbol {
    @apply text-sm text-kong-text-secondary truncate;
  }

  .token-price-change {
    @apply text-sm font-medium;
    flex-shrink: 0;
  }

  .goto-icon {
    @apply text-kong-text-secondary/50 opacity-0 transition-opacity;
    @apply opacity-50 sm:opacity-0;
    flex-shrink: 0;
  }

  .result-item:hover .goto-icon {
    @apply opacity-100;
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .result-item {
      @apply active:bg-white/10; /* Better touch feedback */
    }
    
    .token-symbol {
      @apply max-w-[200px]; /* Limit width on mobile */
    }
  }
</style> 