<script lang="ts">  
	import { formatBalance } from '$lib/utils/numberFormatUtils';
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { formatUsdValue } from '$lib/utils/tokenFormatters';
  import { Star } from 'lucide-svelte';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { FavoriteService } from '$lib/services/tokens/favoriteService';
  import { createEventDispatcher } from 'svelte';

  interface TokenRowProps {
    token: FE.Token;
    onClick?: () => void;
  }
  let { token, onClick }: TokenRowProps = $props();
  const dispatch = createEventDispatcher();

  async function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    await FavoriteService.toggleFavorite(token.canister_id);
  }

  let isFavorite = $derived(FavoriteService.isFavorite(token.canister_id));
</script>

{#if token}
<div class="base">
  <button class="content" onclick={onClick} type="button" aria-label="Select {token.name} ({token.symbol})">
    <div class="left">
      <div class="img-container">
        <TokenImages tokens={[token]} size={24} />
      </div>
      <div class="text">
        <div class="symbol-row">
          <button 
            class="favorite-button"
            class:active={isFavorite}
            on:click={handleFavoriteClick}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={14} fill={isFavorite ? "#ffd700" : "none"} />
          </button>
          <span class="symbol">{token.symbol}</span>
        </div>
        <span class="name" title={token.name}>{token.name}</span>
      </div>
    </div>
    <div class="right">
      <span class="balance">{formatBalance(token.balance?.toString() ?? "0", token.decimals)}</span>
      {#if token.metrics.price}
        <span class="price">{formatUsdValue(token.metrics.price)}</span>
      {/if}
    </div>
  </button>
</div>
{/if}

<style lang="postcss">
  .base {
    @apply w-full px-3 py-2 rounded-lg bg-black/20 border border-white/5 
           transition-all duration-200 hover:bg-black/30;
  }

  .content {
    @apply w-full flex items-center justify-between gap-6 
           text-left bg-transparent;
  }

  .left {
    @apply flex items-center gap-3 min-w-0 flex-1;
  }

  .img-container {
    @apply w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden;
  }

  .img-container :global(img) {
    @apply max-w-full max-h-full object-contain;
  }

  .text {
    @apply flex flex-col min-w-0 gap-0.5;
  }

  .symbol-row {
    @apply flex items-center gap-2;
  }

  .favorite-button {
    @apply p-1 rounded-md text-white/50 bg-white/5
           transition-all duration-200 hover:bg-white/10 hover:text-white;
  }

  .favorite-button.active {
    @apply text-yellow-300 bg-yellow-300/10;
  }

  .symbol {
    @apply text-base font-medium text-white truncate;
  }

  .name {
    @apply text-sm text-white/60 truncate;
  }

  .right {
    @apply flex flex-col items-end flex-shrink-0 gap-0.5;
  }

  .balance {
    @apply text-base text-white/90 font-mono;
  }

  .price {
    @apply text-sm text-white/60 font-mono;
  }
</style>
