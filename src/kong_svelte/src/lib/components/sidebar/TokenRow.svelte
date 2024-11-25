<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Star } from 'lucide-svelte';
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { formatBalance } from '$lib/utils/tokenFormatters';
  import { createEventDispatcher } from 'svelte';
  import TokenDetails from '$lib/components/common/TokenDetails.svelte';

  export let token: any;
  const dispatch = createEventDispatcher();
  let showDetails = false;

  function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('toggleFavorite');
  }

  function handleRowClick() {
    showDetails = true;
  }
</script>

<div 
  class="token-row"
  transition:fade={{ duration: 150 }}
  on:click={handleRowClick}
>
  <div class="token-content">
    <div class="token-info">
      <div class="token-image">
        <TokenImages tokens={[token]} size={32} />
      </div>
      <div class="token-details">
        <div class="token-name-row">
          <span class="token-symbol">{token.symbol}</span>
          <button 
            class="favorite-button"
            class:active={token.isFavorite}
            on:click={handleFavoriteClick}
            title={token.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={16} />
          </button>
        </div>
        <span class="token-name">{token.name}</span>
      </div>
    </div>

    <div class="token-balance">
      <span class="balance-amount">{formatBalance(token.balance, token.decimals)}</span>
      <span class="token-symbol-small">{token.symbol}</span>
    </div>
  </div>
</div>

{#if showDetails}
  <TokenDetails {token} on:close={() => showDetails = false} />
{/if}

<style lang="postcss">
  .token-row {
    @apply p-3 mb-1;
    @apply bg-[#2a2d3d]/50 hover:bg-[#2a2d3d];
    @apply rounded-lg cursor-pointer;
    @apply transition-all duration-200;
    @apply border border-transparent hover:border-[#3a3e52];
  }

  .token-content {
    @apply flex items-center justify-between gap-3;
  }

  .token-info {
    @apply flex items-center gap-3 flex-1 min-w-0;
  }

  .token-image {
    @apply flex-shrink-0;
    @apply bg-[#1a1b23] rounded-full p-0.5;
  }

  .token-details {
    @apply flex flex-col gap-0.5 min-w-0;
  }

  .token-name-row {
    @apply flex items-center gap-2;
  }

  .token-symbol {
    @apply text-base font-semibold text-white;
  }

  .token-name {
    @apply text-xs text-white/60;
    @apply truncate;
  }

  .favorite-button {
    @apply p-1 rounded-lg;
    @apply text-white/40 hover:text-white/90;
    @apply bg-white/5 hover:bg-white/10;
    @apply transition-all duration-200;
  }

  .favorite-button.active {
    @apply text-yellow-400 hover:text-yellow-300;
    @apply bg-yellow-400/10 hover:bg-yellow-400/20;
  }

  .token-balance {
    @apply flex flex-col items-end gap-0.5;
  }

  .balance-amount {
    @apply text-sm font-medium text-white;
  }

  .token-symbol-small {
    @apply text-xs text-white/60;
  }
</style>
